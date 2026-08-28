import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  MAX_WORKTREE_OVERRIDE_AGE_MS,
  WORKTREE_OVERRIDE_SCHEMA_VERSION,
  WorktreeOverrideValidationError,
  discoverGitContext,
  getWorktreeOverridePath,
  readWorktreeOverride,
  resetWorktreeOverride,
  validateWorktreeOverride,
  writeWorktreeOverride,
} from "../src/index.mjs";

const START_TIME = new Date("2026-08-28T10:00:00.000Z");
const WORKTREE_OVERRIDE_MODULE_URL = pathToFileURL(
  path.resolve(import.meta.dir, "..", "src", "worktree-overrides.mjs"),
).href;

let temporaryDirectory;
let mainWorktree;
let linkedWorktree;
let mainContext;
let linkedContext;

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

function childExit(child) {
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, stderr }));
  });
}

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-worktree-overrides-"));
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

describe("Git worktree identity", () => {
  test("discovers a shared common directory and distinct canonical worktree identities", () => {
    expect(mainContext.gitCommonDir).toBe(linkedContext.gitCommonDir);
    expect(mainContext.worktreeRoot).toBe(fs.realpathSync(mainWorktree));
    expect(linkedContext.worktreeRoot).toBe(fs.realpathSync(linkedWorktree));
    expect(mainContext.worktreeId).toBe(
      createHash("sha256").update(fs.realpathSync(mainWorktree)).digest("hex"),
    );
    expect(linkedContext.worktreeId).toBe(
      createHash("sha256").update(fs.realpathSync(linkedWorktree)).digest("hex"),
    );
    expect(mainContext.worktreeId).not.toBe(linkedContext.worktreeId);
  });

  test("derives one override path per worktree beneath the Git common directory", () => {
    const mainPath = getWorktreeOverridePath(mainContext);
    const linkedPath = getWorktreeOverridePath(linkedContext);

    expect(mainPath).toBe(
      path.join(
        mainContext.gitCommonDir,
        "nuthouse",
        "workflow",
        "worktrees",
        `${mainContext.worktreeId}.json`,
      ),
    );
    expect(linkedPath).not.toBe(mainPath);
  });
});

describe("worktree override schema", () => {
  test("exports the version and maximum lifetime contracts", () => {
    expect(WORKTREE_OVERRIDE_SCHEMA_VERSION).toBe(1);
    expect(MAX_WORKTREE_OVERRIDE_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });

  test("accepts the strict version-one override shape", () => {
    const override = {
      schemaVersion: 1,
      worktreeId: mainContext.worktreeId,
      profile: "quick",
      createdAt: START_TIME.toISOString(),
      expiresAt: new Date(START_TIME.getTime() + MAX_WORKTREE_OVERRIDE_AGE_MS).toISOString(),
    };

    expect(
      validateWorktreeOverride(override, { expectedWorktreeId: mainContext.worktreeId }),
    ).toEqual({
      ok: true,
      value: override,
      diagnostics: [],
    });
  });

  const invalidOverrides = [
    {
      name: "a non-object root",
      value: [],
      field: "$",
    },
    {
      name: "a wrong schema version",
      value: {
        schemaVersion: 2,
        worktreeId: "a".repeat(64),
        profile: "quick",
        createdAt: "2026-08-28T10:00:00.000Z",
        expiresAt: "2026-08-29T10:00:00.000Z",
      },
      field: "$.schemaVersion",
    },
    {
      name: "an unknown field",
      value: {
        schemaVersion: 1,
        worktreeId: "a".repeat(64),
        profile: "quick",
        createdAt: "2026-08-28T10:00:00.000Z",
        expiresAt: "2026-08-29T10:00:00.000Z",
        unexpected: true,
      },
      field: "$.unexpected",
    },
    {
      name: "an invalid profile",
      value: {
        schemaVersion: 1,
        worktreeId: "a".repeat(64),
        profile: "fast",
        createdAt: "2026-08-28T10:00:00.000Z",
        expiresAt: "2026-08-29T10:00:00.000Z",
      },
      field: "$.profile",
    },
    {
      name: "an invalid creation timestamp",
      value: {
        schemaVersion: 1,
        worktreeId: "a".repeat(64),
        profile: "quick",
        createdAt: "yesterday-ish",
        expiresAt: "2026-08-29T10:00:00.000Z",
      },
      field: "$.createdAt",
    },
    {
      name: "a lifetime longer than 24 hours",
      value: {
        schemaVersion: 1,
        worktreeId: "a".repeat(64),
        profile: "quick",
        createdAt: "2026-08-28T10:00:00.000Z",
        expiresAt: "2026-08-29T10:00:00.001Z",
      },
      field: "$.expiresAt",
    },
  ];

  for (const fixture of invalidOverrides) {
    test(`reports the exact field for ${fixture.name}`, () => {
      const result = validateWorktreeOverride(fixture.value);

      expect(result.ok).toBe(false);
      expect(result.diagnostics[0].field).toBe(fixture.field);
    });
  }

  test("rejects an override belonging to another worktree", () => {
    const override = {
      schemaVersion: 1,
      worktreeId: mainContext.worktreeId,
      profile: "quick",
      createdAt: START_TIME.toISOString(),
      expiresAt: new Date(START_TIME.getTime() + MAX_WORKTREE_OVERRIDE_AGE_MS).toISOString(),
    };

    const result = validateWorktreeOverride(override, {
      expectedWorktreeId: linkedContext.worktreeId,
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({
      code: "worktree-mismatch",
      field: "$.worktreeId",
    });
  });
});

describe("worktree override persistence", () => {
  test("atomically writes isolated overrides for two real worktrees (AC-007)", () => {
    const mainOverride = writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const linkedOverride = writeWorktreeOverride(linkedContext, "strict", { now: START_TIME });

    expect(readWorktreeOverride(mainContext, { now: START_TIME }).override).toEqual(mainOverride);
    expect(readWorktreeOverride(linkedContext, { now: START_TIME }).override).toEqual(
      linkedOverride,
    );
    expect(mainOverride.profile).toBe("quick");
    expect(linkedOverride.profile).toBe("strict");

    const overrideDirectory = path.dirname(getWorktreeOverridePath(mainContext));
    expect(fs.readdirSync(overrideDirectory).filter((name) => name.includes(".tmp"))).toEqual([]);
    expect(fs.readFileSync(getWorktreeOverridePath(mainContext), "utf8").endsWith("\n")).toBe(true);
  });

  test("an override is invisible in a sibling worktree", () => {
    writeWorktreeOverride(mainContext, "quick", { now: START_TIME });

    expect(readWorktreeOverride(linkedContext, { now: START_TIME })).toEqual({
      override: null,
      diagnostics: [],
      cleanedUp: false,
    });
  });

  test("keeps an override immediately before 24 hours and expires it at the exact boundary (AC-008)", () => {
    const override = writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const expiresAt = new Date(override.expiresAt).getTime();

    expect(readWorktreeOverride(mainContext, { now: expiresAt - 1 }).override?.profile).toBe(
      "quick",
    );

    const expired = readWorktreeOverride(mainContext, {
      now: expiresAt,
      repositoryValidated: true,
    });
    expect(expired.override).toBeNull();
    expect(expired.cleanedUp).toBe(true);
    expect(expired.diagnostics).toMatchObject([
      {
        severity: "warning",
        source: "worktree",
        code: "expired-worktree-override",
        field: "$.expiresAt",
        fallback: "repository",
      },
    ]);
    expect(fs.existsSync(getWorktreeOverridePath(mainContext))).toBe(false);
  });

  test("does not clean an expired override until the caller confirms repository validation", () => {
    const override = writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const expiresAt = new Date(override.expiresAt).getTime();
    const overridePath = getWorktreeOverridePath(mainContext);

    const unvalidatedRead = readWorktreeOverride(mainContext, {
      now: expiresAt,
      repositoryValidated: false,
    });
    expect(unvalidatedRead.override).toBeNull();
    expect(unvalidatedRead.cleanedUp).toBe(false);
    expect(fs.existsSync(overridePath)).toBe(true);

    const validatedRead = readWorktreeOverride(mainContext, {
      now: expiresAt,
      repositoryValidated: true,
    });
    expect(validatedRead.cleanedUp).toBe(true);
    expect(fs.existsSync(overridePath)).toBe(false);
  });

  test("serializes expiry cleanup with a concurrent fresh override write", async () => {
    const expired = writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const overridePath = getWorktreeOverridePath(mainContext);
    const cleanupReadyPath = path.join(temporaryDirectory, "cleanup-ready");
    const cleanupReleasePath = path.join(temporaryDirectory, "cleanup-release");
    const writerAttemptedPath = path.join(temporaryDirectory, "writer-attempted");
    const writerFinishedPath = path.join(temporaryDirectory, "writer-finished");
    const cleanupScriptPath = path.join(temporaryDirectory, "cleanup.mjs");
    const writerScriptPath = path.join(temporaryDirectory, "writer.mjs");
    const context = JSON.stringify(mainContext);
    const expiresAt = Date.parse(expired.expiresAt);
    const freshAt = expiresAt + 1;

    fs.writeFileSync(
      cleanupScriptPath,
      `
        import fs from "node:fs";
        import { readWorktreeOverride } from ${JSON.stringify(WORKTREE_OVERRIDE_MODULE_URL)};
        const context = JSON.parse(process.env.TEST_GIT_CONTEXT);
        const originalUnlink = fs.unlinkSync.bind(fs);
        const sleeper = new Int32Array(new SharedArrayBuffer(4));
        fs.unlinkSync = (target) => {
          if (target === process.env.TEST_OVERRIDE_PATH) {
            fs.writeFileSync(process.env.TEST_CLEANUP_READY_PATH, "ready\\n");
            while (!fs.existsSync(process.env.TEST_CLEANUP_RELEASE_PATH)) {
              Atomics.wait(sleeper, 0, 0, 10);
            }
          }
          return originalUnlink(target);
        };
        readWorktreeOverride(context, {
          now: Number(process.env.TEST_EXPIRES_AT),
          repositoryValidated: true,
        });
      `,
      "utf8",
    );
    fs.writeFileSync(
      writerScriptPath,
      `
        import fs from "node:fs";
        import { writeWorktreeOverride } from ${JSON.stringify(WORKTREE_OVERRIDE_MODULE_URL)};
        const context = JSON.parse(process.env.TEST_GIT_CONTEXT);
        fs.writeFileSync(process.env.TEST_WRITER_ATTEMPTED_PATH, "attempted\\n");
        writeWorktreeOverride(context, "strict", { now: Number(process.env.TEST_FRESH_AT) });
        fs.writeFileSync(process.env.TEST_WRITER_FINISHED_PATH, "finished\\n");
      `,
      "utf8",
    );

    const cleanup = spawn(process.execPath, [cleanupScriptPath], {
      env: {
        ...process.env,
        TEST_GIT_CONTEXT: context,
        TEST_OVERRIDE_PATH: overridePath,
        TEST_CLEANUP_READY_PATH: cleanupReadyPath,
        TEST_CLEANUP_RELEASE_PATH: cleanupReleasePath,
        TEST_EXPIRES_AT: String(expiresAt),
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const cleanupExit = childExit(cleanup);
    await waitForPath(cleanupReadyPath);

    const writer = spawn(process.execPath, [writerScriptPath], {
      env: {
        ...process.env,
        TEST_GIT_CONTEXT: context,
        TEST_WRITER_ATTEMPTED_PATH: writerAttemptedPath,
        TEST_WRITER_FINISHED_PATH: writerFinishedPath,
        TEST_FRESH_AT: String(freshAt),
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    const writerExit = childExit(writer);
    await waitForPath(writerAttemptedPath);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const writerWasSerialized = !fs.existsSync(writerFinishedPath);

    fs.writeFileSync(cleanupReleasePath, "release\n", "utf8");
    const [cleanupResult, writerResult] = await Promise.all([cleanupExit, writerExit]);

    expect(cleanupResult).toEqual({ code: 0, signal: null, stderr: "" });
    expect(writerResult).toEqual({ code: 0, signal: null, stderr: "" });
    expect(writerWasSerialized).toBe(true);
    expect(readWorktreeOverride(mainContext, { now: freshAt }).override?.profile).toBe("strict");
    expect(fs.existsSync(`${overridePath}.lock`)).toBe(false);
  });

  test("recovers a lock abandoned by an exited owner", () => {
    writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const overridePath = getWorktreeOverridePath(mainContext);
    const lockPath = `${overridePath}.lock`;
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
      "utf8",
    );

    const replacement = writeWorktreeOverride(mainContext, "strict", { now: START_TIME });

    expect(replacement.profile).toBe("strict");
    expect(readWorktreeOverride(mainContext, { now: START_TIME }).override).toEqual(replacement);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test("recovers an expired lock lease even when its pid was reused", () => {
    writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const overridePath = getWorktreeOverridePath(mainContext);
    const lockPath = `${overridePath}.lock`;
    fs.writeFileSync(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        token: "expired-owner",
      })}\n`,
      "utf8",
    );

    expect(resetWorktreeOverride(mainContext)).toBe(true);
    expect(fs.existsSync(overridePath)).toBe(false);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test("excludes but preserves malformed state for diagnosis", () => {
    const overridePath = getWorktreeOverridePath(mainContext);
    fs.mkdirSync(path.dirname(overridePath), { recursive: true });
    fs.writeFileSync(overridePath, "{ broken", "utf8");

    const result = readWorktreeOverride(mainContext, {
      now: START_TIME,
      repositoryValidated: true,
    });

    expect(result.override).toBeNull();
    expect(result.cleanedUp).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        severity: "warning",
        source: "worktree",
        code: "invalid-json",
        field: "$",
        fallback: "repository",
      },
    ]);
    expect(fs.existsSync(overridePath)).toBe(true);
  });

  test("rejects writes longer than 24 hours without replacing current state", () => {
    const original = writeWorktreeOverride(mainContext, "standard", { now: START_TIME });

    expect(() =>
      writeWorktreeOverride(mainContext, "quick", {
        now: START_TIME,
        durationMs: MAX_WORKTREE_OVERRIDE_AGE_MS + 1,
      }),
    ).toThrow(WorktreeOverrideValidationError);

    expect(readWorktreeOverride(mainContext, { now: START_TIME }).override).toEqual(original);
  });

  test("reset removes only the current worktree override (AC-012)", () => {
    writeWorktreeOverride(mainContext, "quick", { now: START_TIME });
    const linkedOverride = writeWorktreeOverride(linkedContext, "strict", { now: START_TIME });

    expect(resetWorktreeOverride(mainContext)).toBe(true);
    expect(resetWorktreeOverride(mainContext)).toBe(false);
    expect(readWorktreeOverride(mainContext, { now: START_TIME }).override).toBeNull();
    expect(readWorktreeOverride(linkedContext, { now: START_TIME }).override).toEqual(
      linkedOverride,
    );
  });
});
