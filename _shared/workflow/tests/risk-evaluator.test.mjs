import { describe, expect, test } from "bun:test";

import {
  AUTHORITATIVE_RISK_EVIDENCE_SOURCES,
  RISK_CATEGORIES,
  RISK_EVIDENCE_SOURCES,
  RISK_EVIDENCE_STATES,
  evaluateRisk,
  normalizeRiskEvidence,
} from "../src/index.mjs";

const STRICT_RISK_CATEGORIES = [
  "authentication",
  "authorization",
  "security",
  "privacy",
  "migration",
  "persistent-data",
  "public-contract",
  "shared-api",
  "breaking-interface",
  "cross-repository",
  "production-infrastructure",
  "multi-package-architecture",
];

function evidence(category, overrides = {}) {
  return {
    category,
    source: "explicit-metadata",
    state: "confirmed",
    ...overrides,
  };
}

describe("normalized risk evidence", () => {
  test("exports closed, frozen evidence vocabularies", () => {
    expect(RISK_EVIDENCE_SOURCES).toEqual([
      "explicit-metadata",
      "linear-label",
      "approved-spec",
      "repository-rule",
      "affected-path",
      "semantic-analysis",
    ]);
    expect(AUTHORITATIVE_RISK_EVIDENCE_SOURCES).toEqual([
      "explicit-metadata",
      "linear-label",
      "approved-spec",
      "repository-rule",
      "affected-path",
    ]);
    expect(RISK_EVIDENCE_STATES).toEqual(["confirmed", "ruled-out", "unresolved"]);
    expect(RISK_CATEGORIES).toEqual([
      ...STRICT_RISK_CATEGORIES,
      "destructive-operation",
      "unresolved-spec-conflict",
    ]);

    for (const value of [
      RISK_EVIDENCE_SOURCES,
      AUTHORITATIVE_RISK_EVIDENCE_SOURCES,
      RISK_EVIDENCE_STATES,
      RISK_CATEGORIES,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  test("derives authority from source and canonicalizes equivalent evidence", () => {
    expect(
      normalizeRiskEvidence([
        evidence("privacy", { source: "semantic-analysis" }),
        evidence("security", { source: "approved-spec" }),
        evidence("security", { source: "approved-spec" }),
      ]),
    ).toEqual([
      {
        category: "security",
        source: "approved-spec",
        authority: "authoritative",
        state: "confirmed",
        potentiallyCritical: false,
      },
      {
        category: "privacy",
        source: "semantic-analysis",
        authority: "semantic",
        state: "confirmed",
        potentiallyCritical: false,
      },
    ]);
  });

  test("rejects malformed or open-ended evidence at the normalized boundary", () => {
    for (const value of [
      undefined,
      null,
      {},
      [evidence("unknown-risk")],
      [evidence("security", { source: "human-guess" })],
      [evidence("security", { state: "maybe" })],
      [evidence("security", { potentiallyCritical: "yes" })],
      [{ ...evidence("security"), rawPrompt: "secret" }],
    ]) {
      expect(() => normalizeRiskEvidence(value)).toThrow(TypeError);
    }
  });
});

describe("risk profile lattice", () => {
  test("preserves the requested profile when no risk floor applies", () => {
    for (const profile of ["quick", "standard", "strict"]) {
      expect(evaluateRisk({ requestedProfile: profile, evidence: [] })).toMatchObject({
        requestedProfile: profile,
        riskFloor: "quick",
        effectiveProfile: profile,
        activeRisks: [],
        escalations: [],
        diagnostics: [],
        blocked: false,
      });
    }
  });

  for (const category of STRICT_RISK_CATEGORIES) {
    test(`enforces strict for ${category} evidence (AC-013–AC-016)`, () => {
      const result = evaluateRisk({
        requestedProfile: "quick",
        evidence: [evidence(category)],
      });

      expect(result.riskFloor).toBe("strict");
      expect(result.effectiveProfile).toBe("strict");
      expect(result.activeRisks).toEqual([category]);
      expect(result.escalations).toContainEqual({
        reason: category,
        from: "quick",
        to: "strict",
      });
    });
  }

  test("selects the strictest requested or applicable floor without downgrading (AC-009)", () => {
    expect(
      evaluateRisk({
        requestedProfile: "standard",
        evidence: [evidence("authentication"), evidence("persistent-data")],
      }),
    ).toMatchObject({
      requestedProfile: "standard",
      riskFloor: "strict",
      effectiveProfile: "strict",
      activeRisks: ["authentication", "persistent-data"],
    });

    expect(
      evaluateRisk({
        requestedProfile: "strict",
        evidence: [evidence("security", { state: "ruled-out" })],
      }),
    ).toMatchObject({
      requestedProfile: "strict",
      riskFloor: "quick",
      effectiveProfile: "strict",
      escalations: [],
    });
  });

  test("allows semantic evidence to add risk but never remove authoritative evidence", () => {
    const result = evaluateRisk({
      requestedProfile: "quick",
      evidence: [
        evidence("security", { source: "repository-rule" }),
        evidence("security", { source: "semantic-analysis", state: "ruled-out" }),
        evidence("privacy", { source: "semantic-analysis" }),
      ],
    });

    expect(result.activeRisks).toEqual(["security", "privacy"]);
    expect(result.effectiveProfile).toBe("strict");
    expect(result.normalizedEvidence).toContainEqual(
      expect.objectContaining({
        category: "security",
        source: "repository-rule",
        authority: "authoritative",
        state: "confirmed",
      }),
    );
  });

  test("escalates unresolved potentially critical evidence with the exact reason (AC-010)", () => {
    const result = evaluateRisk({
      requestedProfile: "quick",
      evidence: [
        evidence("unresolved-spec-conflict", {
          source: "approved-spec",
          state: "unresolved",
          potentiallyCritical: true,
        }),
      ],
    });

    expect(result.riskFloor).toBe("strict");
    expect(result.effectiveProfile).toBe("strict");
    expect(result.activeRisks).toEqual(["unresolved-spec-conflict"]);
    expect(result.escalations).toEqual([
      { reason: "unresolved-risk", from: "quick", to: "strict" },
    ]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unresolved-risk",
        source: "risk",
        field: "$.evidence",
        requestedProfile: "quick",
        effectiveProfile: "strict",
      }),
    );
  });

  test("does not invent a floor for unresolved non-critical evidence", () => {
    const result = evaluateRisk({
      requestedProfile: "standard",
      evidence: [
        evidence("public-contract", {
          state: "unresolved",
          potentiallyCritical: false,
        }),
      ],
    });

    expect(result.riskFloor).toBe("quick");
    expect(result.effectiveProfile).toBe("standard");
    expect(result.activeRisks).toEqual([]);
  });

  test("explains a quick escalation without exposing a bypass (AC-018)", () => {
    const result = evaluateRisk({
      requestedProfile: "quick",
      evidence: [evidence("production-infrastructure", { source: "affected-path" })],
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "risk-floor-escalation",
        requestedProfile: "quick",
        effectiveProfile: "strict",
        reasons: ["production-infrastructure"],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("force quick");
    expect(Object.hasOwn(result, "bypass")).toBe(false);
  });

  test("returns deterministic output without mutating caller-owned evidence", () => {
    const input = Object.freeze({
      requestedProfile: "quick",
      evidence: Object.freeze([
        Object.freeze(evidence("privacy", { source: "semantic-analysis" })),
        Object.freeze(evidence("authentication", { source: "linear-label" })),
      ]),
    });
    const before = structuredClone(input);

    const first = evaluateRisk(input);
    const second = evaluateRisk({
      requestedProfile: "quick",
      evidence: [...input.evidence].reverse(),
    });

    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });
});
