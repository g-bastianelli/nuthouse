import { afterEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  acquireProjectLock,
  inspectProjectLock,
  recoverProjectLock,
  releaseProjectLock,
  verifyProjectLock,
} from "../lib/project-lock.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("../scripts/project-lock.mjs", import.meta.url));
const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-lock-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function lockInput(directory, overrides = {}) {
  return {
    directory,
    projectId: "project-1",
    hostId: "host-1",
    now: "2026-08-27T10:00:00.000Z",
    leaseDurationMs: 60_000,
    ...overrides,
  };
}

function runLockScript(operation, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, operation], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`project-lock CLI failed (${String(code)}): ${stderr || stdout}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("project dispatch lock", () => {
  test("publishes one exact v2 owner and refuses contenders", () => {
    const directory = temporaryDirectory();
    const first = acquireProjectLock(lockInput(directory));
    const second = acquireProjectLock(
      lockInput(directory, { hostId: "host-2", now: "2026-08-27T10:00:01.000Z" }),
    );

    expect(first.owner).toEqual({
      schemaVersion: 2,
      projectId: "project-1",
      hostId: "host-1",
      token: first.token,
      createdAt: "2026-08-27T10:00:00.000Z",
      expiresAt: "2026-08-27T10:01:00.000Z",
    });
    expect(second).toMatchObject({
      acquired: false,
      reason: "LOCK_HELD",
      state: "held",
      owner: { token: first.token },
    });
  });

  test("requires the exact token to release and cannot delete a successor", () => {
    const directory = temporaryDirectory();
    const first = acquireProjectLock(lockInput(directory));
    expect(releaseProjectLock({ ...first, token: "wrong" })).toEqual({
      released: false,
      reason: "TOKEN_MISMATCH",
    });
    expect(inspectProjectLock(lockInput(directory)).state).toBe("held");

    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: first.token,
        now: "2026-08-27T10:01:00.000Z",
        staleAfterMs: 60_000,
      }),
    ).toMatchObject({ recovered: true, state: "free" });
    const successor = acquireProjectLock(lockInput(directory, { now: "2026-08-27T10:01:01.000Z" }));

    expect(releaseProjectLock(first)).toEqual({
      released: false,
      reason: "TOKEN_MISMATCH",
    });
    expect(inspectProjectLock(lockInput(directory)).owner.token).toBe(successor.token);
    expect(releaseProjectLock(successor)).toEqual({ released: true });
  });

  test("uses expiresAt as the stale boundary and requires the observed token", () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock(lockInput(directory));

    expect(
      inspectProjectLock({
        directory,
        projectId: "project-1",
        now: "2026-08-27T10:00:59.999Z",
      }).state,
    ).toBe("held");
    expect(
      inspectProjectLock({
        directory,
        projectId: "project-1",
        now: "2026-08-27T10:01:00.000Z",
      }).state,
    ).toBe("stale");
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        now: "2026-08-27T10:01:00.000Z",
      }),
    ).toEqual({ recovered: false, reason: "EXPECTED_TOKEN_REQUIRED" });
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: "wrong",
        now: "2026-08-27T10:01:00.000Z",
      }),
    ).toEqual({ recovered: false, reason: "TOKEN_MISMATCH" });
    expect(inspectProjectLock(lockInput(directory)).owner.token).toBe(lock.token);
  });

  test("verifies exact live ownership immediately before a provider mutation", async () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock(lockInput(directory));
    const expected = {
      directory,
      projectId: "project-1",
      hostId: "host-1",
      token: lock.token,
      verifiedAt: "2026-08-27T10:00:30.000Z",
      expiresAt: "2026-08-27T10:01:00.000Z",
    };

    expect(verifyProjectLock(lock, { now: "2026-08-27T10:00:30.000Z" })).toEqual({
      verified: true,
      verification: expected,
    });
    expect(verifyProjectLock(lock, { now: "2026-08-27T10:01:00.000Z" })).toEqual({
      verified: false,
      reason: "LOCK_EXPIRED",
      expiresAt: "2026-08-27T10:01:00.000Z",
    });
    expect(verifyProjectLock({ ...lock, token: "wrong" })).toEqual({
      verified: false,
      reason: "INVALID_HANDLE",
    });
    expect(
      await runLockScript("verify", {
        handle: lock,
        options: { now: "2026-08-27T10:00:30.000Z" },
      }),
    ).toEqual({ verified: true, verification: expected });
  });

  test("recovers the empty directory left by an acquisition crash", () => {
    const directory = temporaryDirectory();
    expect(() =>
      acquireProjectLock({
        ...lockInput(directory),
        onDirectoryCreated() {
          throw new Error("simulated crash after mkdir");
        },
      }),
    ).toThrow("simulated crash");

    expect(inspectProjectLock(lockInput(directory))).toMatchObject({
      state: "empty",
      recoverable: true,
    });
    expect(recoverProjectLock(lockInput(directory))).toEqual({
      recovered: true,
      state: "free",
      artifacts: ["empty"],
    });
    expect(acquireProjectLock(lockInput(directory)).acquired).toBe(true);
  });

  test("recovers a prepared owner that crashed before atomic publication", () => {
    const directory = temporaryDirectory();
    expect(() =>
      acquireProjectLock({
        ...lockInput(directory),
        onOwnerPrepared() {
          throw new Error("simulated crash before owner publish");
        },
      }),
    ).toThrow("simulated crash");

    expect(inspectProjectLock(lockInput(directory))).toMatchObject({
      state: "empty",
      recoverable: true,
    });
    expect(recoverProjectLock(lockInput(directory))).toMatchObject({
      recovered: true,
      state: "free",
      artifacts: ["empty"],
    });
  });

  test("keeps a fully published owner after a crash and recovers it only after expiry", () => {
    const directory = temporaryDirectory();
    expect(() =>
      acquireProjectLock({
        ...lockInput(directory),
        onOwnerPublished() {
          throw new Error("simulated crash after owner publish");
        },
      }),
    ).toThrow("simulated crash");

    const owner = inspectProjectLock(lockInput(directory)).owner;
    expect(owner).toBeDefined();
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: owner.token,
        now: "2026-08-27T10:00:30.000Z",
      }),
    ).toEqual({ recovered: false, reason: "LOCK_NOT_STALE" });
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: owner.token,
        now: "2026-08-27T10:01:00.000Z",
      }),
    ).toMatchObject({ recovered: true, artifacts: ["stale"] });
  });

  test("recovers the empty directory left by a release crash", () => {
    const directory = temporaryDirectory();
    const lock = acquireProjectLock(lockInput(directory));
    expect(() =>
      releaseProjectLock(lock, {
        onOwnerRemoved() {
          throw new Error("simulated crash after owner unlink");
        },
      }),
    ).toThrow("simulated crash");

    expect(inspectProjectLock(lockInput(directory)).state).toBe("empty");
    expect(recoverProjectLock(lockInput(directory))).toMatchObject({
      recovered: true,
      state: "free",
    });
  });

  test("directly clears a stale legacy transition without acquiring it", () => {
    const directory = temporaryDirectory();
    const free = inspectProjectLock(lockInput(directory));
    const transitionPath = `${free.path}.transition`;
    fs.mkdirSync(transitionPath);
    const old = new Date("2026-08-27T09:00:00.000Z");
    fs.utimesSync(transitionPath, old, old);

    expect(inspectProjectLock(lockInput(directory))).toMatchObject({
      state: "legacy-transition",
      recoverable: true,
    });
    expect(acquireProjectLock(lockInput(directory))).toMatchObject({
      acquired: false,
      reason: "LEGACY_TRANSITION",
    });
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        now: "2026-08-27T10:00:00.000Z",
        staleAfterMs: 60_000,
      }),
    ).toEqual({
      recovered: true,
      state: "free",
      artifacts: ["legacy-transition"],
    });
  });

  test("reads and safely recovers a stale schema-v1 owner", () => {
    const directory = temporaryDirectory();
    const target = inspectProjectLock(lockInput(directory)).path;
    fs.mkdirSync(target);
    fs.writeFileSync(
      path.join(target, "owner.json"),
      JSON.stringify({
        schemaVersion: 1,
        projectId: "project-1",
        runId: "run-old",
        token: "legacy-token",
        processId: 123,
        acquiredAt: "2026-08-27T09:00:00.000Z",
      }),
    );

    expect(
      inspectProjectLock({
        directory,
        projectId: "project-1",
        now: "2026-08-27T10:00:00.000Z",
        staleAfterMs: 60_000,
      }),
    ).toMatchObject({ state: "stale", legacyOwner: { token: "legacy-token" } });
    expect(
      recoverProjectLock({
        directory,
        projectId: "project-1",
        expectedToken: "legacy-token",
        now: "2026-08-27T10:00:00.000Z",
        staleAfterMs: 60_000,
      }),
    ).toMatchObject({ recovered: true, state: "free" });
  });

  test("concurrent recoverers and acquirers converge on one owner", async () => {
    const directory = temporaryDirectory();
    const stale = acquireProjectLock(lockInput(directory));
    const recovery = {
      directory,
      projectId: "project-1",
      expectedToken: stale.token,
      now: "2026-08-27T10:01:00.000Z",
      staleAfterMs: 60_000,
    };
    const recoveryResults = await Promise.all(
      Array.from({ length: 8 }, () => runLockScript("recover", recovery)),
    );
    expect(recoveryResults.filter((result) => result.recovered)).toHaveLength(1);
    expect(inspectProjectLock(lockInput(directory)).state).toBe("free");

    const acquisitionResults = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        runLockScript(
          "acquire",
          lockInput(directory, {
            hostId: `host-${String(index)}`,
            now: "2026-08-27T10:02:00.000Z",
          }),
        ),
      ),
    );
    expect(acquisitionResults.filter((result) => result.acquired)).toHaveLength(1);
    const inspection = inspectProjectLock({
      directory,
      projectId: "project-1",
      now: "2026-08-27T10:02:01.000Z",
    });
    expect(inspection.state).toBe("held");
    expect(inspection.owner.token).toBe(acquisitionResults.find((result) => result.acquired).token);
  });
});
