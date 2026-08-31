import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { resolveConfiguration } from "../src/configuration.mjs";
import {
  createDecisionManifest,
  deriveRepositoryId,
  hashDecisionManifestContent,
  serializeDecisionManifest,
} from "../src/manifest-schema.mjs";
import {
  DecisionManifestStoreError,
  WorkflowStateConflictError,
  getDecisionManifestPath,
  inspectDecisionManifest,
  writeDecisionManifest,
} from "../src/manifest-store.mjs";
import { resolveWorkflowPolicy } from "../src/policy-resolution.mjs";
import { discoverGitContext } from "../src/worktree-overrides.mjs";

const START_TIME = new Date("2026-08-31T10:00:00.000Z");
const LATER_TIME = new Date("2026-08-31T10:05:00.000Z");
const EXPIRES_AT = new Date("2026-09-01T10:00:00.000Z").toISOString();
const POLICY_HASH = `sha256:${"a".repeat(64)}`;
const RUN_ID = "run-550-manifest-store";
const SECOND_RUN_ID = "run-550-atomic-failure";
const MANIFEST_STORE_MODULE_URL = pathToFileURL(
  path.resolve(import.meta.dir, "..", "src", "manifest-store.mjs"),
).href;

let temporaryDirectory;
let mainWorktree;
let linkedWorktree;
let mainContext;
let linkedContext;

function policy(workflow = "direct-task") {
  return resolveWorkflowPolicy({
    configuration: resolveConfiguration(),
    workflow,
  });
}

function writeInput(overrides = {}) {
  return {
    runId: RUN_ID,
    policy: policy(),
    policyHash: POLICY_HASH,
    artifacts: [],
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

function fileMode(filePath) {
  return fs.statSync(filePath).mode & 0o777;
}

function waitForPath(filePath, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function poll() {
      if (fs.existsSync(filePath)) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${filePath}.`));
        return;
      }
      setTimeout(poll, 10);
    }
    poll();
  });
}

function childOutput(child) {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-manifest-store-"));
  mainWorktree = path.join(temporaryDirectory, "main");
  linkedWorktree = path.join(temporaryDirectory, "linked");

  execFileSync("git", ["init", "--initial-branch=main", mainWorktree], { stdio: "ignore" });
  fs.writeFileSync(path.join(mainWorktree, "README.md"), "fixture\n", "utf8");
  execFileSync("git", ["-C", mainWorktree, "add", "README.md"]);
  execFileSync(
    "git",
    [
      "-C",
      mainWorktree,
      "-c",
      "user.name=Nuthouse Tests",
      "-c",
      "user.email=tests@nuthouse.invalid",
      "commit",
      "-m",
      "fixture",
    ],
    { stdio: "ignore" },
  );
  execFileSync("git", ["-C", mainWorktree, "worktree", "add", "-b", "linked", linkedWorktree], {
    stdio: "ignore",
  });

  mainContext = discoverGitContext(mainWorktree);
  linkedContext = discoverGitContext(linkedWorktree);
});

afterEach(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("decision manifest paths", () => {
  test("uses the shared Git common directory for real linked worktrees", () => {
    expect(mainContext.gitCommonDir).toBe(linkedContext.gitCommonDir);
    expect(getDecisionManifestPath(mainContext, RUN_ID)).toBe(
      path.join(mainContext.gitCommonDir, "nuthouse", "workflow", "runs", `${RUN_ID}.json`),
    );
    expect(getDecisionManifestPath(linkedContext, RUN_ID)).toBe(
      getDecisionManifestPath(mainContext, RUN_ID),
    );
  });

  test("rejects unsafe run ids before deriving a path", () => {
    for (const runId of [
      "",
      ".",
      "..",
      "../escape",
      "run/name",
      "run.name",
      "-leading",
      "trailing-",
      "UPPERCASE",
      "a".repeat(129),
    ]) {
      try {
        getDecisionManifestPath(mainContext, runId);
        throw new Error(`Expected ${JSON.stringify(runId)} to be rejected.`);
      } catch (error) {
        expect(error).toBeInstanceOf(DecisionManifestStoreError);
        expect(error).toMatchObject({ code: "invalid-run-id", runId });
      }
    }

    expect(fs.existsSync(path.join(mainContext.gitCommonDir, "nuthouse"))).toBe(false);
  });

  test("refuses a managed-directory symlink that escapes Git state", () => {
    const outsideDirectory = path.join(temporaryDirectory, "outside");
    const nuthouseDirectory = path.join(mainContext.gitCommonDir, "nuthouse");
    fs.mkdirSync(outsideDirectory);
    fs.symlinkSync(outsideDirectory, nuthouseDirectory, "dir");

    expect(() =>
      writeDecisionManifest(mainContext, writeInput(), {
        expectedRevision: 0,
        now: START_TIME,
      }),
    ).toThrow(
      expect.objectContaining({
        name: "DecisionManifestStoreError",
        code: "manifest-path-out-of-scope",
      }),
    );
    expect(fs.readdirSync(outsideDirectory)).toEqual([]);
  });
});

describe("decision manifest persistence", () => {
  test("creates canonical private state and hashes the exact persisted bytes (AC-036, AC-037)", () => {
    const result = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 0,
      now: START_TIME,
    });
    const persistedBytes = fs.readFileSync(result.path);

    expect(result.path).toBe(getDecisionManifestPath(mainContext, RUN_ID));
    expect(result.manifest).toMatchObject({
      schemaVersion: 1,
      runId: RUN_ID,
      repositoryId: deriveRepositoryId(mainContext.gitCommonDir),
      worktreeId: mainContext.worktreeId,
      policyHash: POLICY_HASH,
      revision: 1,
      createdAt: START_TIME.toISOString(),
      updatedAt: START_TIME.toISOString(),
      expiresAt: EXPIRES_AT,
    });
    expect(persistedBytes.toString("utf8")).toBe(serializeDecisionManifest(result.manifest));
    expect(result.contentHash).toBe(hashDecisionManifestContent(persistedBytes));
    expect(result.handoff).toEqual({
      run_id: RUN_ID,
      path: result.path,
      content_hash: result.contentHash,
    });
    expect(fileMode(path.dirname(result.path))).toBe(0o700);
    expect(fileMode(result.path)).toBe(0o600);
    expect(
      fs
        .readdirSync(path.dirname(result.path))
        .filter((name) => name.endsWith(".tmp") || name.endsWith(".lock")),
    ).toEqual([]);

    expect(inspectDecisionManifest(mainContext, RUN_ID, { now: START_TIME })).toEqual({
      status: "valid",
      path: result.path,
      contentHash: result.contentHash,
      manifest: result.manifest,
      handoff: result.handoff,
      diagnostics: [],
    });
  });

  test("updates only the exact observed revision and preserves creation time (AC-041)", () => {
    const created = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 0,
      now: START_TIME,
    });
    const updated = writeDecisionManifest(
      mainContext,
      writeInput({ policy: policy("issue-delivery") }),
      {
        expectedRevision: created.manifest.revision,
        now: LATER_TIME,
      },
    );

    expect(updated.manifest.revision).toBe(2);
    expect(updated.manifest.createdAt).toBe(START_TIME.toISOString());
    expect(updated.manifest.updatedAt).toBe(LATER_TIME.toISOString());
    expect(updated.manifest.decision.workflow).toBe("issue-delivery");

    try {
      writeDecisionManifest(mainContext, writeInput(), {
        expectedRevision: created.manifest.revision,
        now: new Date(LATER_TIME.getTime() + 1),
      });
      throw new Error("Expected a stale update to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowStateConflictError);
      expect(error).toMatchObject({
        code: "workflow-state-conflict",
        runId: RUN_ID,
        expectedRevision: 1,
        actualRevision: 2,
      });
    }

    expect(inspectDecisionManifest(mainContext, RUN_ID, { now: LATER_TIME }).manifest).toEqual(
      updated.manifest,
    );
  });

  test("cleans an exclusive same-directory temporary file when rename fails", () => {
    const manifestPath = getDecisionManifestPath(mainContext, SECOND_RUN_ID);
    const originalRename = fs.renameSync;
    let observedTemporaryPath = null;
    let observedTemporaryMode = null;
    fs.renameSync = (source, destination) => {
      if (destination === manifestPath) {
        observedTemporaryPath = source;
        observedTemporaryMode = fileMode(source);
        const error = new Error("injected rename failure");
        error.code = "EIO";
        throw error;
      }
      return originalRename(source, destination);
    };

    try {
      expect(() =>
        writeDecisionManifest(mainContext, writeInput({ runId: SECOND_RUN_ID }), {
          expectedRevision: 0,
          now: START_TIME,
        }),
      ).toThrow("injected rename failure");
    } finally {
      fs.renameSync = originalRename;
    }

    expect(fs.existsSync(manifestPath)).toBe(false);
    expect(path.dirname(observedTemporaryPath)).toBe(path.dirname(manifestPath));
    expect(path.basename(observedTemporaryPath)).toMatch(
      new RegExp(`^\\.${SECOND_RUN_ID}\\.json\\.\\d+\\.[a-f0-9-]+\\.tmp$`),
    );
    expect(observedTemporaryMode).toBe(0o600);
    expect(
      fs.readdirSync(path.dirname(manifestPath)).filter((name) => name.includes(SECOND_RUN_ID)),
    ).toEqual([]);
  });

  test("recovers a run lock abandoned by an exited owner", () => {
    const created = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 0,
      now: START_TIME,
    });
    const lockPath = `${created.path}.lock`;
    const exited = spawnSync(process.execPath, ["-e", ""]);
    expect(exited.status).toBe(0);
    fs.writeFileSync(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: exited.pid,
        createdAt: new Date().toISOString(),
        token: "exited-owner",
      })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    const updated = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 1,
      now: LATER_TIME,
    });

    expect(updated.manifest.revision).toBe(2);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test("does not steal an old run lock from a live owner", () => {
    const manifestPath = getDecisionManifestPath(mainContext, RUN_ID);
    const lockPath = `${manifestPath}.lock`;
    fs.mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        createdAt: "1970-01-01T00:00:00.000Z",
        token: "live-owner",
      })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );

    const originalNow = Date.now;
    let clockReads = 0;
    Date.now = () => START_TIME.getTime() + (clockReads++ === 0 ? 0 : 5_001);
    try {
      expect(() =>
        writeDecisionManifest(mainContext, writeInput(), {
          expectedRevision: 0,
          now: START_TIME,
        }),
      ).toThrow(
        expect.objectContaining({
          name: "DecisionManifestStoreError",
          code: "decision-manifest-lock-timeout",
        }),
      );
    } finally {
      Date.now = originalNow;
    }

    expect(fs.existsSync(manifestPath)).toBe(false);
    expect(fs.existsSync(lockPath)).toBe(true);
  });
});

describe("decision manifest inspection and recovery", () => {
  test("distinguishes missing state without inventing a byte observation", () => {
    expect(inspectDecisionManifest(mainContext, RUN_ID, { now: START_TIME })).toEqual({
      status: "missing",
      path: getDecisionManifestPath(mainContext, RUN_ID),
      contentHash: null,
      manifest: null,
      handoff: null,
      diagnostics: [],
    });
  });

  test("distinguishes corrupt bytes and replaces only the exact observed content hash", () => {
    const manifestPath = getDecisionManifestPath(mainContext, RUN_ID);
    const corruptBytes = Buffer.from("{ definitely not json\n", "utf8");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, corruptBytes, { mode: 0o600 });

    const inspection = inspectDecisionManifest(mainContext, RUN_ID, { now: START_TIME });
    expect(inspection).toMatchObject({
      status: "corrupt",
      path: manifestPath,
      contentHash: hashDecisionManifestContent(corruptBytes),
      manifest: null,
      handoff: null,
      diagnostics: [{ code: "invalid-json", field: "$" }],
    });

    for (const observedContentHash of [undefined, `sha256:${"f".repeat(64)}`]) {
      expect(() =>
        writeDecisionManifest(mainContext, writeInput(), {
          expectedRevision: 0,
          now: START_TIME,
          ...(observedContentHash === undefined ? {} : { observedContentHash }),
        }),
      ).toThrow(WorkflowStateConflictError);
    }
    expect(fs.readFileSync(manifestPath)).toEqual(corruptBytes);

    const recovered = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 0,
      observedContentHash: inspection.contentHash,
      now: START_TIME,
    });
    expect(recovered.manifest.revision).toBe(1);
    expect(inspectDecisionManifest(mainContext, RUN_ID, { now: START_TIME }).status).toBe("valid");
  });

  test("distinguishes schema-invalid bytes and exposes their exact recovery token", () => {
    const manifestPath = getDecisionManifestPath(mainContext, RUN_ID);
    const invalidBytes = Buffer.from('{"schemaVersion":999}\n', "utf8");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, invalidBytes, { mode: 0o600 });

    const inspection = inspectDecisionManifest(mainContext, RUN_ID, { now: START_TIME });
    expect(inspection).toMatchObject({
      status: "invalid",
      path: manifestPath,
      contentHash: hashDecisionManifestContent(invalidBytes),
      manifest: null,
      handoff: null,
    });
    expect(inspection.diagnostics).not.toEqual([]);
  });

  test("returns expired state with a trusted revision for an optimistic replacement", () => {
    const expiresAt = new Date(START_TIME.getTime() + 1_000).toISOString();
    const written = writeDecisionManifest(mainContext, writeInput({ expiresAt }), {
      expectedRevision: 0,
      now: START_TIME,
    });
    const inspection = inspectDecisionManifest(mainContext, RUN_ID, {
      now: Date.parse(expiresAt),
    });

    expect(inspection).toMatchObject({
      status: "expired",
      path: written.path,
      contentHash: written.contentHash,
      manifest: written.manifest,
      handoff: null,
      diagnostics: [{ code: "expired-manifest", field: "$.expiresAt" }],
    });

    const replacement = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: inspection.manifest.revision,
      now: new Date(Date.parse(expiresAt) + 1),
    });
    expect(replacement.manifest.revision).toBe(2);
  });

  test("rejects a sibling worktree manifest while retaining its CAS revision", () => {
    const written = writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 0,
      now: START_TIME,
    });
    const inspection = inspectDecisionManifest(linkedContext, RUN_ID, { now: START_TIME });

    expect(inspection).toMatchObject({
      status: "out-of-scope",
      path: written.path,
      contentHash: written.contentHash,
      manifest: written.manifest,
      handoff: null,
      diagnostics: [{ code: "worktree-mismatch", field: "$.worktreeId" }],
    });
  });

  test("rejects repository identity mismatch independently from malformed state", () => {
    const manifestPath = getDecisionManifestPath(mainContext, RUN_ID);
    const wrongRepositoryManifest = createDecisionManifest({
      runId: RUN_ID,
      repositoryId: "b".repeat(64),
      worktreeId: mainContext.worktreeId,
      decision: policy(),
      policyHash: POLICY_HASH,
      artifacts: [],
      revision: 1,
      createdAt: START_TIME.toISOString(),
      updatedAt: START_TIME.toISOString(),
      expiresAt: EXPIRES_AT,
    });
    const bytes = serializeDecisionManifest(wrongRepositoryManifest);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, bytes, { mode: 0o600 });

    expect(inspectDecisionManifest(mainContext, RUN_ID, { now: START_TIME })).toMatchObject({
      status: "out-of-scope",
      contentHash: hashDecisionManifestContent(bytes),
      manifest: wrongRepositoryManifest,
      diagnostics: [{ code: "repository-mismatch", field: "$.repositoryId" }],
    });
  });
});

describe("decision manifest concurrency", () => {
  test("serializes two real processes and rejects one stale revision (AC-041)", async () => {
    writeDecisionManifest(mainContext, writeInput(), {
      expectedRevision: 0,
      now: START_TIME,
    });
    const readyOne = path.join(temporaryDirectory, "writer-one-ready");
    const readyTwo = path.join(temporaryDirectory, "writer-two-ready");
    const release = path.join(temporaryDirectory, "release-writers");
    const writerScript = path.join(temporaryDirectory, "writer.mjs");

    fs.writeFileSync(
      writerScript,
      `
        import fs from "node:fs";
        import { writeDecisionManifest } from ${JSON.stringify(MANIFEST_STORE_MODULE_URL)};
        const sleeper = new Int32Array(new SharedArrayBuffer(4));
        fs.writeFileSync(process.env.TEST_READY_PATH, "ready\\n");
        while (!fs.existsSync(process.env.TEST_RELEASE_PATH)) {
          Atomics.wait(sleeper, 0, 0, 10);
        }
        try {
          const result = writeDecisionManifest(
            JSON.parse(process.env.TEST_GIT_CONTEXT),
            JSON.parse(process.env.TEST_WRITE_INPUT),
            { expectedRevision: 1, now: Number(process.env.TEST_NOW) },
          );
          process.stdout.write(JSON.stringify({ ok: true, revision: result.manifest.revision }));
        } catch (error) {
          process.stdout.write(JSON.stringify({ ok: false, code: error?.code ?? null }));
        }
      `,
      "utf8",
    );

    function spawnWriter(readyPath, now) {
      return spawn(process.execPath, [writerScript], {
        env: {
          ...process.env,
          TEST_READY_PATH: readyPath,
          TEST_RELEASE_PATH: release,
          TEST_GIT_CONTEXT: JSON.stringify(mainContext),
          TEST_WRITE_INPUT: JSON.stringify(writeInput()),
          TEST_NOW: String(now),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    }

    const writerOne = spawnWriter(readyOne, LATER_TIME.getTime());
    const writerTwo = spawnWriter(readyTwo, LATER_TIME.getTime() + 1);
    const outputOne = childOutput(writerOne);
    const outputTwo = childOutput(writerTwo);
    await Promise.all([waitForPath(readyOne), waitForPath(readyTwo)]);
    fs.writeFileSync(release, "release\n", "utf8");

    const exits = await Promise.all([outputOne, outputTwo]);
    expect(exits.map(({ code, signal, stderr }) => ({ code, signal, stderr }))).toEqual([
      { code: 0, signal: null, stderr: "" },
      { code: 0, signal: null, stderr: "" },
    ]);
    const outcomes = exits.map(({ stdout }) => JSON.parse(stdout));
    expect(outcomes.filter((outcome) => outcome.ok)).toEqual([{ ok: true, revision: 2 }]);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([
      { ok: false, code: "workflow-state-conflict" },
    ]);

    expect(
      inspectDecisionManifest(mainContext, RUN_ID, { now: LATER_TIME }).manifest.revision,
    ).toBe(2);
    expect(fs.existsSync(`${getDecisionManifestPath(mainContext, RUN_ID)}.lock`)).toBe(false);
  });
});
