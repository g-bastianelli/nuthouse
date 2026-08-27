import { createHash } from "node:crypto";

const MARKERS = new Set([
  "nuthouse:maestro-control",
  "nuthouse:maestro-execution",
  "nuthouse:maestro-waiver",
]);

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const EXECUTION_OUTCOMES = new Set(["verified", "partial", "degraded", "repaired"]);
const STARTABLE_STATUS_TYPES = new Set(["backlog", "triage", "unstarted"]);

export class RecordValidationError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "RecordValidationError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail) {
  throw new RecordValidationError(code, message, detail);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_RECORD", `${label} must be an object`);
  }
  return value;
}

function string(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("INVALID_RECORD", `${label} must be a non-empty string`);
  }
  return value.trim();
}

function timestamp(value, label) {
  const normalized = string(value, label);
  if (Number.isNaN(Date.parse(normalized))) fail("INVALID_RECORD", `${label} must be ISO-8601`);
  return normalized;
}

function hash(value, label) {
  const normalized = string(value, label);
  if (!HASH_PATTERN.test(normalized)) fail("INVALID_RECORD", `${label} must be a SHA-256 hash`);
  return normalized;
}

function integer(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail("INVALID_RECORD", `${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function sortedUniqueStrings(value, label) {
  if (!Array.isArray(value)) fail("INVALID_RECORD", `${label} must be an array`);
  const normalized = value.map((entry, index) => string(entry, `${label}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    fail("INVALID_RECORD", `${label} contains duplicates`);
  }
  return normalized.sort();
}

export function canonicalizeDecisionBaseline(value) {
  const baseline = object(value, "decisionBaseline");
  if (!Array.isArray(baseline.issueIds) || !Array.isArray(baseline.edges)) {
    fail("INVALID_RECORD", "decisionBaseline requires issueIds and edges arrays");
  }
  const issueIds = baseline.issueIds.map((id, index) => string(id, `issueIds[${index}]`));
  if (new Set(issueIds).size !== issueIds.length) {
    fail("INVALID_RECORD", "decisionBaseline contains duplicate issueIds");
  }
  issueIds.sort();
  const issueIdSet = new Set(issueIds);
  const seenEdges = new Set();
  const edges = baseline.edges.map((value, index) => {
    const edge = object(value, `edges[${index}]`);
    const normalized = {
      dependentIssueId: string(edge.dependentIssueId, `edges[${index}].dependentIssueId`),
      blockerIssueId: string(edge.blockerIssueId, `edges[${index}].blockerIssueId`),
    };
    if (
      !issueIdSet.has(normalized.dependentIssueId) ||
      !issueIdSet.has(normalized.blockerIssueId)
    ) {
      fail("INVALID_RECORD", "decisionBaseline edge targets an unknown issue", normalized);
    }
    if (normalized.dependentIssueId === normalized.blockerIssueId) {
      fail("INVALID_RECORD", "decisionBaseline contains a self-edge", normalized);
    }
    const key = `${normalized.dependentIssueId}\u0000${normalized.blockerIssueId}`;
    if (seenEdges.has(key))
      fail("INVALID_RECORD", "decisionBaseline contains a duplicate edge", normalized);
    seenEdges.add(key);
    return normalized;
  });
  edges.sort((left, right) => {
    const dependentOrder = left.dependentIssueId.localeCompare(right.dependentIssueId);
    return dependentOrder || left.blockerIssueId.localeCompare(right.blockerIssueId);
  });
  return { issueIds, edges };
}

export function hashDecisionBaseline(value) {
  const canonical = canonicalizeDecisionBaseline(value);
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

function canonicalizeDispatchEligibility(value) {
  const eligibility = object(value, "dispatch eligibility");
  const issueId = string(eligibility.issueId, "eligibility.issueId");
  const projectId = string(eligibility.projectId, "eligibility.projectId");
  const statusType = string(eligibility.statusType, "eligibility.statusType").toLowerCase();
  if (!STARTABLE_STATUS_TYPES.has(statusType)) {
    fail("ISSUE_NOT_STARTABLE", `issue status is not startable: ${statusType}`);
  }
  if (!Array.isArray(eligibility.blockers)) {
    fail("INVALID_RECORD", "eligibility.blockers must be an array");
  }
  const seen = new Set();
  const blockers = eligibility.blockers
    .map((value, index) => {
      const blocker = object(value, `eligibility.blockers[${index}]`);
      const blockerIssueId = string(blocker.issueId, `eligibility.blockers[${index}].issueId`);
      if (blockerIssueId === issueId) {
        fail("ISSUE_NOT_ELIGIBLE", "dispatch eligibility contains a self blocker");
      }
      if (seen.has(blockerIssueId)) {
        fail("ISSUE_NOT_ELIGIBLE", "dispatch eligibility contains duplicate blockers");
      }
      seen.add(blockerIssueId);
      const blockerStatusType = string(
        blocker.statusType,
        `eligibility.blockers[${index}].statusType`,
      ).toLowerCase();
      if (typeof blocker.waiverApproved !== "boolean") {
        fail("INVALID_RECORD", "eligibility blocker waiverApproved must be boolean");
      }
      if (blockerStatusType !== "completed" && blocker.waiverApproved !== true) {
        fail("ISSUE_NOT_ELIGIBLE", `unsatisfied blocker: ${blockerIssueId}`);
      }
      return {
        issueId: blockerIssueId,
        statusType: blockerStatusType,
        waiverApproved: blocker.waiverApproved,
      };
    })
    .sort((left, right) => left.issueId.localeCompare(right.issueId));
  return { issueId, projectId, statusType, blockers };
}

function canonicalDispatchAuthorization(value) {
  const authorization = object(value, "dispatch authorization");
  if (authorization.schemaVersion !== 1 || authorization.kind !== "project") {
    fail("INVALID_RECORD", "dispatch authorization must be schemaVersion 1 project mode");
  }
  const normalized = {
    schemaVersion: 1,
    kind: "project",
    projectId: string(authorization.projectId, "projectId"),
    runId: string(authorization.runId, "runId"),
    revision: integer(authorization.revision, "revision", 1, Number.MAX_SAFE_INTEGER),
    decisionHash: hash(authorization.decisionHash, "decisionHash"),
    lockToken: string(authorization.lockToken, "lockToken"),
    issueId: string(authorization.issueId, "issueId"),
    eligibility: canonicalizeDispatchEligibility(authorization.eligibility),
  };
  if (
    normalized.issueId !== normalized.eligibility.issueId ||
    normalized.projectId !== normalized.eligibility.projectId
  ) {
    fail("AUTHORIZATION_SCOPE_MISMATCH", "authorization and eligibility scope differ");
  }
  return normalized;
}

export function hashDispatchAuthorization(value) {
  const canonical = canonicalDispatchAuthorization(value);
  const digest = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return `sha256:${digest}`;
}

export function buildDispatchAuthorization(input) {
  const canonical = canonicalDispatchAuthorization({
    ...object(input, "dispatch authorization input"),
    schemaVersion: 1,
    kind: "project",
  });
  return { ...canonical, authorizationHash: hashDispatchAuthorization(canonical) };
}

export function validateDispatchAuthorization(value) {
  const authorization = object(value, "dispatch authorization");
  const canonical = canonicalDispatchAuthorization(authorization);
  const authorizationHash = hash(authorization.authorizationHash, "authorizationHash");
  const expectedHash = hashDispatchAuthorization(canonical);
  if (authorizationHash !== expectedHash) {
    fail("AUTHORIZATION_HASH_MISMATCH", "authorizationHash does not match dispatch evidence");
  }
  return { ...canonical, authorizationHash };
}

function validateHeader(value, marker) {
  const record = object(value, "record");
  if (record.marker !== marker) fail("MARKER_MISMATCH", `expected marker ${marker}`);
  if (record.schemaVersion !== 1) {
    fail("UNSUPPORTED_SCHEMA", `unsupported schemaVersion: ${String(record.schemaVersion)}`);
  }
  return record;
}

function parseBody(body, marker) {
  if (typeof body !== "string") fail("INVALID_COMMENT", "comment body must be a string");
  const markerText = `<!-- ${marker} schema_version=`;
  const markerIndex = body.indexOf(markerText);
  if (markerIndex < 0) fail("MARKER_MISSING", `missing ${marker} marker`);
  const markerEnd = body.indexOf("-->", markerIndex);
  if (markerEnd < 0) fail("INVALID_COMMENT", "unterminated record marker");
  const versionText = body.slice(markerIndex + markerText.length, markerEnd).trim();
  if (versionText !== "1") fail("UNSUPPORTED_SCHEMA", `unsupported schemaVersion: ${versionText}`);

  const fenceStart = body.indexOf("```json", markerEnd);
  const jsonStart = fenceStart < 0 ? -1 : body.indexOf("\n", fenceStart);
  const fenceEnd = jsonStart < 0 ? -1 : body.indexOf("```", jsonStart + 1);
  if (jsonStart < 0 || fenceEnd < 0) fail("INVALID_COMMENT", "missing JSON record fence");
  try {
    return JSON.parse(body.slice(jsonStart + 1, fenceEnd));
  } catch (error) {
    fail("INVALID_JSON", error instanceof Error ? error.message : String(error));
  }
}

export function buildControlRecord(input, existing) {
  const value = object(input, "control input");
  const previous = existing === undefined ? undefined : validateControlRecord(existing);
  const previousRevision = previous?.revision ?? 0;
  const maxConcurrency = value.maxConcurrency === undefined ? 4 : value.maxConcurrency;
  const decisionBaseline = canonicalizeDecisionBaseline(value.decisionBaseline);
  const computedDecisionHash = hashDecisionBaseline(decisionBaseline);
  if (value.decisionHash !== undefined && value.decisionHash !== computedDecisionHash) {
    fail("DECISION_HASH_MISMATCH", "decisionHash does not match decisionBaseline");
  }
  return validateControlRecord({
    marker: "nuthouse:maestro-control",
    schemaVersion: 1,
    projectId: value.projectId,
    runId: value.runId,
    active: value.active,
    repository: value.repository,
    supersetProjectId: value.supersetProjectId,
    targetHostId: value.targetHostId,
    defaultAgent: value.defaultAgent,
    maxConcurrency,
    executionIssueIds: value.executionIssueIds ?? previous?.executionIssueIds ?? [],
    exitedExecutionIssueIds:
      value.exitedExecutionIssueIds ?? previous?.exitedExecutionIssueIds ?? [],
    decisionBaseline,
    decisionHash: computedDecisionHash,
    graphHash: value.graphHash,
    revision: previousRevision + 1,
    updatedAt: value.updatedAt,
  });
}

export function validateControlRecord(value) {
  const record = validateHeader(value, "nuthouse:maestro-control");
  if (typeof record.active !== "boolean") fail("INVALID_RECORD", "active must be boolean");
  const decisionBaseline = canonicalizeDecisionBaseline(record.decisionBaseline);
  const decisionHash = hash(record.decisionHash, "decisionHash");
  if (decisionHash !== hashDecisionBaseline(decisionBaseline)) {
    fail("DECISION_HASH_MISMATCH", "decisionHash does not match decisionBaseline");
  }
  const executionIssueIds = sortedUniqueStrings(
    record.executionIssueIds ?? [],
    "executionIssueIds",
  );
  const exitedExecutionIssueIds = sortedUniqueStrings(
    record.exitedExecutionIssueIds ?? [],
    "exitedExecutionIssueIds",
  );
  const overlap = executionIssueIds.find((issueId) => exitedExecutionIssueIds.includes(issueId));
  if (overlap) {
    fail("INVALID_RECORD", "an execution cannot be both active and confirmed exited", {
      issueId: overlap,
    });
  }
  return {
    marker: record.marker,
    schemaVersion: 1,
    projectId: string(record.projectId, "projectId"),
    runId: string(record.runId, "runId"),
    active: record.active,
    repository: string(record.repository, "repository"),
    supersetProjectId: string(record.supersetProjectId, "supersetProjectId"),
    targetHostId: string(record.targetHostId, "targetHostId"),
    defaultAgent: string(record.defaultAgent, "defaultAgent"),
    maxConcurrency: integer(record.maxConcurrency, "maxConcurrency", 1, 10),
    executionIssueIds,
    exitedExecutionIssueIds,
    decisionBaseline,
    decisionHash,
    graphHash: hash(record.graphHash, "graphHash"),
    revision: integer(record.revision, "revision", 1, Number.MAX_SAFE_INTEGER),
    updatedAt: timestamp(record.updatedAt, "updatedAt"),
  };
}

export function validateExecutionRecord(value) {
  const record = validateHeader(value, "nuthouse:maestro-execution");
  if (!EXECUTION_OUTCOMES.has(record.outcome)) {
    fail("INVALID_RECORD", `unknown execution outcome: ${String(record.outcome)}`);
  }
  const normalized = {
    marker: record.marker,
    schemaVersion: 1,
    issueId: string(record.issueId, "issueId"),
    runId: string(record.runId, "runId"),
    outcome: record.outcome,
    workspaceId: string(record.workspaceId, "workspaceId"),
    taskId: string(record.taskId, "taskId"),
    branch: string(record.branch, "branch"),
    agent: string(record.agent, "agent"),
    hostId: string(record.hostId, "hostId"),
    recordedAt: timestamp(record.recordedAt, "recordedAt"),
  };
  if (record.terminalId !== undefined)
    normalized.terminalId = string(record.terminalId, "terminalId");
  if (record.detail !== undefined) normalized.detail = string(record.detail, "detail");
  if ((record.outcome === "verified" || record.outcome === "repaired") && !normalized.terminalId) {
    fail("INVALID_RECORD", `${record.outcome} execution requires terminalId`);
  }
  if (normalized.taskId !== normalized.issueId) {
    fail("TASK_ID_MISMATCH", "taskId must equal the exact Linear issue id");
  }
  return normalized;
}

export function buildExecutionRecord(input) {
  return validateExecutionRecord({
    ...object(input, "execution input"),
    marker: "nuthouse:maestro-execution",
    schemaVersion: 1,
  });
}

export function validateWaiverRecord(value) {
  const record = validateHeader(value, "nuthouse:maestro-waiver");
  if (record.revokedAt !== undefined && record.revokedAt !== null) {
    timestamp(record.revokedAt, "revokedAt");
    fail("WAIVER_REVOKED", "waiver is revoked");
  }
  const normalized = {
    marker: record.marker,
    schemaVersion: 1,
    dependentIssueId: string(record.dependentIssueId, "dependentIssueId"),
    blockerIssueId: string(record.blockerIssueId, "blockerIssueId"),
    reason: string(record.reason, "reason"),
    approver: string(record.approver, "approver"),
    approvedAt: timestamp(record.approvedAt, "approvedAt"),
  };
  if (normalized.dependentIssueId === normalized.blockerIssueId) {
    fail("INVALID_RECORD", "a waiver cannot name a self-edge");
  }
  return normalized;
}

export function buildWaiverRecord(input) {
  return validateWaiverRecord({
    ...object(input, "waiver input"),
    marker: "nuthouse:maestro-waiver",
    schemaVersion: 1,
  });
}

export function serializeRecord(value) {
  const record = object(value, "record");
  const marker = string(record.marker, "marker");
  if (!MARKERS.has(marker)) fail("UNKNOWN_MARKER", `unknown record marker: ${marker}`);
  const normalized =
    marker === "nuthouse:maestro-control"
      ? validateControlRecord(record)
      : marker === "nuthouse:maestro-execution"
        ? validateExecutionRecord(record)
        : validateWaiverRecord(record);
  return `<!-- ${marker} schema_version=${String(normalized.schemaVersion)} -->\n\n\`\`\`json\n${JSON.stringify(normalized, null, 2)}\n\`\`\`\n`;
}

export function parseControlRecord(body) {
  return validateControlRecord(parseBody(body, "nuthouse:maestro-control"));
}

export function parseExecutionRecord(body) {
  return validateExecutionRecord(parseBody(body, "nuthouse:maestro-execution"));
}

export function parseWaiverRecord(body) {
  return validateWaiverRecord(parseBody(body, "nuthouse:maestro-waiver"));
}
