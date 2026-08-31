import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveConfiguration } from "../src/configuration.mjs";
import { ManifestHandoffError, consumeManifestHandoff } from "../src/manifest-handoff.mjs";
import { discoverGitContext } from "../src/worktree-overrides.mjs";
import { resolveWorkflowDecision } from "../src/workflow-resolution.mjs";

const NOW = new Date("2026-08-31T09:00:00.000Z");
const EXPIRES_AT = new Date(NOW.getTime() + 60_000).toISOString();
const POLICY_HASH = `sha256:${"a".repeat(64)}`;
const ACTUAL_CONTENT_HASH = `sha256:${"b".repeat(64)}`;
const REPLACEMENT_CONTENT_HASH = `sha256:${"c".repeat(64)}`;
const RUN_ID = "run-handoff-001";
const EXPECTED_PATH = `/tmp/nuthouse/workflow/runs/${RUN_ID}.json`;
const GIT_CONTEXT = { gitCommonDir: "/tmp/git", worktreeId: "d".repeat(64) };

const DECISION = {
  workflow: "direct-task",
  requestedProfile: "standard",
  riskFloor: "standard",
  effectiveProfile: "standard",
  normalizedEvidence: [],
  activeRisks: [],
  escalations: [],
  enabledCapabilities: ["verification"],
};

const temporaryDirectories = [];

function manifest(overrides = {}) {
  return {
    runId: RUN_ID,
    policyHash: POLICY_HASH,
    revision: 1,
    decision: DECISION,
    ...overrides,
  };
}

function handoff(overrides = {}) {
  return {
    run_id: RUN_ID,
    path: EXPECTED_PATH,
    content_hash: ACTUAL_CONTENT_HASH,
    ...overrides,
  };
}

function validInspection(overrides = {}) {
  const currentManifest = manifest(overrides.manifest);
  const contentHash = overrides.contentHash ?? ACTUAL_CONTENT_HASH;
  return {
    status: "valid",
    path: EXPECTED_PATH,
    contentHash,
    manifest: currentManifest,
    handoff: {
      run_id: currentManifest.runId,
      path: EXPECTED_PATH,
      content_hash: contentHash,
    },
    diagnostics: [],
  };
}

function replacementWrite(decision = DECISION) {
  const replacementManifest = manifest({ revision: 2, decision });
  return {
    manifest: replacementManifest,
    path: EXPECTED_PATH,
    contentHash: REPLACEMENT_CONTENT_HASH,
    handoff: {
      run_id: RUN_ID,
      path: EXPECTED_PATH,
      content_hash: REPLACEMENT_CONTENT_HASH,
    },
  };
}

function createRepository() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-handoff-"));
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

function policyInput() {
  return {
    configuration: resolveConfiguration({ invocationProfile: "standard" }),
    workflow: "direct-task",
    riskEvidence: [],
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("manifest handoff reuse", () => {
  test("returns the persisted decision without invoking the authoritative resolver (AC-038)", () => {
    let resolverCalls = 0;
    const result = consumeManifestHandoff(
      {
        handoff: handoff(),
        gitContext: GIT_CONTEXT,
        policyHash: POLICY_HASH,
        now: NOW,
      },
      {
        getManifestPath: () => EXPECTED_PATH,
        inspectManifest: () => validInspection(),
        resolveAuthoritatively: () => {
          resolverCalls += 1;
          throw new Error("must not resolve");
        },
      },
    );

    expect(resolverCalls).toBe(0);
    expect(result).toEqual({
      decision: DECISION,
      manifest: manifest(),
      path: EXPECTED_PATH,
      contentHash: ACTUAL_CONTENT_HASH,
      handoff: handoff(),
      reused: true,
    });
  });

  test("rejects malformed and path-tampered descriptors before filesystem access", () => {
    for (const descriptor of [
      handoff({ run_id: "../escape" }),
      handoff({ run_id: "run-handoff-002" }),
      handoff({ path: "/tmp/other-run.json" }),
    ]) {
      let inspections = 0;
      let resolverCalls = 0;
      expect(() =>
        consumeManifestHandoff(
          {
            handoff: descriptor,
            gitContext: GIT_CONTEXT,
            policyHash: POLICY_HASH,
            now: NOW,
          },
          {
            getManifestPath: (_gitContext, runId) => `/tmp/nuthouse/workflow/runs/${runId}.json`,
            inspectManifest: () => {
              inspections += 1;
              throw new Error("must not inspect");
            },
            resolveAuthoritatively: () => {
              resolverCalls += 1;
              throw new Error("must not resolve");
            },
          },
        ),
      ).toThrow(ManifestHandoffError);
      expect(inspections).toBe(0);
      expect(resolverCalls).toBe(0);
    }
  });

  test("blocks exact runtime drift before reuse or re-resolution (AC-040)", () => {
    const producerPolicyHash = `sha256:${"e".repeat(64)}`;
    for (const inspection of [
      validInspection({ manifest: { policyHash: producerPolicyHash } }),
      {
        status: "expired",
        path: EXPECTED_PATH,
        contentHash: ACTUAL_CONTENT_HASH,
        manifest: manifest({ policyHash: producerPolicyHash }),
        handoff: null,
        diagnostics: [],
      },
      {
        status: "out-of-scope",
        path: EXPECTED_PATH,
        contentHash: ACTUAL_CONTENT_HASH,
        manifest: manifest({ policyHash: producerPolicyHash }),
        handoff: null,
        diagnostics: [],
      },
    ]) {
      let resolverCalls = 0;
      expect(() =>
        consumeManifestHandoff(
          {
            handoff: handoff(),
            gitContext: GIT_CONTEXT,
            policyHash: POLICY_HASH,
            now: NOW,
          },
          {
            getManifestPath: () => EXPECTED_PATH,
            inspectManifest: () => inspection,
            resolveAuthoritatively: () => {
              resolverCalls += 1;
              return DECISION;
            },
          },
        ),
      ).toThrow(expect.objectContaining({ code: "runtime-drift" }));
      expect(resolverCalls).toBe(0);
    }
  });
});

describe("one-shot authoritative manifest recovery", () => {
  const recoverableStates = [
    {
      name: "missing",
      inspection: {
        status: "missing",
        path: EXPECTED_PATH,
        contentHash: null,
        manifest: null,
        handoff: null,
        diagnostics: [],
      },
      writeOptions: { expectedRevision: 0, now: NOW },
    },
    {
      name: "expired",
      inspection: {
        status: "expired",
        path: EXPECTED_PATH,
        contentHash: ACTUAL_CONTENT_HASH,
        manifest: manifest({ revision: 3 }),
        handoff: null,
        diagnostics: [],
      },
      writeOptions: {
        expectedRevision: 3,
        now: NOW,
        observedContentHash: ACTUAL_CONTENT_HASH,
      },
    },
    {
      name: "corrupt",
      inspection: {
        status: "corrupt",
        path: EXPECTED_PATH,
        contentHash: ACTUAL_CONTENT_HASH,
        manifest: null,
        handoff: null,
        diagnostics: [],
      },
      writeOptions: {
        expectedRevision: 0,
        now: NOW,
        observedContentHash: ACTUAL_CONTENT_HASH,
      },
    },
    {
      name: "invalid",
      inspection: {
        status: "invalid",
        path: EXPECTED_PATH,
        contentHash: ACTUAL_CONTENT_HASH,
        manifest: null,
        handoff: null,
        diagnostics: [],
      },
      writeOptions: {
        expectedRevision: 0,
        now: NOW,
        observedContentHash: ACTUAL_CONTENT_HASH,
      },
    },
    {
      name: "out-of-scope",
      inspection: {
        status: "out-of-scope",
        path: EXPECTED_PATH,
        contentHash: ACTUAL_CONTENT_HASH,
        manifest: manifest({ revision: 4 }),
        handoff: null,
        diagnostics: [],
      },
      writeOptions: {
        expectedRevision: 4,
        now: NOW,
        observedContentHash: ACTUAL_CONTENT_HASH,
      },
    },
    {
      name: "content hash mismatch",
      inspection: validInspection(),
      descriptor: handoff({ content_hash: `sha256:${"f".repeat(64)}` }),
      writeOptions: {
        expectedRevision: 1,
        now: NOW,
        observedContentHash: ACTUAL_CONTENT_HASH,
      },
    },
  ];

  for (const fixture of recoverableStates) {
    test(`calls the resolver exactly once and persists/reopens one replacement for ${fixture.name}`, () => {
      let resolverCalls = 0;
      const writes = [];
      const inspections = [
        fixture.inspection,
        validInspection({
          contentHash: REPLACEMENT_CONTENT_HASH,
          manifest: { revision: 2 },
        }),
      ];
      const result = consumeManifestHandoff(
        {
          handoff: fixture.descriptor ?? handoff(),
          gitContext: GIT_CONTEXT,
          policyHash: POLICY_HASH,
          now: NOW,
          replacement: { expiresAt: EXPIRES_AT, artifacts: [] },
        },
        {
          getManifestPath: () => EXPECTED_PATH,
          inspectManifest: () => inspections.shift(),
          resolveAuthoritatively: () => {
            resolverCalls += 1;
            return DECISION;
          },
          writeManifest(gitContext, manifestInput, options) {
            writes.push({ gitContext, manifestInput, options });
            return replacementWrite(manifestInput.policy);
          },
        },
      );

      expect(resolverCalls).toBe(1);
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({
        manifestInput: {
          runId: RUN_ID,
          policy: DECISION,
          policyHash: POLICY_HASH,
          expiresAt: EXPIRES_AT,
          artifacts: [],
        },
        options: fixture.writeOptions,
      });
      expect(result).toMatchObject({
        decision: DECISION,
        contentHash: REPLACEMENT_CONTENT_HASH,
        reused: false,
      });
    });
  }

  test("does not retry a throwing or blocked authoritative fallback", () => {
    for (const resolver of [
      () => {
        throw new Error("authoritative resolver failed");
      },
      () => ({ ...DECISION, blocked: true }),
      () => ({ ...DECISION, workflow: "ambiguous" }),
    ]) {
      let resolverCalls = 0;
      let writes = 0;
      expect(() =>
        consumeManifestHandoff(
          {
            handoff: handoff(),
            gitContext: GIT_CONTEXT,
            policyHash: POLICY_HASH,
            now: NOW,
            replacement: { expiresAt: EXPIRES_AT },
          },
          {
            getManifestPath: () => EXPECTED_PATH,
            inspectManifest: () => ({
              status: "missing",
              path: EXPECTED_PATH,
              contentHash: null,
              manifest: null,
              handoff: null,
              diagnostics: [],
            }),
            resolveAuthoritatively: (context) => {
              resolverCalls += 1;
              return resolver(context);
            },
            writeManifest: () => {
              writes += 1;
              throw new Error("must not write");
            },
          },
        ),
      ).toThrow();
      expect(resolverCalls).toBe(1);
      expect(writes).toBe(0);
    }
  });

  test("requires a pure decision so fallback agreement is checked before persistence", () => {
    let resolverCalls = 0;
    let writes = 0;
    expect(() =>
      consumeManifestHandoff(
        {
          handoff: handoff(),
          gitContext: GIT_CONTEXT,
          policyHash: POLICY_HASH,
          now: NOW,
          replacement: { expiresAt: EXPIRES_AT },
        },
        {
          getManifestPath: () => EXPECTED_PATH,
          inspectManifest: () => ({
            status: "missing",
            path: EXPECTED_PATH,
            contentHash: null,
            manifest: null,
            handoff: null,
            diagnostics: [],
          }),
          resolveAuthoritatively: (context) => {
            resolverCalls += 1;
            expect(context).toMatchObject({
              reason: "missing",
              expectedRevision: 0,
              observedContentHash: undefined,
            });
            return { decision: DECISION, ...replacementWrite(DECISION) };
          },
          writeManifest: () => {
            writes += 1;
            throw new Error("must not write");
          },
        },
      ),
    ).toThrow(expect.objectContaining({ code: "invalid-workflow-resolution" }));
    expect(resolverCalls).toBe(1);
    expect(writes).toBe(0);
  });

  test("blocks a fallback that disagrees with a structurally valid prior decision", () => {
    let resolverCalls = 0;
    let writes = 0;
    expect(() =>
      consumeManifestHandoff(
        {
          handoff: handoff(),
          gitContext: GIT_CONTEXT,
          policyHash: POLICY_HASH,
          now: NOW,
          replacement: { expiresAt: EXPIRES_AT },
        },
        {
          getManifestPath: () => EXPECTED_PATH,
          inspectManifest: () => ({
            status: "expired",
            path: EXPECTED_PATH,
            contentHash: ACTUAL_CONTENT_HASH,
            manifest: manifest(),
            handoff: null,
            diagnostics: [],
          }),
          resolveAuthoritatively: () => {
            resolverCalls += 1;
            return { ...DECISION, effectiveProfile: "strict" };
          },
          writeManifest: () => {
            writes += 1;
            throw new Error("must not write");
          },
        },
      ),
    ).toThrow(expect.objectContaining({ code: "workflow-decision-disagreement" }));
    expect(resolverCalls).toBe(1);
    expect(writes).toBe(0);
  });
});

describe("manifest handoff integration", () => {
  test("reuses a real manifest, then recovers one corrupt replacement exactly once", () => {
    const gitContext = createRepository();
    const persisted = resolveWorkflowDecision({
      gitContext,
      runId: RUN_ID,
      policyHash: POLICY_HASH,
      expiresAt: EXPIRES_AT,
      policyInput: policyInput(),
      expectedRevision: 0,
      now: NOW,
    });
    let resolverCalls = 0;

    const reused = consumeManifestHandoff(
      {
        handoff: persisted.handoff,
        gitContext,
        policyHash: POLICY_HASH,
        now: NOW,
      },
      {
        resolveAuthoritatively: () => {
          resolverCalls += 1;
          return persisted.decision;
        },
      },
    );

    expect(reused.decision).toEqual(persisted.decision);
    expect(reused.reused).toBe(true);
    expect(resolverCalls).toBe(0);

    fs.writeFileSync(persisted.path, "{ broken\n", "utf8");
    const recovered = consumeManifestHandoff(
      {
        handoff: persisted.handoff,
        gitContext,
        policyHash: POLICY_HASH,
        now: NOW,
        replacement: { expiresAt: EXPIRES_AT },
      },
      {
        resolveAuthoritatively: () => {
          resolverCalls += 1;
          return persisted.decision;
        },
      },
    );

    expect(recovered.decision).toEqual(persisted.decision);
    expect(recovered.reused).toBe(false);
    expect(resolverCalls).toBe(1);
  });
});
