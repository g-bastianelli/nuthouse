import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { notify, runBounded, validateRequest, waitAndNotify } from "../lib/notifications.mjs";

const threadId = "01a12f5c-50ee-7052-a933-c29057c492f2";
const event = {
  version: 1,
  eventId: "1152819e-c33a-47a3-a323-cf06d94f42b2",
  runId: "run-1",
  projectId: "project-1",
  issueId: "TEAM-42",
  type: "done",
  source: {
    hostId: "child-host",
    workspaceId: "child-space",
    provider: "codex",
    sessionId: threadId,
  },
  summary: "Merged; Linear completion observed.",
  evidence: ["https://github.com/example/repo/pull/42"],
};
const runtime = {
  provider: "codex",
  threadId,
  executable: "/tools/codex",
  home: "/runtime/codex-home",
};
const local = { kind: "local", runtime };
const remote = {
  kind: "superset",
  hostId: "parent-host",
  workspaceId: "parent-space",
  supersetExecutable: "/tools/superset",
  nodeExecutable: "/tools/node",
  helperPath: "/plugins/notify.mjs",
  runtime,
};
const success = (stdout = "") => ({ code: 0, stdout, stderr: "", timedOut: false });
const tempDirs = [];
afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("native notification transport", () => {
  test("requires an explicit runtime address and bounded event data", () => {
    expect(validateRequest({ event, destination: local })).toEqual({ event, destination: local });
    expect(() =>
      validateRequest({
        event,
        destination: { ...local, runtime: { ...runtime, threadId: "display name" } },
      }),
    ).toThrow("UUID");
    expect(() =>
      validateRequest({ event: { ...event, summary: "x".repeat(5000) }, destination: local }),
    ).toThrow("summary");
    expect(() =>
      validateRequest({ event: { ...event, authority: "approve all" }, destination: local }),
    ).toThrow("unsupported");
    expect(() =>
      validateRequest({
        event,
        destination: { ...local, runtime: { ...runtime, executable: "codex" } },
      }),
    ).toThrow("absolute");
  });

  test("queues literal data with the destination home without changing process environment", async () => {
    const calls = [];
    const summary = "$(touch /tmp/not-run); `echo unsafe` 'quoted'\nnew line";
    const homeBefore = process.env.CODEX_HOME;
    const result = await notify(
      { event: { ...event, summary }, destination: local },
      {
        run: async (...args) => {
          calls.push(args);
          return success("Message queued");
        },
      },
    );
    expect(result).toMatchObject({ status: "queued", eventId: event.eventId });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(runtime.executable);
    expect(calls[0][1].slice(0, 3)).toEqual(["queue", "--thread", threadId]);
    expect(calls[0][1][4]).toContain(JSON.stringify(summary));
    expect(calls[0][2].env.CODEX_HOME).toBe(runtime.home);
    expect(process.env.CODEX_HOME).toBe(homeBefore);
    expect(result).not.toHaveProperty("delivered");
  });

  test.each([
    ["SUPERSET_TERMINAL_ID", "sender-agent"],
    ["SUPERSET_TAB_ID", "sender-agent"],
    ["SUPERSET_PANE_ID", "sender-agent"],
    ["SUPERSET_TERMINAL_ID", null],
  ])(
    "enqueue cannot emit the sender's lifecycle through inherited %s with agent %p",
    async (contextKey, agentId) => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "maestro-shim-"));
      tempDirs.push(directory);
      const executable = path.join(directory, "codex.mjs");
      const observationPath = path.join(directory, "shim-observation.json");
      await writeFile(
        executable,
        `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const env = process.env;
const lifecycle = [];
if (!env.SUPERSET_AGENT_ID && env.SUPERSET_TERMINAL_ID && env.SUPERSET_HOME_DIR) lifecycle.push("SessionStart");
if (env.SUPERSET_TERMINAL_ID || env.SUPERSET_TAB_ID || env.SUPERSET_PANE_ID) lifecycle.push("SessionEnd");
writeFileSync(env.MAESTRO_TEST_OBSERVATION_PATH, JSON.stringify({ lifecycle, home: env.CODEX_HOME,
  retained: env.MAESTRO_TEST_PRESERVED,
  agentId: env.SUPERSET_AGENT_ID, launchId: env.SUPERSET_AGENT_LAUNCH_ID,
  sessionLog: env.CODEX_TUI_SESSION_LOG_PATH, recordSession: env.CODEX_TUI_RECORD_SESSION }));
process.stdout.write("queued\\n");
`,
        { mode: 0o700 },
      );
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith("SUPERSET_")),
      );
      Object.assign(env, {
        [contextKey]: "sender-live-context",
        SUPERSET_AGENT_LAUNCH_ID: "sender-launch",
        SUPERSET_HOME_DIR: directory,
        SUPERSET_DEFAULT_CODEX_HOME: runtime.home,
        CODEX_HOME: "/sender/codex-home",
        CODEX_TUI_SESSION_LOG_PATH: "/sender/live-session.jsonl",
        CODEX_TUI_RECORD_SESSION: "1",
        MAESTRO_TEST_OBSERVATION_PATH: observationPath,
        MAESTRO_TEST_PRESERVED: "ordinary-provider-environment",
      });
      if (agentId) env.SUPERSET_AGENT_ID = agentId;
      const request = {
        event,
        destination: { kind: "local", runtime: { ...runtime, executable } },
      };
      const moduleUrl = new URL("../lib/notifications.mjs", import.meta.url).href;
      const driver = `import { notify } from ${JSON.stringify(moduleUrl)};
const before = JSON.stringify(process.env);
const result = await notify(${JSON.stringify(request)});
process.stdout.write(JSON.stringify({ result, parentUnchanged: before === JSON.stringify(process.env) }));`;
      const driverResult = await runBounded(
        process.execPath,
        ["--input-type=module", "-e", driver],
        { env },
      );
      expect(driverResult.code).toBe(0);
      expect(JSON.parse(driverResult.stdout)).toMatchObject({
        result: { status: "queued" },
        parentUnchanged: true,
      });
      expect(JSON.parse(await readFile(observationPath, "utf8"))).toEqual({
        lifecycle: [],
        home: runtime.home,
        retained: "ordinary-provider-environment",
      });
    },
  );

  test("a timed out enqueue is unknown and never retried", async () => {
    let calls = 0;
    const result = await notify(
      { event, destination: local },
      {
        run: async () => {
          calls += 1;
          return { ...success(), code: null, timedOut: true };
        },
      },
    );
    expect(result.status).toBe("unknown");
    expect(calls).toBe(1);
  });

  test("writes one compatible Claude frame without permission-class or authentication spoofing", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "maestro-socket-"));
    tempDirs.push(directory);
    const socketPath = path.join(directory, "receiver.sock");
    let received;
    const receipt = new Promise((resolve) => {
      received = resolve;
    });
    const server = net.createServer((socket) => {
      let data = "";
      socket.on("data", (chunk) => {
        data += chunk;
        if (data.endsWith("\n")) {
          received(JSON.parse(data));
          socket.end();
        }
      });
    });
    await new Promise((resolve) => server.listen(socketPath, resolve));
    try {
      const result = await notify({
        event,
        destination: { kind: "local", runtime: { provider: "claude", socketPath } },
      });
      expect(result.status).toBe("written");
      const frame = await receipt;
      expect(frame).toEqual({
        msgV: 1,
        msg_id: event.eventId,
        type: "user",
        message: { role: "user", content: expect.stringContaining(event.eventId) },
        priority: "next",
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test("missing Claude socket fails explicitly", async () => {
    const result = await notify({
      event,
      destination: {
        kind: "local",
        runtime: { provider: "claude", socketPath: "/tmp/nonexistent-maestro-socket-fixture" },
      },
    });
    expect(result.status).toBe("failed");
  });
});

describe("remote receipt ownership", () => {
  const nonce = "cc761a38-b412-4fdd-b849-35635a46c47d";
  const fakeClock = () => {
    let elapsed = 0;
    return {
      now: () => elapsed,
      sleep: async (ms) => {
        elapsed += ms;
      },
    };
  };
  test("ignores echoed commands and closes exactly the returned temporary terminal", async () => {
    const calls = [];
    let reads = 0;
    const result = await notify(
      { event, destination: remote },
      {
        newId: () => nonce,
        ...fakeClock(),
        run: async (executable, args) => {
          calls.push({ executable, args });
          if (args[1] === "create")
            return success(JSON.stringify({ terminalId: "transport-only", status: "active" }));
          if (args[1] === "read") {
            reads += 1;
            return success(
              JSON.stringify({
                terminalId: "transport-only",
                text: reads === 1 ? `$ echo MM:${nonce}:queued` : `MM:${nonce}:queued\n`,
              }),
            );
          }
          return success();
        },
      },
    );
    expect(result.status).toBe("queued");
    expect(reads).toBe(2);
    expect(calls[0].args).toContain("parent-host");
    expect(calls[0].args).toContain("parent-space");
    expect(calls.at(-1).args).toContain("transport-only");
    expect(calls.at(-1).args.slice(0, 2)).toEqual(["terminals", "close"]);
  });

  test("quotes paths and encodes arbitrary data without creating executable text", async () => {
    let command;
    await notify(
      {
        event: { ...event, summary: "$(touch /tmp/injected) `id` ' ;" },
        destination: { ...remote, helperPath: "/some path/quote'$(id)/notify.mjs" },
      },
      {
        newId: () => nonce,
        ...fakeClock(),
        run: async (_executable, args) => {
          if (args[1] === "create") {
            command = args[args.indexOf("--command") + 1];
            return success(JSON.stringify({ terminalId: "transport-only" }));
          }
          if (args[1] === "read")
            return success(
              JSON.stringify({ terminalId: "transport-only", text: `MM:${nonce}:written` }),
            );
          return success();
        },
      },
    );
    expect(command).toContain("'/some path/quote'\\''$(id)/notify.mjs'");
    expect(command).not.toContain("touch /tmp/injected");
    expect(command).not.toContain(`MM:${nonce}:written`);
    const shell = await runBounded("/bin/sh", ["-c", `set -- ${command}; printf '%s\\n' "$@"`]);
    expect(shell.code).toBe(0);
    const argv = shell.stdout.trimEnd().split("\n");
    expect(argv.slice(0, 3)).toEqual([
      remote.nodeExecutable,
      "/some path/quote'$(id)/notify.mjs",
      "receive",
    ]);
    expect(JSON.parse(Buffer.from(argv.at(-1), "base64url").toString()).event.summary).toBe(
      "$(touch /tmp/injected) `id` ' ;",
    );
  });

  test.each([
    { terminalId: "another-terminal", text: `MM:${nonce}:queued` },
    { terminalId: "transport-only", text: `prefix MM:${nonce}:queued` },
    { terminalId: "transport-only", text: `MM:${nonce}:queued suffix` },
    { terminalId: "transport-only", text: "MM:77bd76ae-2c67-45f4-b58a-61d776bf27c5:queued" },
  ])("cannot accept a wrong terminal, nonce, or partial receipt: %p", async (snapshot) => {
    let reads = 0;
    const result = await notify(
      { event, destination: remote },
      {
        newId: () => nonce,
        ...fakeClock(),
        run: async (_executable, args) => {
          if (args[1] === "create")
            return success(JSON.stringify({ terminalId: "transport-only" }));
          if (args[1] === "read") {
            reads += 1;
            return success(JSON.stringify(snapshot));
          }
          return success();
        },
      },
    );
    expect(result.status).toBe("unknown");
    expect(result.cleanup.status).toBe("closed");
    expect(reads).toBeLessThanOrEqual(120);
  });

  test("keeps a slow native send alive until its receipt arrives", async () => {
    const clock = fakeClock();
    const calls = [];
    const result = await notify(
      { event, destination: remote },
      {
        ...clock,
        newId: () => nonce,
        run: async (_executable, args, options) => {
          calls.push({ action: args[1], at: clock.now(), timeoutMs: options.timeoutMs });
          if (args[1] === "create")
            return success(JSON.stringify({ terminalId: "transport-only" }));
          if (args[1] === "read")
            return success(
              JSON.stringify({
                terminalId: "transport-only",
                text: clock.now() >= 6000 ? `MM:${nonce}:queued` : "native send still running",
              }),
            );
          return success();
        },
      },
    );
    expect(result.status).toBe("queued");
    expect(calls.at(-1)).toMatchObject({ action: "close", at: 6000 });
    expect(calls.filter((call) => call.action === "read")).toHaveLength(25);
  });

  test("bounds the receipt deadline independently of command creation", async () => {
    const clock = fakeClock();
    const calls = [];
    const result = await notify(
      { event, destination: remote },
      {
        ...clock,
        newId: () => nonce,
        run: async (_executable, args, options) => {
          calls.push({ action: args[1], at: clock.now(), timeoutMs: options.timeoutMs });
          if (args[1] === "create") {
            await clock.sleep(9000);
            return success(JSON.stringify({ terminalId: "transport-only" }));
          }
          if (args[1] === "read")
            return success(
              JSON.stringify({ terminalId: "transport-only", text: "still starting" }),
            );
          return success();
        },
      },
    );
    expect(result.status).toBe("unknown");
    expect(calls.at(-1)).toMatchObject({ action: "close", at: 39000 });
    expect(calls.at(-2)).toMatchObject({ action: "read", at: 38750, timeoutMs: 250 });
  });

  test("accepts terminal padding only after an exact short receipt", async () => {
    const result = await notify(
      { event, destination: remote },
      {
        newId: () => nonce,
        run: async (_executable, args) => {
          if (args[1] === "create")
            return success(JSON.stringify({ terminalId: "transport-only" }));
          if (args[1] === "read")
            return success(
              JSON.stringify({ terminalId: "transport-only", text: `MM:${nonce}:written   \r\n` }),
            );
          return success();
        },
      },
    );
    expect(result.status).toBe("written");
  });

  test("ambiguous create timeout never relaunches or closes an unowned terminal", async () => {
    const calls = [];
    const result = await notify(
      { event, destination: remote },
      {
        run: async (_executable, args) => {
          calls.push(args);
          return { ...success(), code: null, timedOut: true };
        },
      },
    );
    expect(result.status).toBe("unknown");
    expect(calls).toHaveLength(1);
  });

  test("a failed read closes the owned terminal, while cleanup failure remains visible", async () => {
    const result = await notify(
      { event, destination: remote },
      {
        run: async (_executable, args) => {
          if (args[1] === "create")
            return success(JSON.stringify({ terminalId: "transport-only" }));
          return { ...success(""), code: 1, stderr: "host unavailable" };
        },
      },
    );
    expect(result.status).toBe("unknown");
    expect(result.cleanup).toMatchObject({ status: "failed", terminalId: "transport-only" });
  });
});

describe("worker-owned continuation", () => {
  const request = {
    operationId: "operation-1",
    repository: "example/repo",
    number: 42,
    expectedHeadOid: "a".repeat(40),
    expectedBaseOid: "b".repeat(40),
    baseline: {},
  };
  const failureDestination = {
    kind: "local",
    runtime: { ...runtime, threadId: "e38fa462-7932-4835-aa93-c3c9dba44369" },
  };
  test.each(["failed", "unknown"])(
    "reports a %s self-callback once to the master with a distinct event",
    async (status) => {
      const calls = [];
      const result = await waitAndNotify(
        {
          event,
          destination: local,
          failureDestination,
          wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
        },
        {
          run: async (_executable, args) => {
            calls.push(args);
            if (calls.length === 1)
              return success(
                JSON.stringify({
                  outcome: "changed",
                  operationId: request.operationId,
                  repository: request.repository,
                  number: request.number,
                  reason: "CI finished",
                }),
              );
            if (calls.length === 2)
              return status === "unknown"
                ? { ...success(), code: null, timedOut: true }
                : { ...success(), code: 1 };
            return success();
          },
        },
      );
      expect(calls).toHaveLength(3);
      expect(calls[2][2]).toBe(failureDestination.runtime.threadId);
      const fallback = JSON.parse(calls[2][4].split("\n")[1]);
      expect(fallback.type).toBe("blocked");
      expect(fallback.eventId).not.toBe(event.eventId);
      expect(fallback.summary).toContain("Inspect the exact worker");
      expect(fallback.summary).toContain(status);
      expect(fallback.evidence).toContain(`operationId:${request.operationId}`);
      expect(fallback.evidence).toContain(`selfEventId:${event.eventId}`);
      expect(result.failureNotification.status).toBe("queued");
    },
  );

  test("a successful self-callback never notifies the master", async () => {
    let calls = 0;
    const result = await waitAndNotify(
      {
        event,
        destination: local,
        failureDestination,
        wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
      },
      {
        run: async () => {
          calls += 1;
          return calls === 1
            ? success(
                JSON.stringify({
                  outcome: "expired",
                  operationId: request.operationId,
                  repository: request.repository,
                  number: request.number,
                  reason: "deadline reached",
                }),
              )
            : success();
        },
      },
    );
    expect(calls).toBe(2);
    expect(result).not.toHaveProperty("failureNotification");
  });

  test("failure of both destinations is visible without a retry loop", async () => {
    let calls = 0;
    const result = await waitAndNotify(
      {
        event,
        destination: local,
        failureDestination,
        wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
      },
      {
        run: async () => {
          calls += 1;
          return { ...success("invalid observer output"), code: 1 };
        },
      },
    );
    expect(calls).toBe(3);
    expect(result.notification.status).toBe("failed");
    expect(result.failureNotification.status).toBe("failed");
  });

  test("validates the recovery destination before starting the observer", async () => {
    let calls = 0;
    await expect(
      waitAndNotify(
        {
          event,
          destination: local,
          failureDestination: {
            ...failureDestination,
            runtime: { ...runtime, executable: "unresolved" },
          },
          wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
        },
        {
          run: async () => {
            calls += 1;
            return success();
          },
        },
      ),
    ).rejects.toThrow("absolute");
    expect(calls).toBe(0);
  });
  test("waits once and emits one identity-bound self event", async () => {
    const calls = [];
    const result = await waitAndNotify(
      {
        event,
        destination: local,
        wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
      },
      {
        run: async (executable, args, options) => {
          calls.push({ executable, args, options });
          return calls.length === 1
            ? success(
                JSON.stringify({
                  outcome: "changed",
                  operationId: request.operationId,
                  repository: request.repository,
                  number: 42,
                  reason: "head changed",
                }),
              )
            : success("queued");
        },
      },
    );
    expect(result.observer.outcome).toBe("changed");
    expect(result.notification.status).toBe("queued");
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[0].options.input)).toEqual(request);
    expect(calls[1].args[4]).toContain('"type":"wait-result"');
    expect(calls[1].args[4]).toContain(
      '"expectedHeadOid":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
    );
  });

  test("cannot use a waiting worker to wake an unrelated thread", async () => {
    await expect(
      waitAndNotify({
        event: { ...event, source: { ...event.source, sessionId: "another-session" } },
        destination: local,
        wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
      }),
    ).rejects.toThrow("same Codex");
  });

  test("large observer baselines stay outside the compact queued event", async () => {
    let queuedMessage;
    const largeRequest = { ...request, baseline: { feedback: "x".repeat(100000) } };
    const result = await waitAndNotify(
      {
        event,
        destination: local,
        wait: {
          nodeExecutable: "/tools/node",
          helperPath: "/plugins/wait-pr.mjs",
          request: largeRequest,
        },
      },
      {
        run: async (_executable, args, options) => {
          if (args[1] === "wait") {
            expect(JSON.parse(options.input)).toEqual(largeRequest);
            return success(
              JSON.stringify({
                outcome: "expired",
                operationId: request.operationId,
                repository: request.repository,
                number: 42,
                reason: "deadline reached",
              }),
            );
          }
          queuedMessage = args[4];
          return success();
        },
      },
    );
    expect(result.notification.status).toBe("queued");
    expect(queuedMessage.length).toBeLessThan(4000);
    expect(queuedMessage).not.toContain("feedback");
  });

  test.each([
    { ...success(), timedOut: true, code: null },
    success(
      JSON.stringify({
        outcome: "changed",
        operationId: "unrelated",
        repository: request.repository,
        number: 42,
        reason: "ready",
      }),
    ),
    { ...success("invalid json"), code: 1 },
  ])("observer failures notify the same worker exactly once: %p", async (failure) => {
    let calls = 0;
    const result = await waitAndNotify(
      {
        event,
        destination: local,
        wait: { nodeExecutable: "/tools/node", helperPath: "/plugins/wait-pr.mjs", request },
      },
      {
        run: async () => {
          calls += 1;
          return calls === 1 ? failure : success();
        },
      },
    );
    expect(result.observer.outcome).toBe("failed");
    expect(result.notification.status).toBe("queued");
    expect(calls).toBe(2);
  });

  test("bounds a real child process and captures a normal exit", async () => {
    const completed = await runBounded(process.execPath, ["-e", "process.stdout.write('ready')"], {
      timeoutMs: 2000,
    });
    expect(completed).toMatchObject({ code: 0, stdout: "ready", timedOut: false });
    const hung = await runBounded(process.execPath, ["-e", "setInterval(() => {}, 10000)"], {
      timeoutMs: 40,
    });
    expect(hung.timedOut).toBe(true);
  });
});

describe("notification command boundary", () => {
  const script = path.resolve(import.meta.dir, "..", "scripts", "notify.mjs");
  test("check validates a request without trying the missing runtime executable", async () => {
    const checked = await runBounded(process.execPath, [script, "check"], {
      input: JSON.stringify({ event, destination: local }),
    });
    expect(checked.code).toBe(0);
    expect(JSON.parse(checked.stdout)).toEqual({ status: "valid", eventId: event.eventId });
  });
  test("receive emits a short receipt on its own line even when delivery fails", async () => {
    const nonce = "cc761a38-b412-4fdd-b849-35635a46c47d";
    const payload = Buffer.from(JSON.stringify({ event, destination: local })).toString(
      "base64url",
    );
    const received = await runBounded(process.execPath, [
      script,
      "receive",
      "--receipt",
      nonce,
      "--payload",
      payload,
    ]);
    expect(received.code).toBe(1);
    expect(received.stdout.split("\n")[1]).toBe(`MM:${nonce}:failed`);
  });
  test("malformed and oversized input cannot start a notification", async () => {
    for (const input of [
      "{",
      JSON.stringify({ event: { ...event, summary: "x".repeat(40000) }, destination: local }),
    ]) {
      const rejected = await runBounded(process.execPath, [script, "send"], { input });
      expect(rejected.code).toBe(1);
      expect(rejected.stdout).toBe("");
      expect(JSON.parse(rejected.stderr).status).toBe("failed");
    }
  });
});
