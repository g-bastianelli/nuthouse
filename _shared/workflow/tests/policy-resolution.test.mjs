import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_CAPABILITY_GRAPH,
  IMMUTABLE_GATE_IDS,
  buildModeStatus,
  resolveConfiguration,
  resolveWorkflowPolicy,
} from "../src/index.mjs";

function evidence(category, overrides = {}) {
  return {
    category,
    source: "explicit-metadata",
    state: "confirmed",
    ...overrides,
  };
}

function capability(id, overrides = {}) {
  return {
    id,
    consumers: ["issue-delivery"],
    prerequisites: [],
    minimumProfile: "strict",
    riskTriggers: [],
    immutable: false,
    ...overrides,
  };
}

describe("workflow policy composition", () => {
  test("composes a resolved configuration with default immutable gates", () => {
    const configuration = resolveConfiguration({ invocationProfile: "quick" });
    const result = resolveWorkflowPolicy({
      configuration,
      workflow: "direct-task",
      riskEvidence: [],
    });

    expect(result).toMatchObject({
      workflow: "direct-task",
      requestedProfile: "quick",
      riskFloor: "quick",
      effectiveProfile: "quick",
      activeRisks: [],
      escalations: [],
      diagnostics: [],
      configurationDiagnostics: [],
      blocked: false,
    });
    expect(new Set(result.enabledCapabilities)).toEqual(new Set(IMMUTABLE_GATE_IDS));
    expect(result.configurationSources).toEqual(configuration.configurationSources);

    expect(buildModeStatus(configuration, result)).toEqual({
      requestedProfile: "quick",
      effectiveProfile: "quick",
      configurationSources: configuration.configurationSources,
      escalations: [],
      enabledCapabilities: result.enabledCapabilities,
      diagnostics: [],
      blocked: false,
    });
  });

  test("raises the profile before resolving profile and risk capabilities (AC-009, AC-018)", () => {
    const configuration = resolveConfiguration({ invocationProfile: "quick" });
    const capabilities = [
      ...DEFAULT_CAPABILITY_GRAPH,
      capability("implementation-plan"),
      capability("security-review", {
        minimumProfile: "quick",
        riskTriggers: ["security"],
      }),
    ];
    const result = resolveWorkflowPolicy({
      configuration,
      workflow: "issue-delivery",
      riskEvidence: [evidence("security", { source: "repository-rule" })],
      capabilities,
    });

    expect(result.requestedProfile).toBe("quick");
    expect(result.riskFloor).toBe("strict");
    expect(result.effectiveProfile).toBe("strict");
    expect(result.activeRisks).toEqual(["security"]);
    expect(result.escalations).toEqual([{ reason: "security", from: "quick", to: "strict" }]);
    expect(result.enabledCapabilities).toContain("implementation-plan");
    expect(result.enabledCapabilities).toContain("security-review");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "risk-floor-escalation",
        requestedProfile: "quick",
        effectiveProfile: "strict",
      }),
    );

    const status = buildModeStatus(configuration, result);
    expect(status.effectiveProfile).toBe("strict");
    expect(status.escalations).toEqual(result.escalations);
    expect(status.enabledCapabilities).toEqual(result.enabledCapabilities);
    expect(status.diagnostics).toEqual(result.diagnostics);
  });

  test("propagates unresolved-risk exactly through the composed projection (AC-010)", () => {
    const result = resolveWorkflowPolicy({
      configuration: resolveConfiguration({ invocationProfile: "standard" }),
      workflow: "project-creation",
      riskEvidence: [
        evidence("unresolved-spec-conflict", {
          source: "approved-spec",
          state: "unresolved",
          potentiallyCritical: true,
        }),
      ],
    });

    expect(result.effectiveProfile).toBe("strict");
    expect(result.escalations).toContainEqual({
      reason: "unresolved-risk",
      from: "standard",
      to: "strict",
    });
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "unresolved-risk" }));
  });

  test("propagates capability blockers without returning partial gates", () => {
    const capabilities = DEFAULT_CAPABILITY_GRAPH.filter(({ id }) => id !== "pr-review");
    const result = resolveWorkflowPolicy({
      configuration: resolveConfiguration(),
      workflow: "issue-delivery",
      capabilities,
    });

    expect(result.blocked).toBe(true);
    expect(result.enabledCapabilities).toEqual([]);
    expect(result.resolvedCapabilities).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-immutable-gate", capability: "pr-review" }),
    );
  });

  test("fails closed on explicit null risk and capability handoff data", () => {
    const configuration = resolveConfiguration({ invocationProfile: "quick" });

    expect(() =>
      resolveWorkflowPolicy({
        configuration,
        workflow: "issue-delivery",
        riskEvidence: null,
      }),
    ).toThrow(TypeError);

    const capabilities = resolveWorkflowPolicy({
      configuration,
      workflow: "issue-delivery",
      capabilities: null,
    });
    expect(capabilities).toMatchObject({
      enabledCapabilities: [],
      resolvedCapabilities: [],
      blocked: true,
    });
    expect(capabilities.diagnostics).toContainEqual(
      expect.objectContaining({ code: "invalid-capability-graph" }),
    );
  });

  test("keeps configuration diagnostics separate for one-time status composition", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-policy-config-"));
    const personalConfigPath = path.join(directory, "workflow.json");
    fs.writeFileSync(
      personalConfigPath,
      `${JSON.stringify({ schemaVersion: 1, defaultProfile: "turbo" })}\n`,
    );

    try {
      const configuration = resolveConfiguration({ personalConfigPath });
      const result = resolveWorkflowPolicy({
        configuration,
        workflow: "direct-task",
      });
      const status = buildModeStatus(configuration, result);

      expect(configuration.diagnostics).toHaveLength(1);
      expect(result.configurationDiagnostics).toEqual(configuration.diagnostics);
      expect(result.diagnostics).toEqual([]);
      expect(status.diagnostics).toEqual(configuration.diagnostics);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test("is deterministic and does not mutate named handoff inputs", () => {
    const configuration = Object.freeze({
      requestedProfile: "quick",
      configurationSources: Object.freeze([{ source: "invocation", profile: "quick" }]),
      diagnostics: Object.freeze([]),
      blocked: false,
    });
    const riskEvidence = Object.freeze([
      Object.freeze(evidence("privacy", { source: "semantic-analysis" })),
      Object.freeze(evidence("authentication", { source: "linear-label" })),
    ]);
    const input = Object.freeze({ configuration, workflow: "issue-delivery", riskEvidence });
    const before = structuredClone(input);

    const first = resolveWorkflowPolicy(input);
    const second = resolveWorkflowPolicy({
      ...input,
      riskEvidence: [...riskEvidence].reverse(),
    });

    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });

  test("rejects unresolved configuration or workflow boundaries", () => {
    for (const input of [
      undefined,
      {},
      { configuration: {}, workflow: "direct-task" },
      {
        configuration: resolveConfiguration(),
        workflow: "ambiguous",
      },
    ]) {
      expect(() => resolveWorkflowPolicy(input)).toThrow(TypeError);
    }
  });
});
