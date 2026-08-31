import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveConfiguration } from "../src/configuration.mjs";
import { getDecisionManifestPath, inspectDecisionManifest } from "../src/manifest-store.mjs";
import { discoverGitContext } from "../src/worktree-overrides.mjs";
import { WorkflowDecisionError, resolveWorkflowDecision } from "../src/workflow-resolution.mjs";

const NOW = new Date("2026-08-31T09:00:00.000Z");
const EXPIRES_AT = new Date(NOW.getTime() + 60_000).toISOString();
const POLICY_HASH = `sha256:${"a".repeat(64)}`;

const temporaryDirectories = [];

function createRepository() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-resolution-"));
  temporaryDirectories.push(directory);
  execFileSync("git", ["init", "--initial-branch=main", directory], { stdio: "ignore" });
  fs.writeFileSync(path.join(directory, "README.md"), "fixture\n", "utf8");
  execFileSync("git", ["-C", directory, "add", "README.md"]);
  execFileSync(
    "git",
    [
      "-C",
      directory,
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
  return discoverGitContext(directory);
}

function policyInput(overrides = {}) {
  return {
    configuration: resolveConfiguration({ invocationProfile: "standard" }),
    workflow: "direct-task",
    riskEvidence: [],
    ...overrides,
  };
}

function storedResolution(decision) {
  const handoff = {
    run_id: "run-test-001",
    path: "/tmp/run-test-001.json",
    content_hash: `sha256:${"b".repeat(64)}`,
  };
  return {
    manifest: { runId: handoff.run_id, decision },
    path: handoff.path,
    contentHash: handoff.content_hash,
    handoff,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("canonical workflow decision resolution", () => {
  test("persists one successful policy decision before returning its handoff", () => {
    const writes = [];
    const result = resolveWorkflowDecision(
      {
        gitContext: { gitCommonDir: "/tmp/git", worktreeId: "c".repeat(64) },
        runId: "run-test-001",
        policyHash: POLICY_HASH,
        expiresAt: EXPIRES_AT,
        policyInput: policyInput(),
        expectedRevision: 0,
        now: NOW,
      },
      {
        writeManifest(gitContext, manifestInput, options) {
          writes.push({ gitContext, manifestInput, options });
          return storedResolution(manifestInput.policy);
        },
      },
    );

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      manifestInput: {
        runId: "run-test-001",
        policyHash: POLICY_HASH,
        expiresAt: EXPIRES_AT,
        policy: {
          workflow: "direct-task",
          blocked: false,
        },
      },
      options: { expectedRevision: 0, now: NOW },
    });
    expect(result).toEqual({
      decision: writes[0].manifestInput.policy,
      ...storedResolution(writes[0].manifestInput.policy),
    });
  });

  test("does not write ambiguous or blocked policy results", () => {
    for (const fixture of [
      { workflow: "ambiguous", blocked: false },
      { workflow: "direct-task", blocked: true },
    ]) {
      let writes = 0;
      expect(() =>
        resolveWorkflowDecision(
          {
            gitContext: { gitCommonDir: "/tmp/git", worktreeId: "c".repeat(64) },
            runId: "run-test-001",
            policyHash: POLICY_HASH,
            expiresAt: EXPIRES_AT,
            policyInput: policyInput(),
          },
          {
            resolvePolicy: () => fixture,
            writeManifest: () => {
              writes += 1;
              throw new Error("must not write");
            },
          },
        ),
      ).toThrow(WorkflowDecisionError);
      expect(writes).toBe(0);
    }
  });

  test("writes and reopens a schema-valid manifest in a real temporary repository (AC-036)", () => {
    const gitContext = createRepository();
    const runId = "run-real-001";

    const result = resolveWorkflowDecision({
      gitContext,
      runId,
      policyHash: POLICY_HASH,
      expiresAt: EXPIRES_AT,
      policyInput: policyInput(),
      expectedRevision: 0,
      now: NOW,
    });

    expect(result.path).toBe(getDecisionManifestPath(gitContext, runId));
    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.handoff).toEqual({
      run_id: runId,
      path: result.path,
      content_hash: result.contentHash,
    });
    expect(inspectDecisionManifest(gitContext, runId, { now: NOW })).toMatchObject({
      status: "valid",
      manifest: result.manifest,
      contentHash: result.contentHash,
      handoff: result.handoff,
    });
  });
});
