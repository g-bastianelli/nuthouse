import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveConfiguration, resolveWorkflowPolicy } from "../src/index.mjs";
import {
  DECISION_MANIFEST_SCHEMA_VERSION,
  DecisionManifestValidationError,
  createDecisionManifest,
  createManifestHandoff,
  deriveRepositoryId,
  hashDecisionManifestContent,
  serializeDecisionManifest,
  validateDecisionManifest,
  validateManifestHandoff,
} from "../src/manifest-schema.mjs";

const RUN_ID = "123e4567-e89b-12d3-a456-426614174000";
const REPOSITORY_ID = "a".repeat(64);
const WORKTREE_ID = "b".repeat(64);
const POLICY_HASH = `sha256:${"c".repeat(64)}`;
const ARTIFACT_HASH = `sha256:${"d".repeat(64)}`;
const CREATED_AT = "2026-08-31T08:00:00.000Z";
const UPDATED_AT = "2026-08-31T08:00:00.000Z";
const EXPIRES_AT = "2026-08-31T09:00:00.000Z";

function successfulPolicy() {
  return resolveWorkflowPolicy({
    configuration: resolveConfiguration({ invocationProfile: "quick" }),
    workflow: "issue-delivery",
    riskEvidence: [
      {
        category: "security",
        source: "repository-rule",
        state: "confirmed",
      },
    ],
  });
}

function manifestInput(overrides = {}) {
  return {
    runId: RUN_ID,
    repositoryId: REPOSITORY_ID,
    worktreeId: WORKTREE_ID,
    decision: successfulPolicy(),
    artifacts: [
      {
        id: "implementation-plan",
        path: "/repo/docs/acid-prophet/plan.md",
        contentHash: ARTIFACT_HASH,
      },
    ],
    policyHash: POLICY_HASH,
    revision: 1,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

function validManifest() {
  return createDecisionManifest(manifestInput());
}

function fieldCodes(result) {
  return result.diagnostics.map(({ code, field }) => ({ code, field }));
}

describe("decision manifest v1", () => {
  test("exports and creates the exact closed camelCase wire contract (AC-036, AC-042)", () => {
    const policy = successfulPolicy();
    const sentinel = "DO-NOT-PERSIST-raw-sensitive-value";
    const manifest = createDecisionManifest({
      ...manifestInput({
        decision: {
          ...policy,
          diagnostics: [{ message: sentinel }],
          configurationDiagnostics: [{ message: sentinel }],
          prompt: sentinel,
          sourceCode: sentinel,
          secret: sentinel,
          issueBody: sentinel,
          completeLog: sentinel,
        },
        artifacts: [
          {
            id: "implementation-plan",
            path: "/repo/docs/acid-prophet/plan.md",
            contentHash: ARTIFACT_HASH,
            content: sentinel,
            diagnostics: sentinel,
          },
        ],
      }),
      prompt: sentinel,
      secret: sentinel,
    });

    expect(DECISION_MANIFEST_SCHEMA_VERSION).toBe(1);
    expect(Object.keys(manifest)).toEqual([
      "schemaVersion",
      "runId",
      "repositoryId",
      "worktreeId",
      "decision",
      "artifacts",
      "policyHash",
      "revision",
      "createdAt",
      "updatedAt",
      "expiresAt",
    ]);
    expect(Object.keys(manifest.decision)).toEqual([
      "workflow",
      "requestedProfile",
      "riskFloor",
      "effectiveProfile",
      "normalizedEvidence",
      "activeRisks",
      "escalations",
      "enabledCapabilities",
    ]);
    expect(Object.keys(manifest.artifacts[0])).toEqual(["id", "path", "contentHash"]);
    expect(manifest.decision).toEqual({
      workflow: "issue-delivery",
      requestedProfile: "quick",
      riskFloor: "strict",
      effectiveProfile: "strict",
      normalizedEvidence: [
        {
          category: "security",
          source: "repository-rule",
          authority: "authoritative",
          state: "confirmed",
          potentiallyCritical: false,
        },
      ],
      activeRisks: ["security"],
      escalations: [{ reason: "security", from: "quick", to: "strict" }],
      enabledCapabilities: policy.enabledCapabilities,
    });

    const serialized = serializeDecisionManifest(manifest);
    expect(serialized).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
    expect(serialized).not.toContain(sentinel);
    expect(serializeDecisionManifest(structuredClone(manifest))).toBe(serialized);
    expect(validateDecisionManifest(manifest)).toEqual({
      ok: true,
      value: manifest,
      diagnostics: [],
    });
  });

  test("rejects a blocked or ambiguous policy instead of persisting it", () => {
    for (const decision of [
      { ...successfulPolicy(), blocked: true },
      { ...successfulPolicy(), workflow: "ambiguous" },
    ]) {
      expect(() => createDecisionManifest(manifestInput({ decision }))).toThrow(
        expect.objectContaining({
          name: "DecisionManifestValidationError",
          code: "invalid-decision-manifest",
          blocked: true,
        }),
      );
    }
  });

  test("rejects unknown persisted fields recursively with exact field diagnostics", () => {
    const fixtures = [
      ["top-level", (value) => ({ ...value, secret: "nope" }), "$.secret"],
      [
        "decision",
        (value) => ({ ...value, decision: { ...value.decision, diagnostics: [] } }),
        "$.decision.diagnostics",
      ],
      [
        "evidence",
        (value) => ({
          ...value,
          decision: {
            ...value.decision,
            normalizedEvidence: [{ ...value.decision.normalizedEvidence[0], prompt: "nope" }],
          },
        }),
        "$.decision.normalizedEvidence[0].prompt",
      ],
      [
        "escalation",
        (value) => ({
          ...value,
          decision: {
            ...value.decision,
            escalations: [{ ...value.decision.escalations[0], message: "nope" }],
          },
        }),
        "$.decision.escalations[0].message",
      ],
      [
        "artifact",
        (value) => ({
          ...value,
          artifacts: [{ ...value.artifacts[0], content: "nope" }],
        }),
        "$.artifacts[0].content",
      ],
    ];

    for (const [name, mutate, field] of fixtures) {
      const result = validateDecisionManifest(mutate(validManifest()));
      expect(result.ok, name).toBe(false);
      expect(fieldCodes(result), name).toContainEqual({ code: "unknown-field", field });
      expect(result).toHaveProperty("value", undefined);
      expect(() => serializeDecisionManifest(mutate(validManifest()))).toThrow(
        DecisionManifestValidationError,
      );
    }
  });

  test("reports malformed closed fields at their exact addresses", () => {
    const fixtures = [
      [
        "schema version",
        (value) => ({ ...value, schemaVersion: 2 }),
        "unsupported-schema-version",
        "$.schemaVersion",
      ],
      ["run traversal", (value) => ({ ...value, runId: "../escape" }), "invalid-run-id", "$.runId"],
      [
        "repository identity",
        (value) => ({ ...value, repositoryId: "A".repeat(64) }),
        "invalid-repository-id",
        "$.repositoryId",
      ],
      [
        "worktree identity",
        (value) => ({ ...value, worktreeId: "short" }),
        "invalid-worktree-id",
        "$.worktreeId",
      ],
      [
        "policy hash",
        (value) => ({ ...value, policyHash: "sha256:ABC" }),
        "invalid-content-hash",
        "$.policyHash",
      ],
      ["revision", (value) => ({ ...value, revision: 0 }), "invalid-revision", "$.revision"],
      [
        "created timestamp",
        (value) => ({ ...value, createdAt: "2026-08-31T08:00:00Z" }),
        "invalid-timestamp",
        "$.createdAt",
      ],
      [
        "timestamp order",
        (value) => ({ ...value, updatedAt: "2026-08-31T07:59:59.000Z" }),
        "invalid-timestamp-order",
        "$.updatedAt",
      ],
      [
        "expiry order",
        (value) => ({ ...value, expiresAt: UPDATED_AT }),
        "invalid-timestamp-order",
        "$.expiresAt",
      ],
      [
        "ambiguous workflow",
        (value) => ({ ...value, decision: { ...value.decision, workflow: "ambiguous" } }),
        "invalid-workflow",
        "$.decision.workflow",
      ],
      [
        "profile",
        (value) => ({ ...value, decision: { ...value.decision, requestedProfile: "turbo" } }),
        "invalid-profile",
        "$.decision.requestedProfile",
      ],
      [
        "evidence authority",
        (value) => ({
          ...value,
          decision: {
            ...value.decision,
            normalizedEvidence: [
              { ...value.decision.normalizedEvidence[0], authority: "semantic" },
            ],
          },
        }),
        "invalid-evidence-authority",
        "$.decision.normalizedEvidence[0].authority",
      ],
      [
        "active risk",
        (value) => ({
          ...value,
          decision: { ...value.decision, activeRisks: ["unknown-risk"] },
        }),
        "invalid-risk-category",
        "$.decision.activeRisks[0]",
      ],
      [
        "escalation reason",
        (value) => ({
          ...value,
          decision: {
            ...value.decision,
            escalations: [{ ...value.decision.escalations[0], reason: "because" }],
          },
        }),
        "invalid-escalation-reason",
        "$.decision.escalations[0].reason",
      ],
      [
        "capability id",
        (value) => ({
          ...value,
          decision: { ...value.decision, enabledCapabilities: ["../../unsafe"] },
        }),
        "invalid-capability-id",
        "$.decision.enabledCapabilities[0]",
      ],
      [
        "artifact id",
        (value) => ({ ...value, artifacts: [{ ...value.artifacts[0], id: "../artifact" }] }),
        "invalid-artifact-id",
        "$.artifacts[0].id",
      ],
      [
        "artifact path",
        (value) => ({
          ...value,
          artifacts: [{ ...value.artifacts[0], path: "../secrets.txt" }],
        }),
        "unsafe-path",
        "$.artifacts[0].path",
      ],
      [
        "artifact hash",
        (value) => ({ ...value, artifacts: [{ ...value.artifacts[0], contentHash: "abc" }] }),
        "invalid-content-hash",
        "$.artifacts[0].contentHash",
      ],
    ];

    for (const [name, mutate, code, field] of fixtures) {
      const result = validateDecisionManifest(mutate(validManifest()));
      expect(result.ok, name).toBe(false);
      expect(fieldCodes(result), name).toContainEqual({ code, field });
    }
  });

  test("checks expiry and scope only when their validation options are supplied (AC-039, AC-040)", () => {
    const manifest = validManifest();
    expect(validateDecisionManifest(manifest).ok).toBe(true);
    expect(validateDecisionManifest(manifest, { now: EXPIRES_AT }).diagnostics).toContainEqual(
      expect.objectContaining({ code: "expired-manifest", field: "$.expiresAt" }),
    );
    expect(validateDecisionManifest(manifest, { now: "2026-08-31T08:59:59.999Z" }).ok).toBe(true);

    const options = [
      ["expectedRunId", "another-run", "run-id-mismatch", "$.runId"],
      ["expectedRepositoryId", "e".repeat(64), "repository-mismatch", "$.repositoryId"],
      ["expectedWorktreeId", "f".repeat(64), "worktree-mismatch", "$.worktreeId"],
      ["expectedPolicyHash", `sha256:${"0".repeat(64)}`, "policy-hash-mismatch", "$.policyHash"],
    ];
    for (const [option, expected, code, field] of options) {
      const result = validateDecisionManifest(manifest, { [option]: expected });
      expect(fieldCodes(result)).toContainEqual({ code, field });
    }
  });

  test("derives repository identity from the canonical git common directory", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-repository-id-"));
    const canonical = path.join(directory, "canonical");
    const symlink = path.join(directory, "alias");
    fs.mkdirSync(canonical);
    fs.symlinkSync(canonical, symlink);

    try {
      expect(deriveRepositoryId(canonical)).toMatch(/^[a-f0-9]{64}$/);
      expect(deriveRepositoryId(symlink)).toBe(deriveRepositoryId(canonical));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("hashes exact manifest bytes with the required sha256 prefix", () => {
    expect(hashDecisionManifestContent("hello")).toBe(
      "sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
    expect(hashDecisionManifestContent(new TextEncoder().encode("hello"))).toBe(
      hashDecisionManifestContent("hello"),
    );
    expect(() => hashDecisionManifestContent({ contents: "hello" })).toThrow(TypeError);
  });
});

describe("manifest handoff v1", () => {
  test("creates and validates the exact snake_case handoff (AC-037)", () => {
    const contentHash = hashDecisionManifestContent(serializeDecisionManifest(validManifest()));
    const handoff = createManifestHandoff({
      runId: RUN_ID,
      path: `/repo/.git/nuthouse/workflow/runs/${RUN_ID}.json`,
      contentHash,
    });

    expect(handoff).toEqual({
      run_id: RUN_ID,
      path: `/repo/.git/nuthouse/workflow/runs/${RUN_ID}.json`,
      content_hash: contentHash,
    });
    expect(Object.keys(handoff)).toEqual(["run_id", "path", "content_hash"]);
    expect(validateManifestHandoff(handoff)).toEqual({
      ok: true,
      value: handoff,
      diagnostics: [],
    });
  });

  test("rejects unknown, camelCase, relative, traversal, and malformed handoff fields", () => {
    const valid = {
      run_id: RUN_ID,
      path: `/repo/.git/nuthouse/workflow/runs/${RUN_ID}.json`,
      content_hash: POLICY_HASH,
    };
    const fixtures = [
      [{ ...valid, policy_hash: POLICY_HASH }, "unknown-field", "$.policy_hash"],
      [{ runId: RUN_ID, path: valid.path, contentHash: POLICY_HASH }, "unknown-field", "$.runId"],
      [{ ...valid, run_id: "../escape" }, "invalid-run-id", "$.run_id"],
      [{ ...valid, path: `relative/${RUN_ID}.json` }, "unsafe-path", "$.path"],
      [{ ...valid, path: "/repo/runs/../escape.json" }, "unsafe-path", "$.path"],
      [{ ...valid, content_hash: "sha256:ABC" }, "invalid-content-hash", "$.content_hash"],
    ];

    for (const [value, code, field] of fixtures) {
      const result = validateManifestHandoff(value);
      expect(result.ok).toBe(false);
      expect(fieldCodes(result)).toContainEqual({ code, field });
      expect(result).toHaveProperty("value", undefined);
    }

    expect(() =>
      createManifestHandoff({
        runId: RUN_ID,
        path: "relative/manifest.json",
        contentHash: POLICY_HASH,
      }),
    ).toThrow(
      expect.objectContaining({
        name: "DecisionManifestValidationError",
        code: "invalid-manifest-handoff",
        source: "handoff",
        field: "$.path",
      }),
    );
  });
});
