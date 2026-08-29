import { describe, expect, test } from "bun:test";

import {
  CAPABILITY_CONSUMERS,
  DEFAULT_CAPABILITY_GRAPH,
  IMMUTABLE_GATE_IDS,
  resolveCapabilities,
  validateCapabilityGraph,
} from "../src/index.mjs";

function capability(id, overrides = {}) {
  return {
    id,
    consumers: ["direct-task"],
    prerequisites: [],
    minimumProfile: "quick",
    riskTriggers: [],
    immutable: false,
    ...overrides,
  };
}

function graphWith(...capabilities) {
  return [...DEFAULT_CAPABILITY_GRAPH.map((entry) => structuredClone(entry)), ...capabilities];
}

function enabled(result) {
  return new Set(result.enabledCapabilities);
}

describe("capability graph contract", () => {
  test("exports the closed consumers and five immutable gates", () => {
    expect(CAPABILITY_CONSUMERS).toEqual(["project-creation", "issue-delivery", "direct-task"]);
    expect(IMMUTABLE_GATE_IDS).toEqual([
      "verification",
      "external-mutation",
      "pr-review",
      "human-acceptance",
      "destructive-operation",
    ]);
    expect(DEFAULT_CAPABILITY_GRAPH.map(({ id }) => id)).toEqual(IMMUTABLE_GATE_IDS);

    for (const value of [CAPABILITY_CONSUMERS, IMMUTABLE_GATE_IDS, DEFAULT_CAPABILITY_GRAPH]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
    for (const gate of DEFAULT_CAPABILITY_GRAPH) {
      expect(gate.immutable).toBe(true);
      expect(Object.isFrozen(gate)).toBe(true);
      expect(Object.isFrozen(gate.consumers)).toBe(true);
      expect(Object.isFrozen(gate.prerequisites)).toBe(true);
      expect(Object.isFrozen(gate.riskTriggers)).toBe(true);
    }
  });

  test("validates and normalizes a complete graph without mutating it", () => {
    const graph = Object.freeze([
      ...DEFAULT_CAPABILITY_GRAPH,
      Object.freeze(
        capability("implementation-plan", {
          consumers: Object.freeze(["direct-task", "issue-delivery"]),
          prerequisites: Object.freeze(["verification"]),
          minimumProfile: "standard",
          riskTriggers: Object.freeze([]),
        }),
      ),
    ]);
    const before = structuredClone(graph);
    const result = validateCapabilityGraph(graph);

    expect(result.ok).toBe(true);
    expect(result.capabilities.at(-1)).toEqual({
      id: "verification",
      consumers: [...CAPABILITY_CONSUMERS],
      prerequisites: [],
      minimumProfile: "quick",
      riskTriggers: [],
      immutable: true,
    });
    expect(result.capabilities.map(({ id }) => id)).toContain("implementation-plan");
    expect(graph).toEqual(before);
  });
});

describe("capability resolution", () => {
  for (const workflow of CAPABILITY_CONSUMERS) {
    for (const effectiveProfile of ["quick", "standard", "strict"]) {
      test(`preserves immutable gates for ${workflow}/${effectiveProfile} (AC-017)`, () => {
        const result = resolveCapabilities({ workflow, effectiveProfile, activeRisks: [] });

        expect(result.blocked).toBe(false);
        expect(enabled(result)).toEqual(new Set(IMMUTABLE_GATE_IDS));
        for (const gateId of IMMUTABLE_GATE_IDS) {
          expect(result.resolvedCapabilities).toContainEqual({
            id: gateId,
            reasons: [{ kind: "immutable" }],
          });
        }
      });
    }
  }

  test("combines consumer, profile, risk-trigger, and prerequisite rules", () => {
    const capabilities = graphWith(
      capability("implementation-plan", { minimumProfile: "standard" }),
      capability("security-review", {
        prerequisites: ["implementation-plan"],
        riskTriggers: ["security"],
      }),
      capability("project-contract", {
        consumers: ["project-creation"],
        minimumProfile: "strict",
      }),
    );

    const quick = resolveCapabilities({
      workflow: "direct-task",
      effectiveProfile: "quick",
      activeRisks: [],
      capabilities,
    });
    expect(enabled(quick)).toEqual(new Set(IMMUTABLE_GATE_IDS));

    const standard = resolveCapabilities({
      workflow: "direct-task",
      effectiveProfile: "standard",
      activeRisks: [],
      capabilities,
    });
    expect(enabled(standard)).toEqual(new Set([...IMMUTABLE_GATE_IDS, "implementation-plan"]));

    const riskTriggered = resolveCapabilities({
      workflow: "direct-task",
      effectiveProfile: "quick",
      activeRisks: ["security"],
      capabilities,
    });
    expect(enabled(riskTriggered)).toEqual(
      new Set([...IMMUTABLE_GATE_IDS, "implementation-plan", "security-review"]),
    );
    expect(riskTriggered.resolvedCapabilities).toContainEqual({
      id: "security-review",
      reasons: [{ kind: "risk", risk: "security" }],
    });
    expect(riskTriggered.resolvedCapabilities).toContainEqual({
      id: "implementation-plan",
      reasons: [{ kind: "prerequisite", capability: "security-review" }],
    });
    expect(riskTriggered.enabledCapabilities).not.toContain("project-contract");
  });

  test("returns deterministic topological output independently of declaration order", () => {
    const additions = [
      capability("prepare", { prerequisites: ["verification"] }),
      capability("review", { prerequisites: ["prepare"] }),
      capability("ship", { prerequisites: ["review"] }),
    ];
    const input = {
      workflow: "direct-task",
      effectiveProfile: "quick",
      activeRisks: [],
    };
    const forward = resolveCapabilities({ ...input, capabilities: graphWith(...additions) });
    const reversed = resolveCapabilities({
      ...input,
      capabilities: [...graphWith(...additions)].reverse(),
    });

    expect(forward).toEqual(reversed);
    expect(forward.enabledCapabilities.indexOf("prepare")).toBeLessThan(
      forward.enabledCapabilities.indexOf("review"),
    );
    expect(forward.enabledCapabilities.indexOf("review")).toBeLessThan(
      forward.enabledCapabilities.indexOf("ship"),
    );
  });

  test("blocks when an immutable gate is missing or inapplicable (AC-017)", () => {
    const missing = DEFAULT_CAPABILITY_GRAPH.filter(({ id }) => id !== "verification");
    const missingResult = resolveCapabilities({
      workflow: "issue-delivery",
      effectiveProfile: "standard",
      capabilities: missing,
    });
    expect(missingResult).toMatchObject({
      enabledCapabilities: [],
      resolvedCapabilities: [],
      blocked: true,
    });
    expect(missingResult.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-immutable-gate", capability: "verification" }),
    );

    const inapplicable = DEFAULT_CAPABILITY_GRAPH.map((entry) =>
      entry.id === "human-acceptance"
        ? { ...entry, consumers: ["project-creation"] }
        : structuredClone(entry),
    );
    const inapplicableResult = resolveCapabilities({
      workflow: "direct-task",
      effectiveProfile: "quick",
      capabilities: inapplicable,
    });
    expect(inapplicableResult.blocked).toBe(true);
    expect(inapplicableResult.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-immutable-gate",
        capability: "human-acceptance",
      }),
    );
  });

  const invalidGraphs = [
    {
      name: "duplicate IDs",
      graph: graphWith(capability("duplicate"), capability("duplicate")),
      code: "duplicate-capability-id",
    },
    {
      name: "unknown prerequisites",
      graph: graphWith(capability("dependent", { prerequisites: ["missing"] })),
      code: "unknown-capability-prerequisite",
    },
    {
      name: "cycles",
      graph: graphWith(
        capability("cycle-a", { prerequisites: ["cycle-b"] }),
        capability("cycle-b", { prerequisites: ["cycle-a"] }),
      ),
      code: "capability-cycle",
    },
    {
      name: "unknown consumers",
      graph: graphWith(capability("bad-consumer", { consumers: ["ambiguous"] })),
      code: "invalid-capability-consumer",
    },
    {
      name: "unknown profiles",
      graph: graphWith(capability("bad-profile", { minimumProfile: "turbo" })),
      code: "invalid-capability-profile",
    },
    {
      name: "unknown risk triggers",
      graph: graphWith(capability("bad-risk", { riskTriggers: ["vibes"] })),
      code: "invalid-capability-risk-trigger",
    },
  ];

  for (const fixture of invalidGraphs) {
    test(`blocks malformed graphs with ${fixture.name}`, () => {
      const result = resolveCapabilities({
        workflow: "direct-task",
        effectiveProfile: "strict",
        activeRisks: [],
        capabilities: fixture.graph,
      });

      expect(result.blocked).toBe(true);
      expect(result.enabledCapabilities).toEqual([]);
      expect(result.resolvedCapabilities).toEqual([]);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: fixture.code }));
    });
  }

  test("rejects invalid resolution inputs before graph evaluation", () => {
    for (const input of [
      undefined,
      {},
      { workflow: "ambiguous", effectiveProfile: "strict" },
      { workflow: "direct-task", effectiveProfile: "turbo" },
      { workflow: "direct-task", effectiveProfile: "quick", activeRisks: ["vibes"] },
    ]) {
      expect(() => resolveCapabilities(input)).toThrow(TypeError);
    }
  });
});
