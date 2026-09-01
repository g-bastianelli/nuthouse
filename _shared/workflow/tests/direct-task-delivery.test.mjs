import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { evaluateDirectTaskCompletion, prepareDirectTask } from "../src/direct-task-delivery.mjs";

const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dir, "..", "fixtures", "direct-task-delivery.json"),
    "utf8",
  ),
);

function prepare(overrides = {}) {
  const profile = FIXTURE.profiles.find((entry) => entry.id === "quick");
  return prepareDirectTask({
    task: FIXTURE.task,
    decision: profile.decision,
    decisionHandoff: FIXTURE.decisionHandoff,
    scope: FIXTURE.scope,
    artifacts: profile.artifacts,
    nativeVerification: FIXTURE.nativeVerification,
    ...overrides,
  });
}

function completionPacket(preparation, changedPaths = FIXTURE.scope.approvedPaths) {
  const snapshot = {
    head_oid: "1111111111111111111111111111111111111111",
    worktree_snapshot_hash:
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    changed_paths: changedPaths,
    verified_files: changedPaths.map((filePath, index) => ({
      path: filePath,
      type: "regular-file",
      mode: "0644",
      before_hash: null,
      verified_content_hash: `sha256:${String(index + 1).repeat(64)}`,
    })),
  };
  return {
    currentSnapshot: structuredClone(snapshot),
    evidence: {
      run_id: preparation.decisionHandoff.run_id,
      decision_content_hash: preparation.decisionHandoff.content_hash,
      ...snapshot,
      results: preparation.verification.commands.map((command) => ({
        command,
        targets: preparation.verification.targets,
        exitStatus: 0,
        summary: `${command} passed`,
      })),
    },
  };
}

function moonScope() {
  return structuredClone(FIXTURE.moonScope);
}

describe("direct-task profile preparation", () => {
  for (const profile of FIXTURE.profiles) {
    test(`${profile.id} requires only its profile preparation (AC-031–AC-033)`, () => {
      const result = prepareDirectTask({
        task: FIXTURE.task,
        decision: profile.decision,
        decisionHandoff: FIXTURE.decisionHandoff,
        scope: FIXTURE.scope,
        artifacts: profile.artifacts,
        nativeVerification: FIXTURE.nativeVerification,
      });

      expect(result).toMatchObject(profile.expected);
      expect(result.decisionHandoff).toEqual(FIXTURE.decisionHandoff);
      expect(result.verification).toMatchObject({
        status: "ready",
        strategy: "native",
        commands: ["bun run lint", "bun test"],
        targets: ["repository"],
      });
    });
  }

  test("quick does not require a persistent spec or plan (AC-031)", () => {
    expect(prepare()).toMatchObject({
      status: "ready",
      preparation: "ephemeral-scope",
      requiredArtifacts: [],
    });
  });

  test("standard blocks until its compact plan covers scope and checks (AC-032)", () => {
    const standard = FIXTURE.profiles.find((entry) => entry.id === "standard");
    for (const compactPlan of [
      undefined,
      { ...standard.artifacts.compactPlan, affectedPaths: ["src/task.mjs"] },
      { ...standard.artifacts.compactPlan, verificationCommands: ["bun test"] },
      { ...standard.artifacts.compactPlan, steps: [] },
      { ...standard.artifacts.compactPlan, risks: [] },
    ]) {
      const result = prepare({
        decision: standard.decision,
        artifacts: compactPlan === undefined ? {} : { compactPlan },
      });

      expect(result).toMatchObject({ status: "blocked", blocked: true });
      expect(result.diagnostics[0].code).toBe("compact-plan-required");
    }
  });

  test("strict emits ordered Acid Prophet owner handoffs and preserves decision identity (AC-033)", () => {
    const strict = FIXTURE.profiles.find((entry) => entry.id === "strict");
    const specHandoff = prepare({ decision: strict.decision, artifacts: {} });
    expect(specHandoff).toMatchObject({ status: "handoff-required", blocked: true });
    expect(specHandoff.handoffs).toEqual([
      expect.objectContaining({
        skill: "acid-prophet:write-spec",
        artifact: "spec",
        decisionHandoff: FIXTURE.decisionHandoff,
        input: expect.objectContaining({
          schemaVersion: 1,
          workflow: "direct-task",
          effectiveProfile: "strict",
          task: FIXTURE.task,
          scope: FIXTURE.scope,
          decisionHandoff: FIXTURE.decisionHandoff,
          upstreamArtifacts: [],
          returnTarget: { kind: "current-turn", name: "direct-task" },
        }),
      }),
    ]);

    const planHandoff = prepare({
      decision: strict.decision,
      artifacts: { spec: strict.artifacts.spec },
    });
    expect(planHandoff.handoffs).toEqual([
      expect.objectContaining({
        skill: "acid-prophet:write-plan",
        artifact: "plan",
        decisionHandoff: FIXTURE.decisionHandoff,
        input: expect.objectContaining({
          schemaVersion: 1,
          workflow: "direct-task",
          effectiveProfile: "strict",
          task: FIXTURE.task,
          upstreamArtifacts: [strict.artifacts.spec],
          returnTarget: { kind: "current-turn", name: "direct-task" },
        }),
      }),
    ]);

    const changedIdentity = {
      ...strict.artifacts.plan,
      decisionHandoff: { ...FIXTURE.decisionHandoff, run_id: "other-run" },
    };
    expect(
      prepare({
        decision: strict.decision,
        artifacts: { ...strict.artifacts, plan: changedIdentity },
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "artifact-handoff-mismatch" })],
    });
  });

  test("rejects a blocked or non-direct decision and a missing verification gate", () => {
    for (const decision of [
      { workflow: "issue-delivery", effectiveProfile: "quick", blocked: false },
      { workflow: "direct-task", effectiveProfile: "quick", blocked: true },
      {
        workflow: "direct-task",
        effectiveProfile: "quick",
        enabledCapabilities: [],
        blocked: false,
      },
    ]) {
      expect(prepare({ decision })).toMatchObject({ status: "blocked", blocked: true });
    }
  });

  test("malformed top-level input fails closed without throwing", () => {
    expect(prepareDirectTask(null)).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "invalid-direct-task-input" })],
    });
    expect(prepareDirectTask({})).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "invalid-direct-task-request" })],
    });
  });
});

describe("direct-task scope and verification", () => {
  test("Moon workspaces consume the canonical scope map and require Moon verification (AC-034)", () => {
    const scope = moonScope();
    const specializedVerifier = FIXTURE.moonVerifier;

    expect(prepare({ scope, specializedVerifier, nativeVerification: undefined })).toMatchObject({
      status: "ready",
      scope: {
        moon: {
          changedFiles: scope.moon.changedFiles,
          affected: scope.moon.affected,
        },
      },
      verification: {
        strategy: "specialized",
        verifier: "moon-moth:verify",
        targets: ["app", "shared", "web"],
      },
    });

    expect(
      prepare({
        scope: { ...FIXTURE.scope, moonWorkspace: true },
        specializedVerifier,
        nativeVerification: undefined,
      }),
    ).toMatchObject({
      status: "handoff-required",
      handoffs: [expect.objectContaining({ skill: "moon-moth:scope" })],
    });

    expect(prepare({ scope, specializedVerifier: undefined })).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "verification-strategy-unavailable" })],
    });
  });

  test("binds Moon verifier targets and approved paths to the affected graph (AC-034)", () => {
    const scope = moonScope();
    const verifier = FIXTURE.moonVerifier;

    expect(
      prepare({
        scope,
        specializedVerifier: { ...verifier, targets: ["other"] },
        nativeVerification: undefined,
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "moon-verifier-target-mismatch" })],
    });
    expect(
      prepare({
        scope: { ...scope, approvedPaths: [...scope.approvedPaths, "tools/outside.mjs"] },
        specializedVerifier: verifier,
        nativeVerification: undefined,
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "scope-outside-moon-graph" })],
    });
  });

  test("turns a clean Moon scope into a planned-path scope handoff (AC-034)", () => {
    const handoff = prepare({
      scope: FIXTURE.darkMoonScope,
      specializedVerifier: undefined,
      nativeVerification: undefined,
    });
    expect(handoff).toMatchObject({
      status: "handoff-required",
      handoffs: [
        {
          skill: "moon-moth:scope",
          artifact: "planned-affected-scope",
          decisionHandoff: FIXTURE.decisionHandoff,
          input: {
            schemaVersion: 1,
            workflow: "direct-task",
            mode: "planned-paths",
            approvedPaths: FIXTURE.darkMoonScope.approvedPaths,
            decisionHandoff: FIXTURE.decisionHandoff,
            returnTarget: { kind: "current-turn", name: "direct-task" },
          },
        },
      ],
    });

    const plannedVerifier = { ...FIXTURE.moonVerifier, targets: ["app", "web"] };
    expect(
      prepare({
        scope: FIXTURE.plannedMoonScope,
        specializedVerifier: plannedVerifier,
        nativeVerification: undefined,
      }),
    ).toMatchObject({
      status: "ready",
      scope: { moon: { base: "planned-paths", changedFiles: [] } },
      verification: { targets: ["app", "web"] },
    });
  });

  test("non-Moon workspaces use native checks and never require Moon (AC-034, AC-035)", () => {
    const result = prepare({
      specializedVerifier: {
        id: "moon-moth:verify",
        available: true,
        commands: ["moon run :test --affected"],
        targets: ["app"],
      },
    });

    expect(result.verification).toMatchObject({
      strategy: "native",
      verifier: "repository-owned",
      commands: ["bun run lint", "bun test"],
    });
    expect(result.handoffs).toEqual([]);

    expect(
      prepare({
        nativeVerification: {
          source: "repository-instructions",
          commands: ["bun test"],
        },
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "native-verification-provenance-required" })],
    });
  });

  test("blocks ambiguous or overlapping boundaries before implementation", () => {
    for (const scope of [
      { approvedPaths: [], protectedPaths: [], moonWorkspace: false },
      {
        approvedPaths: ["src/task.mjs"],
        protectedPaths: ["src/task.mjs"],
        moonWorkspace: false,
      },
      {
        approvedPaths: ["src"],
        protectedPaths: ["src/generated"],
        moonWorkspace: false,
      },
      {
        approvedPaths: ["src/generated/task.mjs"],
        protectedPaths: ["src/generated"],
        moonWorkspace: false,
      },
      {
        approvedPaths: ["../outside.mjs"],
        protectedPaths: [],
        moonWorkspace: false,
      },
    ]) {
      expect(prepare({ scope })).toMatchObject({ status: "blocked", blocked: true });
    }
  });
});

describe("direct-task completion evidence", () => {
  test("completes only with passing evidence for every selected command (AC-031, AC-035)", () => {
    const preparation = prepare();
    const packet = completionPacket(preparation);
    const result = evaluateDirectTaskCompletion({
      preparation,
      changedPaths: ["src/task.mjs", "tests/task.test.mjs"],
      ...packet,
    });

    expect(result).toMatchObject({ status: "completed", blocked: false });
    expect(result.evidence.results).toHaveLength(2);
  });

  test("blocks missing, failed, malformed, or synthetic evidence (AC-035)", () => {
    const preparation = prepare();
    const packet = completionPacket(preparation, ["src/task.mjs"]);
    const valid = packet.evidence;
    for (const evidence of [
      null,
      { ...valid, results: [] },
      { ...valid, results: valid.results.slice(0, 1) },
      {
        ...valid,
        results: valid.results.map((entry, index) =>
          index === 0 ? { ...entry, exitStatus: 1 } : entry,
        ),
      },
      {
        ...valid,
        results: valid.results.map((entry, index) =>
          index === 0 ? { ...entry, summary: "" } : entry,
        ),
      },
      {
        ...valid,
        results: valid.results.map((entry, index) =>
          index === 0 ? { ...entry, command: "model guessed" } : entry,
        ),
      },
    ]) {
      expect(
        evaluateDirectTaskCompletion({
          preparation,
          changedPaths: ["src/task.mjs"],
          evidence,
          currentSnapshot: packet.currentSnapshot,
        }),
      ).toMatchObject({ status: "blocked", blocked: true });
    }
  });

  test("blocks implementation scope expansion and protected-path mutation", () => {
    const preparation = prepare();
    for (const changedPaths of [[], ["src/other.mjs"], ["README.md"]]) {
      const packet = completionPacket(
        preparation,
        changedPaths.length === 0 ? ["src/task.mjs"] : changedPaths,
      );
      const result = evaluateDirectTaskCompletion({
        preparation,
        changedPaths,
        ...packet,
      });

      expect(result).toMatchObject({ status: "blocked", blocked: true });
      expect(["invalid-changed-paths", "implementation-scope-expanded"]).toContain(
        result.diagnostics[0].code,
      );
    }
  });

  test("treats approved and protected entries as segment-aware path boundaries", () => {
    const preparation = prepare({
      scope: {
        approvedPaths: ["src"],
        protectedPaths: ["docs"],
        moonWorkspace: false,
      },
    });
    const packet = completionPacket(preparation, ["src/nested/task.mjs"]);
    expect(
      evaluateDirectTaskCompletion({
        preparation,
        changedPaths: ["src/nested/task.mjs"],
        ...packet,
      }),
    ).toMatchObject({ status: "completed", blocked: false });

    const protectedFile = {
      path: "docs/local-notes.md",
      type: "regular-file",
      mode: "0644",
      before_hash: "sha256:7777777777777777777777777777777777777777777777777777777777777777",
      verified_content_hash:
        "sha256:7777777777777777777777777777777777777777777777777777777777777777",
    };
    const protectedContext = {
      evidence: {
        ...packet.evidence,
        worktree_snapshot_hash:
          "sha256:abababababababababababababababababababababababababababababababab",
        changed_paths: [...packet.evidence.changed_paths, protectedFile.path],
        verified_files: [...packet.evidence.verified_files, protectedFile],
      },
      currentSnapshot: {
        ...packet.currentSnapshot,
        worktree_snapshot_hash:
          "sha256:abababababababababababababababababababababababababababababababab",
        changed_paths: [...packet.currentSnapshot.changed_paths, protectedFile.path],
        verified_files: [...packet.currentSnapshot.verified_files, protectedFile],
      },
    };
    expect(
      evaluateDirectTaskCompletion({
        preparation,
        changedPaths: ["src/nested/task.mjs"],
        ...protectedContext,
      }),
    ).toMatchObject({ status: "completed", blocked: false });

    const protectedPacket = completionPacket(preparation, ["docs/generated/task.mjs"]);
    expect(
      evaluateDirectTaskCompletion({
        preparation,
        changedPaths: ["docs/generated/task.mjs"],
        ...protectedPacket,
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "implementation-scope-expanded" })],
    });
  });

  test("rejects stale or cross-run verification snapshots", () => {
    const preparation = prepare();
    const packet = completionPacket(preparation, ["src/task.mjs"]);
    for (const mutation of [
      {
        evidence: packet.evidence,
        currentSnapshot: {
          ...packet.currentSnapshot,
          worktree_snapshot_hash:
            "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        },
      },
      {
        evidence: { ...packet.evidence, run_id: "another-run" },
        currentSnapshot: packet.currentSnapshot,
      },
      {
        evidence: {
          ...packet.evidence,
          decision_content_hash:
            "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
        currentSnapshot: packet.currentSnapshot,
      },
      {
        evidence: {
          ...packet.evidence,
          verified_files: [
            ...packet.evidence.verified_files,
            {
              path: "src/unrelated.mjs",
              type: "regular-file",
              mode: "0644",
              before_hash: null,
              verified_content_hash:
                "sha256:9999999999999999999999999999999999999999999999999999999999999999",
            },
          ],
        },
        currentSnapshot: {
          ...packet.currentSnapshot,
          verified_files: [
            ...packet.currentSnapshot.verified_files,
            {
              path: "src/unrelated.mjs",
              type: "regular-file",
              mode: "0644",
              before_hash: null,
              verified_content_hash:
                "sha256:9999999999999999999999999999999999999999999999999999999999999999",
            },
          ],
        },
      },
    ]) {
      expect(
        evaluateDirectTaskCompletion({
          preparation,
          changedPaths: ["src/task.mjs"],
          ...mutation,
        }),
      ).toMatchObject({
        status: "blocked",
        diagnostics: [expect.objectContaining({ code: "verification-snapshot-mismatch" })],
      });
    }
  });

  test("requires Moon evidence to name the affected targets (AC-034)", () => {
    const preparation = prepare({
      scope: moonScope(),
      specializedVerifier: FIXTURE.moonVerifier,
      nativeVerification: undefined,
    });

    const packet = completionPacket(preparation, ["apps/app/src/task.mjs"]);
    const evidence = {
      ...packet.evidence,
      results: packet.evidence.results.map((entry) => ({ ...entry, targets: ["other"] })),
    };
    expect(
      evaluateDirectTaskCompletion({
        preparation,
        changedPaths: ["apps/app/src/task.mjs"],
        evidence,
        currentSnapshot: packet.currentSnapshot,
      }),
    ).toMatchObject({ status: "blocked", blocked: true });
  });

  test("rejects incomplete or forged ready preparations before evaluating evidence", () => {
    const validPreparation = prepare();
    const standardProfile = FIXTURE.profiles.find((entry) => entry.id === "standard");
    const strictProfile = FIXTURE.profiles.find((entry) => entry.id === "strict");
    const standardPreparation = prepare({
      decision: standardProfile.decision,
      artifacts: standardProfile.artifacts,
    });
    const strictPreparation = prepare({
      decision: strictProfile.decision,
      artifacts: strictProfile.artifacts,
    });
    const cases = [
      { status: "ready" },
      { ...validPreparation, requiredArtifacts: ["spec"] },
      { ...validPreparation, artifacts: null },
      {
        ...validPreparation,
        verification: {
          ...validPreparation.verification,
          commands: [],
          targets: [],
          provenance: [],
        },
      },
      {
        ...validPreparation,
        verification: { ...validPreparation.verification, provenance: [] },
      },
      {
        ...standardPreparation,
        artifacts: {
          compactPlan: { ...standardPreparation.artifacts.compactPlan, steps: [] },
        },
      },
      {
        ...strictPreparation,
        artifacts: {
          ...strictPreparation.artifacts,
          spec: { ...strictPreparation.artifacts.spec, audited: false },
        },
      },
    ];
    const packet = completionPacket(validPreparation, ["src/task.mjs"]);

    for (const preparation of cases) {
      expect(
        evaluateDirectTaskCompletion({
          preparation,
          changedPaths: ["src/task.mjs"],
          ...packet,
        }),
      ).toMatchObject({
        status: "blocked",
        diagnostics: [expect.objectContaining({ code: "invalid-direct-task-preparation" })],
      });
    }

    const validMoonPreparation = prepare({
      scope: moonScope(),
      specializedVerifier: FIXTURE.moonVerifier,
      nativeVerification: undefined,
    });
    const staleMoonPreparation = {
      ...validMoonPreparation,
      verification: { ...validMoonPreparation.verification, targets: ["other"] },
    };
    expect(
      evaluateDirectTaskCompletion({
        preparation: staleMoonPreparation,
        changedPaths: ["apps/app/src/task.mjs"],
        ...completionPacket(validMoonPreparation, ["apps/app/src/task.mjs"]),
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "invalid-direct-task-preparation" })],
    });
  });
});
