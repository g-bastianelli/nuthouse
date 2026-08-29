import { WORKFLOW_PROFILES, isWorkflowProfile } from "./configuration.mjs";

export const RISK_EVIDENCE_SOURCES = Object.freeze([
  "explicit-metadata",
  "linear-label",
  "approved-spec",
  "repository-rule",
  "affected-path",
  "semantic-analysis",
]);

export const AUTHORITATIVE_RISK_EVIDENCE_SOURCES = Object.freeze([
  "explicit-metadata",
  "linear-label",
  "approved-spec",
  "repository-rule",
  "affected-path",
]);

export const RISK_EVIDENCE_STATES = Object.freeze(["confirmed", "ruled-out", "unresolved"]);

export const RISK_CATEGORIES = Object.freeze([
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
  "destructive-operation",
  "unresolved-spec-conflict",
]);

export const RISK_PROFILE_FLOORS = Object.freeze(
  Object.fromEntries(RISK_CATEGORIES.map((category) => [category, "strict"])),
);

const AUTHORITATIVE_SOURCE_SET = new Set(AUTHORITATIVE_RISK_EVIDENCE_SOURCES);
const RISK_SOURCE_SET = new Set(RISK_EVIDENCE_SOURCES);
const RISK_STATE_SET = new Set(RISK_EVIDENCE_STATES);
const RISK_CATEGORY_SET = new Set(RISK_CATEGORIES);
const RISK_EVIDENCE_FIELDS = new Set(["category", "source", "state", "potentiallyCritical"]);
const PROFILE_RANK = new Map(WORKFLOW_PROFILES.map((profile, index) => [profile, index]));
const SOURCE_RANK = new Map(RISK_EVIDENCE_SOURCES.map((source, index) => [source, index]));
const STATE_RANK = new Map(RISK_EVIDENCE_STATES.map((state, index) => [state, index]));
const CATEGORY_RANK = new Map(RISK_CATEGORIES.map((category, index) => [category, index]));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function strictestProfile(left, right) {
  return PROFILE_RANK.get(left) >= PROFILE_RANK.get(right) ? left : right;
}

function evidenceKey(value) {
  return [value.category, value.source, value.state, String(value.potentiallyCritical)].join("\0");
}

function compareEvidence(left, right) {
  return (
    CATEGORY_RANK.get(left.category) - CATEGORY_RANK.get(right.category) ||
    SOURCE_RANK.get(left.source) - SOURCE_RANK.get(right.source) ||
    STATE_RANK.get(left.state) - STATE_RANK.get(right.state) ||
    Number(left.potentiallyCritical) - Number(right.potentiallyCritical)
  );
}

function normalizeEvidenceEntry(value, index) {
  if (!isRecord(value)) {
    throw new TypeError(`Risk evidence at index ${index} must be an object.`);
  }

  const unknownFields = Object.keys(value).filter((field) => !RISK_EVIDENCE_FIELDS.has(field));
  if (unknownFields.length > 0) {
    throw new TypeError(`Unknown risk evidence field: ${unknownFields.sort()[0]}.`);
  }

  if (!RISK_CATEGORY_SET.has(value.category)) {
    throw new TypeError(`Risk evidence at index ${index} has an invalid category.`);
  }
  if (!RISK_SOURCE_SET.has(value.source)) {
    throw new TypeError(`Risk evidence at index ${index} has an invalid source.`);
  }
  if (!RISK_STATE_SET.has(value.state)) {
    throw new TypeError(`Risk evidence at index ${index} has an invalid state.`);
  }
  if (
    Object.hasOwn(value, "potentiallyCritical") &&
    typeof value.potentiallyCritical !== "boolean"
  ) {
    throw new TypeError(`Risk evidence at index ${index} has invalid criticality.`);
  }

  return {
    category: value.category,
    source: value.source,
    authority: AUTHORITATIVE_SOURCE_SET.has(value.source) ? "authoritative" : "semantic",
    state: value.state,
    potentiallyCritical: value.potentiallyCritical ?? false,
  };
}

export function isRiskCategory(value) {
  return typeof value === "string" && RISK_CATEGORY_SET.has(value);
}

export function normalizeRiskEvidence(value) {
  if (!Array.isArray(value)) {
    throw new TypeError("Risk evidence must be an array.");
  }

  const normalized = value.map(normalizeEvidenceEntry).sort(compareEvidence);
  const unique = [];
  const seen = new Set();

  for (const entry of normalized) {
    const key = evidenceKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

function escalationDiagnostic(requestedProfile, effectiveProfile, reasons) {
  return {
    code: "risk-floor-escalation",
    source: "risk",
    field: "$.evidence",
    severity: "warning",
    requestedProfile,
    effectiveProfile,
    reasons,
    message: `Requested profile ${requestedProfile} was raised to ${effectiveProfile} by normalized risk evidence: ${reasons.join(", ")}.`,
  };
}

function unresolvedRiskDiagnostic(requestedProfile, effectiveProfile) {
  return {
    code: "unresolved-risk",
    source: "risk",
    field: "$.evidence",
    severity: "warning",
    requestedProfile,
    effectiveProfile,
    reasons: ["unresolved-risk"],
    message: "Potentially critical risk could not be resolved confidently; strict is required.",
  };
}

export function evaluateRisk(input) {
  if (!isRecord(input)) {
    throw new TypeError("evaluateRisk requires an input object.");
  }
  if (!isWorkflowProfile(input.requestedProfile)) {
    throw new TypeError(`requestedProfile must be one of: ${WORKFLOW_PROFILES.join(", ")}.`);
  }

  const evidence = input.evidence === undefined ? [] : input.evidence;
  const normalizedEvidence = normalizeRiskEvidence(evidence);
  const activeRiskSet = new Set();
  const reasonSet = new Set();
  let riskFloor = "quick";
  let hasUnresolvedRisk = false;

  for (const item of normalizedEvidence) {
    if (item.state === "confirmed") {
      activeRiskSet.add(item.category);
      reasonSet.add(item.category);
      riskFloor = strictestProfile(riskFloor, RISK_PROFILE_FLOORS[item.category]);
      continue;
    }

    if (item.state === "unresolved" && item.potentiallyCritical) {
      activeRiskSet.add(item.category);
      reasonSet.add("unresolved-risk");
      riskFloor = "strict";
      hasUnresolvedRisk = true;
    }
  }

  const activeRisks = RISK_CATEGORIES.filter((category) => activeRiskSet.has(category));
  const effectiveProfile = strictestProfile(input.requestedProfile, riskFloor);
  const reasons = [...reasonSet];
  const escalated = PROFILE_RANK.get(effectiveProfile) > PROFILE_RANK.get(input.requestedProfile);
  const escalations = escalated
    ? reasons.map((reason) => ({ reason, from: input.requestedProfile, to: effectiveProfile }))
    : [];
  const diagnostics = [];

  if (hasUnresolvedRisk) {
    diagnostics.push(unresolvedRiskDiagnostic(input.requestedProfile, effectiveProfile));
  }
  if (escalated) {
    diagnostics.push(escalationDiagnostic(input.requestedProfile, effectiveProfile, reasons));
  }

  return {
    requestedProfile: input.requestedProfile,
    riskFloor,
    effectiveProfile,
    normalizedEvidence,
    activeRisks,
    escalations,
    diagnostics,
    blocked: false,
  };
}
