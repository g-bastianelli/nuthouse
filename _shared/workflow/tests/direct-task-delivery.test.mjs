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
    decision: profile.decision,
    decisionHandoff: FIXTURE.decisionHandoff,
    scope: FIXTURE.scope,
    artifacts: profile.artifacts,
    nativeVerification: FIXTURE.nativeVerification,
    ...overrides,
  });
}

function completionEvidence(preparation) {
  return preparation.verification.commands.map((command) => ({
    command,
    targets: preparation.verification.targets,
    exitStatus: 0,
    summary: `${command} passed`,
  }));
}

function moonScope() {
  return structuredClone(FIXTURE.moonScope);
}

describe("direct-task profile preparation", () => {
  for (const profile of FIXTURE.profiles) {
    test(`${profile.id} requires only its profile preparation (AC-031–AC-033)`, () => {
      const result = prepareDirectTask({
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
      {
        skill: "acid-prophet:write-spec",
        artifact: "spec",
        decisionHandoff: FIXTURE.decisionHandoff,
      },
    ]);

    const planHandoff = prepare({
      decision: strict.decision,
      artifacts: { spec: strict.artifacts.spec },
    });
    expect(planHandoff.handoffs).toEqual([
      {
        skill: "acid-prophet:write-plan",
        artifact: "plan",
        decisionHandoff: FIXTURE.decisionHandoff,
      },
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
    const result = evaluateDirectTaskCompletion({
      preparation,
      changedPaths: ["src/task.mjs", "tests/task.test.mjs"],
      evidence: completionEvidence(preparation),
    });

    expect(result).toMatchObject({ status: "completed", blocked: false });
    expect(result.evidence).toHaveLength(2);
  });

  test("blocks missing, failed, malformed, or synthetic evidence (AC-035)", () => {
    const preparation = prepare();
    const valid = completionEvidence(preparation);
    for (const evidence of [
      [],
      valid.slice(0, 1),
      valid.map((entry, index) => (index === 0 ? { ...entry, exitStatus: 1 } : entry)),
      valid.map((entry, index) => (index === 0 ? { ...entry, summary: "" } : entry)),
      valid.map((entry, index) => (index === 0 ? { ...entry, command: "model guessed" } : entry)),
    ]) {
      expect(
        evaluateDirectTaskCompletion({
          preparation,
          changedPaths: ["src/task.mjs"],
          evidence,
        }),
      ).toMatchObject({ status: "blocked", blocked: true });
    }
  });

  test("blocks implementation scope expansion and protected-path mutation", () => {
    const preparation = prepare();
    for (const changedPaths of [[], ["src/other.mjs"], ["README.md"]]) {
      const result = evaluateDirectTaskCompletion({
        preparation,
        changedPaths,
        evidence: completionEvidence(preparation),
      });

      expect(result).toMatchObject({ status: "blocked", blocked: true });
      expect(["invalid-changed-paths", "implementation-scope-expanded"]).toContain(
        result.diagnostics[0].code,
      );
    }
  });

  test("requires Moon evidence to name the affected targets (AC-034)", () => {
    const preparation = prepare({
      scope: moonScope(),
      specializedVerifier: FIXTURE.moonVerifier,
      nativeVerification: undefined,
    });

    const evidence = completionEvidence(preparation).map((entry) => ({
      ...entry,
      targets: ["other"],
    }));
    expect(
      evaluateDirectTaskCompletion({
        preparation,
        changedPaths: ["apps/app/src/task.mjs"],
        evidence,
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

    for (const preparation of cases) {
      expect(
        evaluateDirectTaskCompletion({
          preparation,
          changedPaths: ["src/task.mjs"],
          evidence: [],
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
        evidence: [
          {
            command: validMoonPreparation.verification.commands[0],
            targets: ["other"],
            exitStatus: 0,
            summary: "unrelated target passed",
          },
        ],
      }),
    ).toMatchObject({
      status: "blocked",
      diagnostics: [expect.objectContaining({ code: "invalid-direct-task-preparation" })],
    });
  });
});
