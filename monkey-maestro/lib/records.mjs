const CONTROL_MARKER = "nuthouse:maestro-control";
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

function validationCode(error) {
  return error instanceof RecordValidationError ? error.code : "INVALID_RECORD";
}

export function resolveControlAuthority(comments, { expectedProjectId } = {}) {
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
    const control = parseControlRecord(candidate.body);
    if (expectedProjectId !== undefined && control.projectId !== expectedProjectId) {
      fail(
        "CONTROL_PROJECT_MISMATCH",
        `expected project ${expectedProjectId}, received ${control.projectId}`,
      );
    }
    return {
      status: "valid",
      control,
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

export function serializeRecord(value) {
  const normalized = validateControlRecord(value);
  return `<!-- ${CONTROL_MARKER} schema_version=${String(normalized.schemaVersion)} -->\n\n\`\`\`json\n${JSON.stringify(normalized, null, 2)}\n\`\`\`\n`;
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
