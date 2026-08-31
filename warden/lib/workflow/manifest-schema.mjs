import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { CAPABILITY_CONSUMERS } from "./capability-resolver.mjs";
import { WORKFLOW_PROFILES } from "./configuration.mjs";
import {
  AUTHORITATIVE_RISK_EVIDENCE_SOURCES,
  RISK_CATEGORIES,
  RISK_EVIDENCE_SOURCES,
  RISK_EVIDENCE_STATES,
  evaluateRisk,
} from "./risk-evaluator.mjs";

export const DECISION_MANIFEST_SCHEMA_VERSION = 1;

const MANIFEST_FIELDS = Object.freeze([
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
const DECISION_FIELDS = Object.freeze([
  "workflow",
  "requestedProfile",
  "riskFloor",
  "effectiveProfile",
  "normalizedEvidence",
  "activeRisks",
  "escalations",
  "enabledCapabilities",
]);
const EVIDENCE_FIELDS = Object.freeze([
  "category",
  "source",
  "authority",
  "state",
  "potentiallyCritical",
]);
const ESCALATION_FIELDS = Object.freeze(["reason", "from", "to"]);
const ARTIFACT_FIELDS = Object.freeze(["id", "path", "contentHash"]);
const HANDOFF_FIELDS = Object.freeze(["run_id", "path", "content_hash"]);

const MANIFEST_FIELD_SET = new Set(MANIFEST_FIELDS);
const DECISION_FIELD_SET = new Set(DECISION_FIELDS);
const EVIDENCE_FIELD_SET = new Set(EVIDENCE_FIELDS);
const ESCALATION_FIELD_SET = new Set(ESCALATION_FIELDS);
const ARTIFACT_FIELD_SET = new Set(ARTIFACT_FIELDS);
const HANDOFF_FIELD_SET = new Set(HANDOFF_FIELDS);
const WORKFLOW_SET = new Set(CAPABILITY_CONSUMERS);
const PROFILE_SET = new Set(WORKFLOW_PROFILES);
const RISK_CATEGORY_SET = new Set(RISK_CATEGORIES);
const RISK_SOURCE_SET = new Set(RISK_EVIDENCE_SOURCES);
const AUTHORITATIVE_RISK_SOURCE_SET = new Set(AUTHORITATIVE_RISK_EVIDENCE_SOURCES);
const RISK_STATE_SET = new Set(RISK_EVIDENCE_STATES);
const EVIDENCE_AUTHORITY_SET = new Set(["authoritative", "semantic"]);
const ESCALATION_REASON_SET = new Set([...RISK_CATEGORIES, "unresolved-risk"]);

const IDENTITY_PATTERN = /^[a-f0-9]{64}$/u;
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function diagnostic(code, field, message) {
  return { code, field, message };
}

function validationFailure(diagnostics) {
  return { ok: false, value: undefined, diagnostics };
}

function validationSuccess(value) {
  return { ok: true, value, diagnostics: [] };
}

function validateClosedObject(value, fields, fieldSet, baseField, diagnostics, label) {
  if (!isRecord(value)) {
    diagnostics.push(diagnostic("invalid-type", baseField, `Expected ${label} to be an object.`));
    return false;
  }

  const unknownFields = Object.keys(value)
    .filter((field) => !fieldSet.has(field))
    .sort();
  for (const field of unknownFields) {
    diagnostics.push(
      diagnostic("unknown-field", `${baseField}.${field}`, `Unknown ${label} field: ${field}.`),
    );
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      diagnostics.push(
        diagnostic("missing-field", `${baseField}.${field}`, `The ${field} field is required.`),
      );
    }
  }
  return true;
}

function parseCanonicalTimestamp(value) {
  if (typeof value !== "string") return null;
  const epochMilliseconds = Date.parse(value);
  if (!Number.isFinite(epochMilliseconds)) return null;
  try {
    return new Date(epochMilliseconds).toISOString() === value ? epochMilliseconds : null;
  } catch {
    return null;
  }
}

function parseClock(value) {
  if (value instanceof Date) {
    const epochMilliseconds = value.getTime();
    return Number.isFinite(epochMilliseconds) ? epochMilliseconds : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return parseCanonicalTimestamp(value);
}

function isSafeIdentifier(value) {
  return typeof value === "string" && SAFE_ID_PATTERN.test(value);
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function isSafePath(value, { absolute = false } = {}) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 4096 ||
    hasControlCharacter(value) ||
    (absolute && !path.isAbsolute(value))
  ) {
    return false;
  }

  const segments = value.split(/[\\/]+/u);
  if (segments.includes("..") || segments.includes(".")) return false;
  return path.normalize(value) === value;
}

function validateStringArray(value, baseField, diagnostics, { code, label, validate }) {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("invalid-type", baseField, `Expected ${label} to be an array.`));
    return value;
  }

  const normalized = [];
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    const itemField = `${baseField}[${index}]`;
    if (!validate(item)) {
      diagnostics.push(diagnostic(code, itemField, `Invalid ${label} entry.`));
    } else if (seen.has(item)) {
      diagnostics.push(diagnostic("duplicate-entry", itemField, `Duplicate ${label} entry.`));
    }
    seen.add(item);
    normalized.push(item);
  }
  return normalized;
}

function validateEvidence(value, diagnostics) {
  const baseField = "$.decision.normalizedEvidence";
  if (!Array.isArray(value)) {
    diagnostics.push(
      diagnostic("invalid-type", baseField, "Expected normalizedEvidence to be an array."),
    );
    return value;
  }

  const normalized = [];
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    const itemField = `${baseField}[${index}]`;
    if (
      !validateClosedObject(
        item,
        EVIDENCE_FIELDS,
        EVIDENCE_FIELD_SET,
        itemField,
        diagnostics,
        "evidence",
      )
    ) {
      normalized.push(item);
      continue;
    }

    if (!RISK_CATEGORY_SET.has(item.category)) {
      diagnostics.push(
        diagnostic(
          "invalid-risk-category",
          `${itemField}.category`,
          "Expected a supported normalized risk category.",
        ),
      );
    }
    if (!RISK_SOURCE_SET.has(item.source)) {
      diagnostics.push(
        diagnostic(
          "invalid-evidence-source",
          `${itemField}.source`,
          "Expected a supported normalized evidence source.",
        ),
      );
    }
    if (!EVIDENCE_AUTHORITY_SET.has(item.authority)) {
      diagnostics.push(
        diagnostic(
          "invalid-evidence-authority",
          `${itemField}.authority`,
          "Expected evidence authority to be authoritative or semantic.",
        ),
      );
    } else if (RISK_SOURCE_SET.has(item.source)) {
      const expectedAuthority = AUTHORITATIVE_RISK_SOURCE_SET.has(item.source)
        ? "authoritative"
        : "semantic";
      if (item.authority !== expectedAuthority) {
        diagnostics.push(
          diagnostic(
            "invalid-evidence-authority",
            `${itemField}.authority`,
            "Evidence authority does not match its normalized source.",
          ),
        );
      }
    }
    if (!RISK_STATE_SET.has(item.state)) {
      diagnostics.push(
        diagnostic(
          "invalid-evidence-state",
          `${itemField}.state`,
          "Expected a supported normalized evidence state.",
        ),
      );
    }
    if (typeof item.potentiallyCritical !== "boolean") {
      diagnostics.push(
        diagnostic(
          "invalid-criticality",
          `${itemField}.potentiallyCritical`,
          "Expected potentiallyCritical to be a boolean.",
        ),
      );
    }

    const entry = {
      category: item.category,
      source: item.source,
      authority: item.authority,
      state: item.state,
      potentiallyCritical: item.potentiallyCritical,
    };
    const key = JSON.stringify(entry);
    if (seen.has(key)) {
      diagnostics.push(diagnostic("duplicate-entry", itemField, "Duplicate evidence entry."));
    }
    seen.add(key);
    normalized.push(entry);
  }
  return normalized;
}

function validateEscalations(value, decision, diagnostics) {
  const baseField = "$.decision.escalations";
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("invalid-type", baseField, "Expected escalations to be an array."));
    return value;
  }

  const normalized = [];
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    const itemField = `${baseField}[${index}]`;
    if (
      !validateClosedObject(
        item,
        ESCALATION_FIELDS,
        ESCALATION_FIELD_SET,
        itemField,
        diagnostics,
        "escalation",
      )
    ) {
      normalized.push(item);
      continue;
    }

    if (!ESCALATION_REASON_SET.has(item.reason)) {
      diagnostics.push(
        diagnostic(
          "invalid-escalation-reason",
          `${itemField}.reason`,
          "Expected a normalized risk or unresolved-risk reason.",
        ),
      );
    }
    for (const field of ["from", "to"]) {
      if (!PROFILE_SET.has(item[field])) {
        diagnostics.push(
          diagnostic(
            "invalid-profile",
            `${itemField}.${field}`,
            `Expected ${field} to be a supported workflow profile.`,
          ),
        );
      }
    }
    if (PROFILE_SET.has(item.from) && item.from !== decision.requestedProfile) {
      diagnostics.push(
        diagnostic(
          "inconsistent-escalation",
          `${itemField}.from`,
          "Escalation origin must equal requestedProfile.",
        ),
      );
    }
    if (PROFILE_SET.has(item.to) && item.to !== decision.effectiveProfile) {
      diagnostics.push(
        diagnostic(
          "inconsistent-escalation",
          `${itemField}.to`,
          "Escalation target must equal effectiveProfile.",
        ),
      );
    }

    const entry = { reason: item.reason, from: item.from, to: item.to };
    const key = JSON.stringify(entry);
    if (seen.has(key)) {
      diagnostics.push(diagnostic("duplicate-entry", itemField, "Duplicate escalation entry."));
    }
    seen.add(key);
    normalized.push(entry);
  }
  return normalized;
}

function haveSameMembers(left, right, key = (item) => item) {
  if (left.length !== right.length) return false;
  const expected = new Set(right.map(key));
  return left.every((item) => expected.has(key(item)));
}

function validateRiskDecision(decision, diagnostics) {
  const expected = evaluateRisk({
    requestedProfile: decision.requestedProfile,
    evidence: decision.normalizedEvidence.map(
      ({ category, source, state, potentiallyCritical }) => ({
        category,
        source,
        state,
        potentiallyCritical,
      }),
    ),
  });

  if (decision.riskFloor !== expected.riskFloor) {
    diagnostics.push(
      diagnostic(
        "inconsistent-risk-floor",
        "$.decision.riskFloor",
        "riskFloor must be derived from normalizedEvidence.",
      ),
    );
  }
  if (decision.effectiveProfile !== expected.effectiveProfile) {
    diagnostics.push(
      diagnostic(
        "inconsistent-effective-profile",
        "$.decision.effectiveProfile",
        "effectiveProfile must be derived from requestedProfile and normalizedEvidence.",
      ),
    );
  }
  if (!haveSameMembers(decision.activeRisks, expected.activeRisks)) {
    diagnostics.push(
      diagnostic(
        "inconsistent-active-risks",
        "$.decision.activeRisks",
        "activeRisks must match normalizedEvidence.",
      ),
    );
  }
  if (
    !haveSameMembers(
      decision.escalations,
      expected.escalations,
      ({ reason, from, to }) => `${reason}\0${from}\0${to}`,
    )
  ) {
    diagnostics.push(
      diagnostic(
        "inconsistent-escalations",
        "$.decision.escalations",
        "escalations must match requestedProfile and normalizedEvidence.",
      ),
    );
  }
}

function validateDecision(value, diagnostics) {
  const diagnosticCount = diagnostics.length;
  if (
    !validateClosedObject(
      value,
      DECISION_FIELDS,
      DECISION_FIELD_SET,
      "$.decision",
      diagnostics,
      "decision",
    )
  ) {
    return value;
  }

  if (!WORKFLOW_SET.has(value.workflow)) {
    diagnostics.push(
      diagnostic(
        "invalid-workflow",
        "$.decision.workflow",
        "Expected one successful workflow classification.",
      ),
    );
  }
  for (const field of ["requestedProfile", "riskFloor", "effectiveProfile"]) {
    if (!PROFILE_SET.has(value[field])) {
      diagnostics.push(
        diagnostic(
          "invalid-profile",
          `$.decision.${field}`,
          `Expected ${field} to be a supported workflow profile.`,
        ),
      );
    }
  }

  const decision = {
    workflow: value.workflow,
    requestedProfile: value.requestedProfile,
    riskFloor: value.riskFloor,
    effectiveProfile: value.effectiveProfile,
    normalizedEvidence: validateEvidence(value.normalizedEvidence, diagnostics),
    activeRisks: validateStringArray(value.activeRisks, "$.decision.activeRisks", diagnostics, {
      code: "invalid-risk-category",
      label: "activeRisks",
      validate: (item) => RISK_CATEGORY_SET.has(item),
    }),
    escalations: validateEscalations(value.escalations, value, diagnostics),
    enabledCapabilities: validateStringArray(
      value.enabledCapabilities,
      "$.decision.enabledCapabilities",
      diagnostics,
      {
        code: "invalid-capability-id",
        label: "enabledCapabilities",
        validate: isSafeIdentifier,
      },
    ),
  };
  if (diagnostics.length === diagnosticCount) validateRiskDecision(decision, diagnostics);
  return decision;
}

function validateArtifacts(value, diagnostics) {
  const baseField = "$.artifacts";
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic("invalid-type", baseField, "Expected artifacts to be an array."));
    return value;
  }

  const normalized = [];
  const seenIds = new Set();
  for (const [index, item] of value.entries()) {
    const itemField = `${baseField}[${index}]`;
    if (
      !validateClosedObject(
        item,
        ARTIFACT_FIELDS,
        ARTIFACT_FIELD_SET,
        itemField,
        diagnostics,
        "artifact",
      )
    ) {
      normalized.push(item);
      continue;
    }

    if (!isSafeIdentifier(item.id)) {
      diagnostics.push(
        diagnostic(
          "invalid-artifact-id",
          `${itemField}.id`,
          "Expected a stable lowercase artifact identifier.",
        ),
      );
    } else if (seenIds.has(item.id)) {
      diagnostics.push(
        diagnostic("duplicate-artifact-id", `${itemField}.id`, "Artifact ids must be unique."),
      );
    }
    seenIds.add(item.id);
    if (!isSafePath(item.path)) {
      diagnostics.push(
        diagnostic(
          "unsafe-path",
          `${itemField}.path`,
          "Expected a normalized artifact path without traversal or control characters.",
        ),
      );
    }
    if (typeof item.contentHash !== "string" || !CONTENT_HASH_PATTERN.test(item.contentHash)) {
      diagnostics.push(
        diagnostic(
          "invalid-content-hash",
          `${itemField}.contentHash`,
          "Expected a lowercase sha256 content hash.",
        ),
      );
    }
    normalized.push({ id: item.id, path: item.path, contentHash: item.contentHash });
  }
  return normalized;
}

function projectClosedObject(value, fields, nested = {}) {
  if (!isRecord(value)) return value;
  const projected = {};
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) continue;
    projected[field] = nested[field] ? nested[field](value[field]) : value[field];
  }
  return projected;
}

function projectDecision(value) {
  return projectClosedObject(value, DECISION_FIELDS, {
    normalizedEvidence: (items) =>
      Array.isArray(items)
        ? items.map((item) => projectClosedObject(item, EVIDENCE_FIELDS))
        : items,
    activeRisks: (items) => (Array.isArray(items) ? [...items] : items),
    escalations: (items) =>
      Array.isArray(items)
        ? items.map((item) => projectClosedObject(item, ESCALATION_FIELDS))
        : items,
    enabledCapabilities: (items) => (Array.isArray(items) ? [...items] : items),
  });
}

function projectArtifacts(value) {
  return Array.isArray(value)
    ? value.map((item) => projectClosedObject(item, ARTIFACT_FIELDS))
    : value;
}

export class DecisionManifestValidationError extends Error {
  constructor(diagnostics, options = {}) {
    const field = diagnostics[0]?.field ?? "$";
    const source = options.source ?? "manifest";
    super(`Invalid decision manifest ${source} data at ${field}.`);
    this.name = "DecisionManifestValidationError";
    this.code = options.code ?? "invalid-decision-manifest";
    this.source = source;
    this.field = field;
    this.diagnostics = diagnostics;
    this.blocked = true;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      source: this.source,
      field: this.field,
      diagnostics: this.diagnostics,
      blocked: this.blocked,
    };
  }
}

export function deriveRepositoryId(gitCommonDir) {
  const canonicalGitCommonDir = fs.realpathSync(gitCommonDir);
  return createHash("sha256").update(canonicalGitCommonDir).digest("hex");
}

export function validateDecisionManifest(value, options = {}) {
  const diagnostics = [];
  if (
    !validateClosedObject(value, MANIFEST_FIELDS, MANIFEST_FIELD_SET, "$", diagnostics, "manifest")
  ) {
    return validationFailure(diagnostics);
  }

  if (value.schemaVersion !== DECISION_MANIFEST_SCHEMA_VERSION) {
    diagnostics.push(
      diagnostic(
        "unsupported-schema-version",
        "$.schemaVersion",
        `Expected schemaVersion ${DECISION_MANIFEST_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (!isSafeIdentifier(value.runId)) {
    diagnostics.push(
      diagnostic(
        "invalid-run-id",
        "$.runId",
        "Expected a safe lowercase run identifier of at most 128 characters.",
      ),
    );
  } else if (options.expectedRunId !== undefined && value.runId !== options.expectedRunId) {
    diagnostics.push(
      diagnostic("run-id-mismatch", "$.runId", "The manifest belongs to a different run."),
    );
  }
  if (typeof value.repositoryId !== "string" || !IDENTITY_PATTERN.test(value.repositoryId)) {
    diagnostics.push(
      diagnostic(
        "invalid-repository-id",
        "$.repositoryId",
        "Expected repositoryId to be a lowercase SHA-256 digest.",
      ),
    );
  } else if (
    options.expectedRepositoryId !== undefined &&
    value.repositoryId !== options.expectedRepositoryId
  ) {
    diagnostics.push(
      diagnostic(
        "repository-mismatch",
        "$.repositoryId",
        "The manifest belongs to a different repository.",
      ),
    );
  }
  if (typeof value.worktreeId !== "string" || !IDENTITY_PATTERN.test(value.worktreeId)) {
    diagnostics.push(
      diagnostic(
        "invalid-worktree-id",
        "$.worktreeId",
        "Expected worktreeId to be a lowercase SHA-256 digest.",
      ),
    );
  } else if (
    options.expectedWorktreeId !== undefined &&
    value.worktreeId !== options.expectedWorktreeId
  ) {
    diagnostics.push(
      diagnostic(
        "worktree-mismatch",
        "$.worktreeId",
        "The manifest belongs to a different worktree.",
      ),
    );
  }

  const decision = validateDecision(value.decision, diagnostics);
  const artifacts = validateArtifacts(value.artifacts, diagnostics);

  if (typeof value.policyHash !== "string" || !CONTENT_HASH_PATTERN.test(value.policyHash)) {
    diagnostics.push(
      diagnostic(
        "invalid-content-hash",
        "$.policyHash",
        "Expected policyHash to be a lowercase sha256 content hash.",
      ),
    );
  } else if (
    options.expectedPolicyHash !== undefined &&
    value.policyHash !== options.expectedPolicyHash
  ) {
    diagnostics.push(
      diagnostic(
        "policy-hash-mismatch",
        "$.policyHash",
        "The manifest was produced by a different workflow policy.",
      ),
    );
  }
  if (!Number.isSafeInteger(value.revision) || value.revision <= 0) {
    diagnostics.push(
      diagnostic("invalid-revision", "$.revision", "Expected revision to be a positive integer."),
    );
  }

  const createdAt = parseCanonicalTimestamp(value.createdAt);
  const updatedAt = parseCanonicalTimestamp(value.updatedAt);
  const expiresAt = parseCanonicalTimestamp(value.expiresAt);
  for (const [field, timestamp] of [
    ["createdAt", createdAt],
    ["updatedAt", updatedAt],
    ["expiresAt", expiresAt],
  ]) {
    if (timestamp === null) {
      diagnostics.push(
        diagnostic(
          "invalid-timestamp",
          `$.${field}`,
          `Expected ${field} to be a canonical ISO timestamp.`,
        ),
      );
    }
  }
  if (createdAt !== null && updatedAt !== null && updatedAt < createdAt) {
    diagnostics.push(
      diagnostic(
        "invalid-timestamp-order",
        "$.updatedAt",
        "updatedAt cannot be earlier than createdAt.",
      ),
    );
  }
  if (updatedAt !== null && expiresAt !== null && expiresAt <= updatedAt) {
    diagnostics.push(
      diagnostic(
        "invalid-timestamp-order",
        "$.expiresAt",
        "expiresAt must be later than updatedAt.",
      ),
    );
  }
  if (Object.hasOwn(options, "now")) {
    const now = parseClock(options.now);
    if (now === null) {
      diagnostics.push(diagnostic("invalid-clock", "$.now", "The injected clock is invalid."));
    } else if (expiresAt !== null && now >= expiresAt) {
      diagnostics.push(
        diagnostic("expired-manifest", "$.expiresAt", "The decision manifest has expired."),
      );
    }
  }

  if (diagnostics.length > 0) return validationFailure(diagnostics);
  return validationSuccess({
    schemaVersion: DECISION_MANIFEST_SCHEMA_VERSION,
    runId: value.runId,
    repositoryId: value.repositoryId,
    worktreeId: value.worktreeId,
    decision,
    artifacts,
    policyHash: value.policyHash,
    revision: value.revision,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: value.expiresAt,
  });
}

export function createDecisionManifest(input) {
  if (!isRecord(input)) {
    throw new DecisionManifestValidationError([
      diagnostic("invalid-type", "$", "Expected manifest input to be an object."),
    ]);
  }
  if (isRecord(input.decision) && input.decision.blocked === true) {
    throw new DecisionManifestValidationError([
      diagnostic(
        "blocked-decision",
        "$.decision.blocked",
        "A blocked policy decision cannot be persisted as a successful resolution.",
      ),
    ]);
  }

  const candidate = {
    schemaVersion: DECISION_MANIFEST_SCHEMA_VERSION,
    runId: input.runId,
    repositoryId: input.repositoryId,
    worktreeId: input.worktreeId,
    decision: projectDecision(input.decision),
    artifacts: projectArtifacts(input.artifacts === undefined ? [] : input.artifacts),
    policyHash: input.policyHash,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    expiresAt: input.expiresAt,
  };
  const validation = validateDecisionManifest(candidate);
  if (!validation.ok) throw new DecisionManifestValidationError(validation.diagnostics);
  return validation.value;
}

export function serializeDecisionManifest(value) {
  const validation = validateDecisionManifest(value);
  if (!validation.ok) throw new DecisionManifestValidationError(validation.diagnostics);
  return `${JSON.stringify(validation.value, null, 2)}\n`;
}

export function hashDecisionManifestContent(contents) {
  if (typeof contents !== "string" && !(contents instanceof Uint8Array)) {
    throw new TypeError("Manifest contents must be a string or Uint8Array.");
  }
  return `sha256:${createHash("sha256").update(contents).digest("hex")}`;
}

export function validateManifestHandoff(value) {
  const diagnostics = [];
  if (
    !validateClosedObject(value, HANDOFF_FIELDS, HANDOFF_FIELD_SET, "$", diagnostics, "handoff")
  ) {
    return validationFailure(diagnostics);
  }

  if (!isSafeIdentifier(value.run_id)) {
    diagnostics.push(
      diagnostic(
        "invalid-run-id",
        "$.run_id",
        "Expected a safe lowercase run identifier of at most 128 characters.",
      ),
    );
  }
  if (!isSafePath(value.path, { absolute: true })) {
    diagnostics.push(
      diagnostic(
        "unsafe-path",
        "$.path",
        "Expected a normalized absolute manifest path without traversal or control characters.",
      ),
    );
  }
  if (typeof value.content_hash !== "string" || !CONTENT_HASH_PATTERN.test(value.content_hash)) {
    diagnostics.push(
      diagnostic(
        "invalid-content-hash",
        "$.content_hash",
        "Expected a lowercase sha256 content hash.",
      ),
    );
  }

  if (diagnostics.length > 0) return validationFailure(diagnostics);
  return validationSuccess({
    run_id: value.run_id,
    path: value.path,
    content_hash: value.content_hash,
  });
}

export function createManifestHandoff(input) {
  const candidate = isRecord(input)
    ? { run_id: input.runId, path: input.path, content_hash: input.contentHash }
    : input;
  const validation = validateManifestHandoff(candidate);
  if (!validation.ok) {
    throw new DecisionManifestValidationError(validation.diagnostics, {
      code: "invalid-manifest-handoff",
      source: "handoff",
    });
  }
  return validation.value;
}
