const LINEAR_STATUS_TYPES = new Set([
  "backlog",
  "triage",
  "unstarted",
  "started",
  "completed",
  "canceled",
  "unknown",
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUniqueStrings(values, field, { allowEmpty = true } = {}) {
  if (!Array.isArray(values)) {
    throw new LinearSnapshotValidationError("SNAPSHOT_INVALID_SCHEMA", `${field} must be an array`);
  }
  const normalized = values.map((value, index) => requiredString(value, `${field}[${index}]`));
  const result = [...new Set(normalized)].sort(compareStrings);
  if (!allowEmpty && result.length === 0) {
    throw new LinearSnapshotValidationError("SNAPSHOT_INVALID_SCOPE", `${field} must not be empty`);
  }
  return result;
}

function requiredString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      `${field} must be a non-empty string`,
    );
  }
  return value.trim();
}

function normalizeStatusType(value, field) {
  const normalized = requiredString(value, field).toLowerCase();
  return LINEAR_STATUS_TYPES.has(normalized) ? normalized : "unknown";
}

function normalizeScope(value, field = "scope") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      `${field} must be an object`,
    );
  }
  if (value.mode !== "full" && value.mode !== "targeted") {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCOPE",
      `${field}.mode must be full or targeted`,
    );
  }
  const requestedIssueIds = sortedUniqueStrings(
    value.requestedIssueIds,
    `${field}.requestedIssueIds`,
    { allowEmpty: value.mode === "full" },
  );
  if (value.mode === "full" && requestedIssueIds.length > 0) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCOPE",
      "full snapshots cannot declare requested issue ids",
    );
  }
  return { mode: value.mode, requestedIssueIds };
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function identifiableIssueId(value) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.issueId === "string" &&
    value.issueId.trim().length > 0
    ? value.issueId.trim()
    : undefined;
}

function withIdentifiedIssue(error, issueId) {
  if (
    !(error instanceof LinearSnapshotValidationError) ||
    issueId === undefined ||
    error.issueIds.length > 0
  ) {
    throw error;
  }
  throw new LinearSnapshotValidationError(error.code, error.message, [issueId]);
}

function normalizeUnknown(value, index) {
  const issueId = identifiableIssueId(value);
  try {
    return normalizeUnknownValue(value, index);
  } catch (error) {
    withIdentifiedIssue(error, issueId);
  }
}

function normalizeUnknownValue(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      `unknown[${index}] must be an object`,
    );
  }
  const normalized = {
    code: requiredString(value.code, `unknown[${index}].code`),
    detail: requiredString(value.detail, `unknown[${index}].detail`),
  };
  if (value.issueId !== undefined) {
    normalized.issueId = requiredString(value.issueId, `unknown[${index}].issueId`);
  }
  return normalized;
}

function compareUnknown(left, right) {
  const issueOrder = compareStrings(left.issueId ?? "", right.issueId ?? "");
  if (issueOrder !== 0) return issueOrder;
  const codeOrder = compareStrings(left.code, right.code);
  return codeOrder || compareStrings(left.detail, right.detail);
}

function uniqueUnknown(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries.sort(compareUnknown)) {
    const key = JSON.stringify([entry.issueId ?? null, entry.code, entry.detail]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function normalizeIssue(value, index) {
  const issueId = identifiableIssueId(value);
  try {
    return normalizeIssueValue(value, index);
  } catch (error) {
    withIdentifiedIssue(error, issueId);
  }
}

function normalizeIssueValue(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      `issues[${index}] must be an object`,
    );
  }
  const dataState = requiredString(value.dataState, `issues[${index}].dataState`);
  if (dataState !== "known" && dataState !== "unknown") {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      `issues[${index}].dataState must be known or unknown`,
    );
  }
  return {
    issueId: requiredString(value.issueId, `issues[${index}].issueId`),
    projectId: requiredString(value.projectId, `issues[${index}].projectId`),
    statusType: normalizeStatusType(value.statusType, `issues[${index}].statusType`),
    blockerIssueIds: sortedUniqueStrings(value.blockerIssueIds, `issues[${index}].blockerIssueIds`),
    dataState,
  };
}

export class LinearSnapshotValidationError extends Error {
  constructor(code, message, issueIds = []) {
    super(message);
    this.name = "LinearSnapshotValidationError";
    this.code = code;
    this.issueIds = [...new Set(issueIds.map(String))].sort(compareStrings);
  }
}

export function validateLinearSnapshot(input, { expectedProjectId, expectedScope } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      "snapshot must be an object",
    );
  }
  if (input.schemaVersion !== 1) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCHEMA",
      "snapshot schemaVersion must be 1",
    );
  }
  const projectId = requiredString(input.projectId, "projectId");
  if (expectedProjectId !== undefined && projectId !== expectedProjectId) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_PROJECT_MISMATCH",
      `expected project ${expectedProjectId}, received ${projectId}`,
    );
  }
  const scope = normalizeScope(input.scope);
  if (expectedScope !== undefined) {
    const normalizedExpectedScope = normalizeScope(expectedScope, "expectedScope");
    if (
      scope.mode !== normalizedExpectedScope.mode ||
      !sameStrings(scope.requestedIssueIds, normalizedExpectedScope.requestedIssueIds)
    ) {
      throw new LinearSnapshotValidationError(
        "SNAPSHOT_SCOPE_MISMATCH",
        "snapshot scope does not match the requested scope",
        normalizedExpectedScope.requestedIssueIds,
      );
    }
  }
  if (!Array.isArray(input.issues)) {
    throw new LinearSnapshotValidationError("SNAPSHOT_INVALID_SCHEMA", "issues must be an array");
  }
  const issues = input.issues.map(normalizeIssue);
  const duplicateIssueIds = [];
  const seenIssueIds = new Set();
  for (const issue of issues) {
    if (seenIssueIds.has(issue.issueId)) duplicateIssueIds.push(issue.issueId);
    seenIssueIds.add(issue.issueId);
  }
  if (duplicateIssueIds.length > 0) {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_DUPLICATE_ISSUE",
      "snapshot contains duplicate issue identifiers",
      duplicateIssueIds,
    );
  }
  issues.sort((left, right) => compareStrings(left.issueId, right.issueId));

  if (scope.mode === "targeted") {
    const issueIds = issues.map((issue) => issue.issueId);
    const requested = new Set(scope.requestedIssueIds);
    const expanded = issueIds.filter((issueId) => !requested.has(issueId));
    if (expanded.length > 0) {
      throw new LinearSnapshotValidationError(
        "SNAPSHOT_SCOPE_EXPANDED",
        "targeted snapshot contains issues outside the requested scope",
        expanded,
      );
    }
    const present = new Set(issueIds);
    const missing = scope.requestedIssueIds.filter((issueId) => !present.has(issueId));
    if (missing.length > 0) {
      throw new LinearSnapshotValidationError(
        "SNAPSHOT_INCOMPLETE",
        "targeted snapshot omitted requested issues",
        missing,
      );
    }
  }

  if (!Array.isArray(input.unknown)) {
    throw new LinearSnapshotValidationError("SNAPSHOT_INVALID_SCHEMA", "unknown must be an array");
  }
  const unknown = uniqueUnknown(input.unknown.map(normalizeUnknown));
  const issueIds = new Set(issues.map((issue) => issue.issueId));
  const unknownOutsideSnapshot = unknown
    .filter((entry) => entry.issueId !== undefined && !issueIds.has(entry.issueId))
    .map((entry) => entry.issueId);
  if (unknownOutsideSnapshot.length > 0) {
    throw new LinearSnapshotValidationError(
      scope.mode === "targeted" ? "SNAPSHOT_SCOPE_EXPANDED" : "SNAPSHOT_UNKNOWN_ISSUE",
      "unknown entries must refer to issues present in the snapshot",
      unknownOutsideSnapshot,
    );
  }

  return {
    schemaVersion: 1,
    projectId,
    scope,
    issues,
    unknown,
  };
}

function requireFullSnapshot(snapshot, operation) {
  if (snapshot.scope.mode !== "full") {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCOPE",
      `${operation} requires a full snapshot`,
      snapshot.scope.requestedIssueIds,
    );
  }
  return snapshot;
}

export function hydrateLinearSnapshotCache(fullSnapshot) {
  return requireFullSnapshot(validateLinearSnapshot(fullSnapshot), "cache hydration");
}

export function linearSnapshotFromCache(cache) {
  return requireFullSnapshot(validateLinearSnapshot(cache), "cache read");
}

export function refreshLinearSnapshotCache(cache, targetedSnapshot, { expectedScope } = {}) {
  const current = linearSnapshotFromCache(cache);
  const refresh = validateLinearSnapshot(targetedSnapshot, {
    expectedProjectId: current.projectId,
    ...(expectedScope === undefined ? {} : { expectedScope }),
  });
  if (refresh.scope.mode !== "targeted") {
    throw new LinearSnapshotValidationError(
      "SNAPSHOT_INVALID_SCOPE",
      "cache refresh requires a targeted snapshot",
    );
  }

  const refreshedIssueIds = new Set(refresh.scope.requestedIssueIds);
  const issueById = new Map(current.issues.map((issue) => [issue.issueId, issue]));
  for (const issue of refresh.issues) issueById.set(issue.issueId, issue);

  const preservedUnknown = current.unknown.filter(
    (entry) => entry.issueId === undefined || !refreshedIssueIds.has(entry.issueId),
  );
  const scopedRefreshUnknown = refresh.unknown.flatMap((entry) =>
    entry.issueId === undefined
      ? refresh.scope.requestedIssueIds.map((issueId) => ({ ...entry, issueId }))
      : [entry],
  );

  return validateLinearSnapshot({
    schemaVersion: 1,
    projectId: current.projectId,
    scope: { mode: "full", requestedIssueIds: [] },
    issues: [...issueById.values()],
    unknown: [...preservedUnknown, ...scopedRefreshUnknown],
  });
}

export function markLinearSnapshotCacheUnknown(cache, { issueIds, code, detail }) {
  const current = linearSnapshotFromCache(cache);
  const targetIssueIds = sortedUniqueStrings(issueIds, "issueIds", { allowEmpty: false });
  const knownIssueIds = new Set(current.issues.map((issue) => issue.issueId));
  const missing = targetIssueIds.filter((issueId) => !knownIssueIds.has(issueId));
  if (missing.length > 0) {
    throw new LinearSnapshotValidationError(
      "CACHE_SCOPE_UNKNOWN",
      "cannot mark issues absent from the hydrated cache",
      missing,
    );
  }
  const normalizedCode = requiredString(code, "code");
  const normalizedDetail = requiredString(detail, "detail");
  const targetIssueIdSet = new Set(targetIssueIds);
  return validateLinearSnapshot({
    ...current,
    issues: current.issues.map((issue) =>
      targetIssueIdSet.has(issue.issueId)
        ? {
            ...issue,
            statusType: "unknown",
            blockerIssueIds: [],
            dataState: "unknown",
          }
        : issue,
    ),
    unknown: [
      ...current.unknown.filter(
        (entry) => entry.issueId === undefined || !targetIssueIdSet.has(entry.issueId),
      ),
      ...targetIssueIds.map((issueId) => ({
        issueId,
        code: normalizedCode,
        detail: normalizedDetail,
      })),
    ],
  });
}
