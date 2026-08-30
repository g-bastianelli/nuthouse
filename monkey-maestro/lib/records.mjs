const CONTROL_MARKER = "nuthouse:maestro-control";
const MARKERS = new Set([
  CONTROL_MARKER,
  "nuthouse:maestro-execution",
  "nuthouse:maestro-result",
  "nuthouse:maestro-waiver",
]);

const EXECUTION_OUTCOMES = new Set(["verified", "partial", "degraded", "repaired"]);
const WORKER_RESULT_OUTCOMES = new Set(["completed", "blocked", "failed"]);
const CONTROL_V2_FIELDS = new Set([
  "schemaVersion",
  "projectId",
  "runId",
  "active",
  "targetHostId",
  "supersetProjectId",
  "defaultAgent",
  "maxConcurrency",
  "revision",
  "updatedAt",
]);
const CONTROL_SNAPSHOT_FIELDS = new Set([
  "schemaVersion",
  "provider",
  "project",
  "comments",
  "unknown",
]);

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

function validateHeader(value, marker) {
  const record = object(value, "record");
  if (record.marker !== marker) fail("MARKER_MISMATCH", `expected marker ${marker}`);
  if (record.schemaVersion !== 1) {
    fail("UNSUPPORTED_SCHEMA", `unsupported schemaVersion: ${String(record.schemaVersion)}`);
  }
  return record;
}

function parseEnvelope(body, marker, requireKnownSchema = true) {
  if (typeof body !== "string") fail("INVALID_COMMENT", "comment body must be a string");
  const markerText = `<!-- ${marker} schema_version=`;
  const markerIndex = body.indexOf(markerText);
  if (markerIndex < 0) fail("MARKER_MISSING", `missing ${marker} marker`);
  const markerEnd = body.indexOf("-->", markerIndex);
  if (markerEnd < 0) fail("INVALID_COMMENT", "unterminated record marker");
  const versionText = body.slice(markerIndex + markerText.length, markerEnd).trim();
  if (requireKnownSchema && versionText !== "1") {
    fail("UNSUPPORTED_SCHEMA", `unsupported schemaVersion: ${versionText}`);
  }

  const fenceStart = body.indexOf("```json", markerEnd);
  const jsonStart = fenceStart < 0 ? -1 : body.indexOf("\n", fenceStart);
  const fenceEnd = jsonStart < 0 ? -1 : body.indexOf("```", jsonStart + 1);
  if (jsonStart < 0 || fenceEnd < 0) fail("INVALID_COMMENT", "missing JSON record fence");
  try {
    return { versionText, record: JSON.parse(body.slice(jsonStart + 1, fenceEnd)) };
  } catch (error) {
    fail("INVALID_JSON", error instanceof Error ? error.message : String(error));
  }
}

function parseBody(body, marker) {
  return parseEnvelope(body, marker).record;
}

function validationCode(error) {
  return error instanceof RecordValidationError ? error.code : "INVALID_RECORD";
}

export function validateControlSnapshot(value, { expectedProjectId } = {}) {
  const snapshot = object(value, "control snapshot");
  const unsupported = Object.keys(snapshot)
    .filter((field) => !CONTROL_SNAPSHOT_FIELDS.has(field))
    .sort();
  if (unsupported.length > 0) {
    fail(
      "CONTROL_SNAPSHOT_INVALID",
      `control snapshot contains unsupported fields: ${unsupported.join(", ")}`,
    );
  }
  if (snapshot.schemaVersion !== 1) {
    fail("CONTROL_SNAPSHOT_INVALID", "control snapshot schemaVersion must be 1");
  }
  if (snapshot.provider !== "ready" && snapshot.provider !== "unavailable") {
    fail("CONTROL_SNAPSHOT_INVALID", "control snapshot provider is invalid");
  }

  const project = object(snapshot.project, "control snapshot project");
  const projectId = string(project.id, "control snapshot project.id");
  const projectName = string(project.name, "control snapshot project.name");
  if (expectedProjectId !== undefined && projectId !== expectedProjectId) {
    fail(
      "CONTROL_PROJECT_MISMATCH",
      `expected project ${expectedProjectId}, received ${projectId}`,
    );
  }
  if (!Array.isArray(snapshot.comments)) {
    fail("CONTROL_SNAPSHOT_INVALID", "control snapshot comments must be an array");
  }
  const seenCommentIds = new Set();
  const comments = snapshot.comments
    .map((entry, index) => {
      const comment = object(entry, `control snapshot comments[${index}]`);
      const id = string(comment.id, `control snapshot comments[${index}].id`);
      if (seenCommentIds.has(id)) {
        fail("CONTROL_SNAPSHOT_INVALID", `duplicate control comment id ${id}`);
      }
      seenCommentIds.add(id);
      if (typeof comment.body !== "string" || comment.body.trim().length === 0) {
        fail(
          "CONTROL_SNAPSHOT_INVALID",
          `control snapshot comments[${index}].body must be a non-empty string`,
        );
      }
      const body = comment.body;
      if (!body.includes(`<!-- ${CONTROL_MARKER}`)) {
        fail("CONTROL_SNAPSHOT_INVALID", `control comment ${id} is missing the marker prefix`);
      }
      return {
        id,
        body,
        createdAt: timestamp(comment.createdAt, `control snapshot comments[${index}].createdAt`),
        updatedAt: timestamp(comment.updatedAt, `control snapshot comments[${index}].updatedAt`),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  if (!Array.isArray(snapshot.unknown)) {
    fail("CONTROL_SNAPSHOT_INVALID", "control snapshot unknown must be an array");
  }
  const unknown = snapshot.unknown.map((entry, index) => {
    const item = object(entry, `control snapshot unknown[${index}]`);
    return {
      code: string(item.code, `control snapshot unknown[${index}].code`),
      detail: string(item.detail, `control snapshot unknown[${index}].detail`),
    };
  });
  if (snapshot.provider === "ready" && unknown.length > 0) {
    fail("CONTROL_SNAPSHOT_CONTRADICTION", "ready control snapshot cannot contain unknowns");
  }
  if (snapshot.provider === "unavailable") {
    if (comments.length > 0 || unknown.length === 0) {
      fail(
        "CONTROL_SNAPSHOT_CONTRADICTION",
        "unavailable control snapshot requires unknown evidence and no comments",
      );
    }
    fail("CONTROL_PROVIDER_UNAVAILABLE", unknown.map((entry) => entry.detail).join("; "));
  }

  return {
    schemaVersion: 1,
    provider: "ready",
    project: { id: projectId, name: projectName },
    comments,
    unknown: [],
  };
}

export function resolveControlAuthority(comments) {
  if (!Array.isArray(comments)) fail("INVALID_INPUT", "comments must be an array");
  const candidates = comments
    .map((comment, index) => {
      const value = object(comment, `comments[${index}]`);
      const body = value.body;
      if (typeof body !== "string") {
        fail("INVALID_INPUT", `comments[${index}].body must be a string`);
      }
      if (!body.includes(`<!-- ${CONTROL_MARKER}`)) return null;
      const id = string(value.id, `comments[${index}].id`);
      try {
        const envelope = parseEnvelope(body, CONTROL_MARKER, false);
        return {
          id,
          body,
          sourceSchemaVersion: Number(envelope.versionText),
          revision: integer(
            envelope.record?.revision,
            `comments[${index}].revision`,
            1,
            Number.MAX_SAFE_INTEGER,
          ),
        };
      } catch (error) {
        return { id, body, revision: null, errorCode: validationCode(error) };
      }
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    return { status: "missing", code: "CONTROL_MISSING", control: null, controlCommentId: null };
  }

  const unorderable = candidates
    .filter((candidate) => candidate.revision === null)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (unorderable.length > 0) {
    const candidate = unorderable[0];
    return {
      status: "invalid",
      code: "CONTROL_INVALID",
      control: null,
      controlCommentId: candidate.id,
      revision: null,
      reason: candidate.errorCode,
    };
  }

  const highestRevision = Math.max(...candidates.map((candidate) => candidate.revision));
  const highest = candidates
    .filter((candidate) => candidate.revision === highestRevision)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (highest.length > 1) {
    return {
      status: "ambiguous",
      code: "CONTROL_AMBIGUOUS",
      control: null,
      controlCommentId: null,
      controlCommentIds: highest.map((candidate) => candidate.id),
      revision: highestRevision,
    };
  }

  const candidate = highest[0];
  try {
    return {
      status: "valid",
      control: parseControlRecord(candidate.body),
      controlCommentId: candidate.id,
      sourceSchemaVersion: candidate.sourceSchemaVersion,
      revision: highestRevision,
    };
  } catch (error) {
    return {
      status: "invalid",
      code: "CONTROL_INVALID",
      control: null,
      controlCommentId: candidate.id,
      revision: highestRevision,
      reason: validationCode(error),
    };
  }
}

export function buildControlRecord(input, existing) {
  const value = object(input, "control input");
  const previous = existing === undefined ? undefined : validateControlRecord(existing);

  const inherited = (field, fallback) => {
    if (Object.hasOwn(value, field)) return value[field];
    if (previous !== undefined) return previous[field];
    return fallback;
  };

  return validateControlRecord({
    schemaVersion: 2,
    projectId: inherited("projectId"),
    runId: inherited("runId"),
    active: inherited("active"),
    targetHostId: inherited("targetHostId"),
    supersetProjectId: inherited("supersetProjectId"),
    defaultAgent: inherited("defaultAgent"),
    maxConcurrency: inherited("maxConcurrency", 4),
    revision: (previous?.revision ?? 0) + 1,
    updatedAt: value.updatedAt,
  });
}

export function validateControlRecord(value) {
  const record = object(value, "record");
  if (record.marker !== undefined && record.marker !== CONTROL_MARKER) {
    fail("MARKER_MISMATCH", `expected marker ${CONTROL_MARKER}`);
  }
  if (record.schemaVersion !== 1 && record.schemaVersion !== 2) {
    fail("UNSUPPORTED_SCHEMA", `unsupported schemaVersion: ${String(record.schemaVersion)}`);
  }
  if (record.schemaVersion === 2) {
    const unexpected = Object.keys(record)
      .filter((field) => field !== "marker" && !CONTROL_V2_FIELDS.has(field))
      .sort();
    if (unexpected.length > 0) {
      fail("INVALID_RECORD", `control v2 contains unsupported fields: ${unexpected.join(", ")}`, {
        fields: unexpected,
      });
    }
  }
  if (typeof record.active !== "boolean") fail("INVALID_RECORD", "active must be boolean");
  return {
    schemaVersion: 2,
    projectId: string(record.projectId, "projectId"),
    runId: string(record.runId, "runId"),
    active: record.active,
    targetHostId: string(record.targetHostId, "targetHostId"),
    supersetProjectId: string(record.supersetProjectId, "supersetProjectId"),
    defaultAgent: string(record.defaultAgent, "defaultAgent"),
    maxConcurrency: integer(record.maxConcurrency, "maxConcurrency", 1, 10),
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
  return normalized;
}

export function buildExecutionRecord(input) {
  return validateExecutionRecord({
    ...object(input, "execution input"),
    marker: "nuthouse:maestro-execution",
    schemaVersion: 1,
  });
}

export function validateWorkerResultRecord(value) {
  const record = validateHeader(value, "nuthouse:maestro-result");
  if (!WORKER_RESULT_OUTCOMES.has(record.outcome)) {
    fail("INVALID_RECORD", `unknown worker result outcome: ${String(record.outcome)}`);
  }
  const normalized = {
    marker: record.marker,
    schemaVersion: 1,
    issueId: string(record.issueId, "issueId"),
    runId: string(record.runId, "runId"),
    workspaceId: string(record.workspaceId, "workspaceId"),
    terminalId: string(record.terminalId, "terminalId"),
    outcome: record.outcome,
    recordedAt: timestamp(record.recordedAt, "recordedAt"),
  };
  if (record.outcome === "completed") {
    normalized.summary = string(record.summary, "summary");
    normalized.files = sortedUniqueStrings(record.files ?? [], "files");
    normalized.checks = string(record.checks, "checks");
    normalized.handoff = string(record.handoff, "handoff");
  } else {
    normalized.reason = string(record.reason, "reason");
    normalized.needs = string(record.needs, "needs");
  }
  return normalized;
}

export function buildWorkerResultRecord(input) {
  return validateWorkerResultRecord({
    ...object(input, "worker result input"),
    marker: "nuthouse:maestro-result",
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
  const marker =
    record.marker === undefined && Object.hasOwn(record, "active")
      ? CONTROL_MARKER
      : string(record.marker, "marker");
  if (!MARKERS.has(marker)) fail("UNKNOWN_MARKER", `unknown record marker: ${marker}`);
  const normalized =
    marker === "nuthouse:maestro-control"
      ? validateControlRecord(record)
      : marker === "nuthouse:maestro-execution"
        ? validateExecutionRecord(record)
        : marker === "nuthouse:maestro-result"
          ? validateWorkerResultRecord(record)
          : validateWaiverRecord(record);
  return `<!-- ${marker} schema_version=${String(normalized.schemaVersion)} -->\n\n\`\`\`json\n${JSON.stringify(normalized, null, 2)}\n\`\`\`\n`;
}

export function parseControlRecord(body) {
  const envelope = parseEnvelope(body, CONTROL_MARKER, false);
  if (envelope.versionText !== "1" && envelope.versionText !== "2") {
    fail("UNSUPPORTED_SCHEMA", `unsupported schemaVersion: ${envelope.versionText}`);
  }
  if (String(envelope.record?.schemaVersion) !== envelope.versionText) {
    fail("SCHEMA_MISMATCH", "control envelope and record schema versions differ");
  }
  return validateControlRecord(envelope.record);
}

export function parseExecutionRecord(body) {
  return validateExecutionRecord(parseBody(body, "nuthouse:maestro-execution"));
}

export function parseWorkerResultRecord(body) {
  return validateWorkerResultRecord(parseBody(body, "nuthouse:maestro-result"));
}

export function parseWaiverRecord(body) {
  return validateWaiverRecord(parseBody(body, "nuthouse:maestro-waiver"));
}
