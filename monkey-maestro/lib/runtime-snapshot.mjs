const SELECTABLE_CLASSIFICATIONS = new Set(["ready", "started"]);
const AUDITABLE_CLASSIFICATIONS = new Set(["ready", "started", "blocked", "unknown"]);
const DATA_STATES = new Set(["known", "unknown"]);
const PROVIDER_STATES = new Set(["ready", "partial", "unavailable"]);
const CONTEXT_FIELDS = ["targetHostId", "supersetProjectId", "linearProjectId"];

export class RuntimeSnapshotValidationError extends Error {
  constructor(code, message = code, issueIds = []) {
    super(message);
    this.name = "RuntimeSnapshotValidationError";
    this.code = code;
    this.issueIds = [...new Set(issueIds.map(String))].sort((left, right) =>
      left.localeCompare(right),
    );
  }
}

function fail(code, message, issueIds = []) {
  throw new RuntimeSnapshotValidationError(code, message, issueIds);
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function nonEmptyString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function uniqueStrings(value, code) {
  if (!Array.isArray(value)) fail(code);
  const normalized = value.map((item) => nonEmptyString(item, code));
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function exactSet(actual, expected, code) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(code);
  }
}

function selectionRows(selection) {
  if (Array.isArray(selection)) return selection;
  if (Array.isArray(selection?.selectedIssues)) return selection.selectedIssues;
  if (Array.isArray(selection?.rows)) return selection.rows;
  fail("RUNTIME_EXPECTED_SCOPE_REQUIRED");
}

function normalizeSelection(selection, { allowOpaqueNonTerminal = false } = {}) {
  const rows = selectionRows(selection);
  const allowedClassifications = allowOpaqueNonTerminal
    ? AUDITABLE_CLASSIFICATIONS
    : SELECTABLE_CLASSIFICATIONS;
  const seen = new Set();
  const normalized = rows.map((entry) => {
    const row = object(entry, "RUNTIME_SELECTION_INVALID");
    const issueId = nonEmptyString(row.issueId, "RUNTIME_SELECTION_INVALID");
    if (seen.has(issueId)) fail("RUNTIME_SELECTION_DUPLICATE");
    seen.add(issueId);
    if (!allowedClassifications.has(row.classification)) {
      fail(
        row.classification === "terminal"
          ? "RUNTIME_TERMINAL_SELECTION_FORBIDDEN"
          : "RUNTIME_NON_CANDIDATE_SELECTION_FORBIDDEN",
      );
    }
    return {
      issueId,
      classification: row.classification,
      forced: row.forced === true,
      blockerIssueIds: Array.isArray(row.blockerIssueIds)
        ? uniqueStrings(row.blockerIssueIds, "RUNTIME_SELECTION_INVALID")
        : [],
    };
  });

  return normalized.sort((left, right) => left.issueId.localeCompare(right.issueId));
}

function normalizeScope(scope) {
  const value = object(scope, "RUNTIME_SCOPE_INVALID");
  if (value.mode === "targeted") {
    return uniqueStrings(value.requestedIssueIds, "RUNTIME_SCOPE_ISSUES_INVALID");
  }
  if (value.mode === undefined && Array.isArray(value.selectedIssueIds)) {
    return uniqueStrings(value.selectedIssueIds, "RUNTIME_SCOPE_ISSUES_INVALID");
  }
  fail("RUNTIME_SCOPE_NOT_TARGETED");
}

function rawRuntimeMatchInput(input, context) {
  const row = object(input, "RUNTIME_MATCH_INVALID");
  const issueId = nonEmptyString(row.issueId, "RUNTIME_MATCH_INVALID");
  if (row.dataState !== "known") fail("RUNTIME_RAW_MATCH_DATA_STATE_INVALID");
  if (
    row.taskId !== undefined ||
    row.workspaceIds !== undefined ||
    row.terminalIds !== undefined ||
    row.activeTerminalIds !== undefined ||
    row.exitedTerminalIds !== undefined
  ) {
    fail("RUNTIME_RAW_MATCH_SCHEMA_INVALID");
  }

  if (row.task === null) {
    if (
      !Array.isArray(row.workspaces) ||
      row.workspaces.length > 0 ||
      !Array.isArray(row.terminals) ||
      row.terminals.length > 0
    ) {
      fail("RUNTIME_TASK_ABSENCE_CONTRADICTION");
    }
    return {
      issueId,
      workspaceIds: [],
      terminalIds: [],
      activeTerminalIds: [],
      exitedTerminalIds: [],
      dataState: "known",
    };
  }

  const task = object(row.task, "RUNTIME_TASK_BINDING_INVALID");
  const taskId = nonEmptyString(task.id, "RUNTIME_TASK_BINDING_INVALID");
  if (task.externalProvider !== "linear" || task.externalKey !== issueId) {
    fail("RUNTIME_TASK_BINDING_MISMATCH");
  }
  const manualLinearProjectId = `manual:${issueId}`;
  if (
    context.linearProjectId.startsWith("manual:") &&
    context.linearProjectId !== manualLinearProjectId
  ) {
    fail("RUNTIME_TASK_PROJECT_MISMATCH");
  }
  if (
    (context.linearProjectId === manualLinearProjectId &&
      task.externalProjectId !== null &&
      task.externalProjectId !== undefined) ||
    (context.linearProjectId !== manualLinearProjectId &&
      task.externalProjectId !== context.linearProjectId)
  ) {
    fail("RUNTIME_TASK_PROJECT_MISMATCH");
  }
  if (task.deletedAt !== null || task.syncError !== null) {
    fail("RUNTIME_TASK_UNUSABLE");
  }

  if (!Array.isArray(row.workspaces)) fail("RUNTIME_WORKSPACES_INVALID");
  const workspaceIds = [];
  for (const inputWorkspace of row.workspaces) {
    const workspace = object(inputWorkspace, "RUNTIME_WORKSPACES_INVALID");
    const workspaceId = nonEmptyString(workspace.workspaceId, "RUNTIME_WORKSPACES_INVALID");
    if (
      workspace.taskId !== taskId ||
      workspace.hostId !== context.targetHostId ||
      workspace.projectId !== context.supersetProjectId
    ) {
      fail("RUNTIME_WORKSPACE_BINDING_MISMATCH");
    }
    workspaceIds.push(workspaceId);
  }
  if (new Set(workspaceIds).size !== workspaceIds.length) fail("RUNTIME_WORKSPACE_DUPLICATE");
  workspaceIds.sort((left, right) => left.localeCompare(right));
  const workspaceSet = new Set(workspaceIds);

  if (!Array.isArray(row.terminals)) fail("RUNTIME_TERMINALS_INVALID");
  const terminalIds = [];
  const activeTerminalIds = [];
  const exitedTerminalIds = [];
  for (const [index, inputTerminal] of row.terminals.entries()) {
    const terminal = object(inputTerminal, "RUNTIME_TERMINALS_INVALID");
    const workspaceId = nonEmptyString(
      terminal.workspaceId,
      `RUNTIME_TERMINAL_WORKSPACE_INVALID:${index}`,
    );
    if (!workspaceSet.has(workspaceId)) fail("RUNTIME_TERMINAL_WORKSPACE_MISMATCH");
    const terminalId = nonEmptyString(terminal.terminalId, `RUNTIME_TERMINAL_ID_INVALID:${index}`);
    if (typeof terminal.active !== "boolean") fail("RUNTIME_TERMINAL_STATE_INVALID");
    terminalIds.push(terminalId);
    (terminal.active ? activeTerminalIds : exitedTerminalIds).push(terminalId);
  }
  if (new Set(terminalIds).size !== terminalIds.length) fail("RUNTIME_TERMINAL_DUPLICATE");

  return {
    issueId,
    taskId,
    workspaceIds,
    terminalIds,
    activeTerminalIds,
    exitedTerminalIds,
    dataState: "known",
  };
}

function normalizeUnknownEntries(input) {
  if (!Array.isArray(input)) fail("RUNTIME_UNKNOWN_INVALID");
  return input.map((entry) => {
    const item = object(entry, "RUNTIME_UNKNOWN_INVALID");
    return {
      ...(item.issueId === undefined
        ? {}
        : { issueId: nonEmptyString(item.issueId, "RUNTIME_UNKNOWN_INVALID") }),
      code: nonEmptyString(item.code, "RUNTIME_UNKNOWN_INVALID"),
      detail: nonEmptyString(item.detail, "RUNTIME_UNKNOWN_INVALID"),
    };
  });
}

function normalizeContext(input, code) {
  const value = object(input, code);
  return Object.fromEntries(
    CONTEXT_FIELDS.map((field) => [field, nonEmptyString(value[field], code)]),
  );
}

export function validateRuntimeMatch(input, { expectedIssueId } = {}) {
  const match = object(input, "RUNTIME_MATCH_INVALID");
  const issueId = nonEmptyString(match.issueId, "RUNTIME_MATCH_INVALID");
  if (expectedIssueId !== undefined && issueId !== expectedIssueId) {
    fail("RUNTIME_MATCH_SCOPE_MISMATCH");
  }

  const dataState = match.dataState;
  if (!DATA_STATES.has(dataState)) fail("RUNTIME_MATCH_DATA_STATE_INVALID");

  const workspaceIds = uniqueStrings(match.workspaceIds ?? [], "RUNTIME_WORKSPACES_INVALID");
  const terminalIds = uniqueStrings(match.terminalIds ?? [], "RUNTIME_TERMINALS_INVALID");
  const activeTerminalIds = uniqueStrings(
    match.activeTerminalIds ?? terminalIds,
    "RUNTIME_ACTIVE_TERMINALS_INVALID",
  );
  const exitedTerminalIds = uniqueStrings(
    match.exitedTerminalIds ?? [],
    "RUNTIME_EXITED_TERMINALS_INVALID",
  );
  const terminalSet = new Set(terminalIds);
  if (
    activeTerminalIds.some((terminalId) => !terminalSet.has(terminalId)) ||
    exitedTerminalIds.some((terminalId) => !terminalSet.has(terminalId))
  ) {
    fail("RUNTIME_TERMINAL_SCOPE_MISMATCH");
  }
  if (activeTerminalIds.some((terminalId) => exitedTerminalIds.includes(terminalId))) {
    fail("RUNTIME_TERMINAL_STATE_CONTRADICTION");
  }
  if (workspaceIds.length === 0 && terminalIds.length > 0) {
    fail("RUNTIME_TERMINAL_WITHOUT_WORKSPACE");
  }
  if (dataState === "unknown" && (workspaceIds.length > 0 || terminalIds.length > 0)) {
    fail("RUNTIME_UNKNOWN_FACT_CONTRADICTION");
  }

  return {
    issueId,
    ...(match.taskId === undefined
      ? {}
      : { taskId: nonEmptyString(match.taskId, "RUNTIME_TASK_ID_INVALID") }),
    workspaceIds,
    terminalIds,
    activeTerminalIds,
    exitedTerminalIds,
    dataState,
  };
}

function validateRuntimeSnapshotInternal(
  input,
  expectedSelection,
  { expectedContext, requireRaw = false, allowOpaqueNonTerminal = false } = {},
) {
  const snapshot = object(input, "RUNTIME_SNAPSHOT_INVALID");
  if (snapshot.schemaVersion !== 1) fail("RUNTIME_SNAPSHOT_SCHEMA_INVALID");

  const rawEnvelope = snapshot.issues !== undefined;
  if (requireRaw && !rawEnvelope) fail("RUNTIME_RAW_ENVELOPE_REQUIRED");
  if (
    rawEnvelope &&
    (snapshot.scope?.mode !== undefined ||
      !Array.isArray(snapshot.scope?.selectedIssueIds) ||
      new Set(snapshot.scope.selectedIssueIds).size !== snapshot.scope.selectedIssueIds.length)
  ) {
    fail("RUNTIME_RAW_SCOPE_INVALID");
  }
  if (snapshot.matches !== undefined && rawEnvelope) {
    fail("RUNTIME_MATCH_SCHEMA_CONTRADICTION");
  }
  if (rawEnvelope && !PROVIDER_STATES.has(snapshot.provider)) {
    fail("RUNTIME_PROVIDER_STATE_REQUIRED");
  }
  if (rawEnvelope && !Array.isArray(snapshot.unknown)) fail("RUNTIME_UNKNOWN_INVALID");
  if (!rawEnvelope && snapshot.provider !== undefined && !PROVIDER_STATES.has(snapshot.provider)) {
    fail("RUNTIME_PROVIDER_STATE_INVALID");
  }

  const selection = normalizeSelection(expectedSelection, { allowOpaqueNonTerminal });
  const expectedIssueIds = selection.map((row) => row.issueId);
  const expectedSet = new Set(expectedIssueIds);
  const context =
    snapshot.context === undefined
      ? undefined
      : normalizeContext(snapshot.context, "RUNTIME_CONTEXT_INVALID");
  if (rawEnvelope && !context) fail("RUNTIME_CONTEXT_MISSING");
  if (expectedContext !== undefined) {
    const normalizedExpectedContext = normalizeContext(
      expectedContext,
      "RUNTIME_EXPECTED_CONTEXT_INVALID",
    );
    if (!context) fail("RUNTIME_CONTEXT_MISSING");
    if (CONTEXT_FIELDS.some((field) => context[field] !== normalizedExpectedContext[field])) {
      fail("RUNTIME_CONTEXT_MISMATCH");
    }
  }
  const requestedIssueIds = normalizeScope(snapshot.scope);
  exactSet(requestedIssueIds, expectedIssueIds, "RUNTIME_SCOPE_MISMATCH");

  const inputMatches = snapshot.matches ?? snapshot.issues;
  if (!Array.isArray(inputMatches)) fail("RUNTIME_MATCHES_INVALID");
  const seen = new Set();
  const matches = inputMatches.map((inputMatch) => {
    let rawMatch = inputMatch;
    if (rawEnvelope) {
      const identifiableIssueId =
        inputMatch &&
        typeof inputMatch === "object" &&
        !Array.isArray(inputMatch) &&
        typeof inputMatch.issueId === "string" &&
        inputMatch.issueId.length > 0
          ? inputMatch.issueId
          : undefined;
      try {
        rawMatch = rawRuntimeMatchInput(inputMatch, context);
      } catch (error) {
        if (identifiableIssueId && error instanceof RuntimeSnapshotValidationError) {
          throw new RuntimeSnapshotValidationError(error.code, error.message, [
            identifiableIssueId,
            ...error.issueIds,
          ]);
        }
        throw error;
      }
    }
    const match = validateRuntimeMatch(rawMatch);
    if (seen.has(match.issueId)) fail("RUNTIME_MATCH_DUPLICATE", undefined, [match.issueId]);
    seen.add(match.issueId);
    return match;
  });
  matches.sort((left, right) => left.issueId.localeCompare(right.issueId));
  if (matches.some((match) => !expectedSet.has(match.issueId))) {
    fail("RUNTIME_MATCH_SCOPE_MISMATCH");
  }

  const unknown = normalizeUnknownEntries(snapshot.unknown ?? []);
  if (unknown.some((entry) => entry.issueId !== undefined && !expectedSet.has(entry.issueId))) {
    fail("RUNTIME_UNKNOWN_SCOPE_MISMATCH");
  }
  const scopedUnknownIssueIds = new Set(
    unknown.flatMap((entry) => (entry.issueId === undefined ? [] : [entry.issueId])),
  );
  const coveredIssueIds = [...new Set([...seen, ...scopedUnknownIssueIds])].sort((left, right) =>
    left.localeCompare(right),
  );
  exactSet(coveredIssueIds, expectedIssueIds, "RUNTIME_MATCH_SCOPE_MISMATCH");
  for (const issueId of expectedIssueIds) {
    if (seen.has(issueId)) continue;
    matches.push(
      validateRuntimeMatch({
        issueId,
        workspaceIds: [],
        terminalIds: [],
        dataState: "unknown",
      }),
    );
  }
  matches.sort((left, right) => left.issueId.localeCompare(right.issueId));
  const matchByIssueId = new Map(matches.map((match) => [match.issueId, match]));
  if (
    unknown.some(
      (entry) =>
        entry.issueId === undefined || matchByIssueId.get(entry.issueId)?.dataState === "known",
    ) &&
    matches.some((match) => match.dataState === "known")
  ) {
    fail("RUNTIME_UNKNOWN_STATE_CONTRADICTION");
  }
  if (
    (snapshot.provider === "ready" &&
      (unknown.length > 0 || matches.some((match) => match.dataState === "unknown"))) ||
    (snapshot.provider === "unavailable" &&
      (matches.some((match) => match.dataState === "known") || matches.length === 0))
  ) {
    fail("RUNTIME_PROVIDER_STATE_CONTRADICTION");
  }

  return {
    schemaVersion: 1,
    ...(context ? { context } : {}),
    scope: { mode: "targeted", requestedIssueIds },
    matches,
    unknown,
  };
}

export function validateRuntimeSnapshot(
  input,
  expectedSelection,
  { expectedContext, requireRaw = false } = {},
) {
  return validateRuntimeSnapshotInternal(input, expectedSelection, {
    expectedContext,
    requireRaw,
  });
}

export function validateRuntimeAuditSnapshot(input, expectedSelection, { expectedContext } = {}) {
  if (expectedContext === undefined) fail("RUNTIME_EXPECTED_CONTEXT_REQUIRED");
  return validateRuntimeSnapshotInternal(input, expectedSelection, {
    expectedContext,
    requireRaw: true,
    allowOpaqueNonTerminal: true,
  });
}

function rawEnvelopeForTargetedMerge(input, selectedRows, expectedContext) {
  const snapshot = object(input, "RUNTIME_SNAPSHOT_INVALID");
  if (snapshot.schemaVersion !== 1) fail("RUNTIME_SNAPSHOT_SCHEMA_INVALID");
  if (!PROVIDER_STATES.has(snapshot.provider)) fail("RUNTIME_PROVIDER_STATE_REQUIRED");
  if (snapshot.matches !== undefined || !Array.isArray(snapshot.issues)) {
    fail("RUNTIME_RAW_ENVELOPE_REQUIRED");
  }
  if (
    snapshot.scope?.mode !== undefined ||
    !Array.isArray(snapshot.scope?.selectedIssueIds) ||
    new Set(snapshot.scope.selectedIssueIds).size !== snapshot.scope.selectedIssueIds.length
  ) {
    fail("RUNTIME_RAW_SCOPE_INVALID");
  }
  if (!Array.isArray(snapshot.unknown)) fail("RUNTIME_UNKNOWN_INVALID");

  const selection = normalizeSelection(selectedRows, { allowOpaqueNonTerminal: true });
  const expectedIssueIds = selection.map((row) => row.issueId);
  const expectedIssueSet = new Set(expectedIssueIds);
  const context = normalizeContext(snapshot.context, "RUNTIME_CONTEXT_INVALID");
  const normalizedExpectedContext = normalizeContext(
    expectedContext,
    "RUNTIME_EXPECTED_CONTEXT_INVALID",
  );
  if (CONTEXT_FIELDS.some((field) => context[field] !== normalizedExpectedContext[field])) {
    fail("RUNTIME_CONTEXT_MISMATCH");
  }
  const requestedIssueIds = normalizeScope(snapshot.scope);
  exactSet(requestedIssueIds, expectedIssueIds, "RUNTIME_SCOPE_MISMATCH");

  const seen = new Set();
  const issues = snapshot.issues.map((inputIssue) => {
    const row = object(inputIssue, "RUNTIME_MATCH_INVALID");
    const issueId = nonEmptyString(row.issueId, "RUNTIME_MATCH_INVALID");
    if (!expectedIssueSet.has(issueId)) {
      fail("RUNTIME_MATCH_SCOPE_MISMATCH", undefined, [issueId]);
    }
    if (seen.has(issueId)) fail("RUNTIME_MATCH_DUPLICATE", undefined, [issueId]);
    seen.add(issueId);
    return row;
  });
  const unknown = normalizeUnknownEntries(snapshot.unknown);
  if (
    unknown.some((entry) => entry.issueId !== undefined && !expectedIssueSet.has(entry.issueId))
  ) {
    fail("RUNTIME_UNKNOWN_SCOPE_MISMATCH");
  }
  const coveredIssueIds = [
    ...new Set([
      ...seen,
      ...unknown.flatMap((entry) => (entry.issueId === undefined ? [] : [entry.issueId])),
    ]),
  ].sort((left, right) => left.localeCompare(right));
  exactSet(coveredIssueIds, expectedIssueIds, "RUNTIME_MATCH_SCOPE_MISMATCH");
  return { selection, context, requestedIssueIds, issues, unknown };
}

function compareUnknown(left, right) {
  const issueOrder = (left.issueId ?? "").localeCompare(right.issueId ?? "");
  const codeOrder = left.code.localeCompare(right.code);
  return issueOrder || codeOrder || left.detail.localeCompare(right.detail);
}

function finalizedTargetedMerge(initial, issues, unknown, expectedContext) {
  issues.sort((left, right) => left.issueId.localeCompare(right.issueId));
  unknown.sort(compareUnknown);
  const provider = unknown.length === 0 ? "ready" : issues.length === 0 ? "unavailable" : "partial";
  const merged = {
    schemaVersion: 1,
    provider,
    context: initial.context,
    scope: { selectedIssueIds: initial.requestedIssueIds },
    issues,
    unknown,
  };
  validateRuntimeAuditSnapshot(merged, initial.selection, { expectedContext });
  return merged;
}

function targetedRetryScope(initial, retryIssueIds) {
  const retryIds = uniqueStrings(retryIssueIds, "RUNTIME_RETRY_SCOPE_INVALID");
  if (
    !Array.isArray(retryIssueIds) ||
    retryIds.length !== retryIssueIds.length ||
    retryIds.length === 0
  ) {
    fail("RUNTIME_RETRY_SCOPE_INVALID");
  }
  const selectionByIssueId = new Map(initial.selection.map((row) => [row.issueId, row]));
  if (retryIds.some((issueId) => !selectionByIssueId.has(issueId))) {
    fail("RUNTIME_RETRY_SCOPE_MISMATCH");
  }
  return {
    retryIds,
    retryRows: retryIds.map((issueId) => selectionByIssueId.get(issueId)),
  };
}

export function mergeTargetedRuntimeSnapshot(
  initialSnapshot,
  retrySnapshot,
  { selectedRows, retryIssueIds, expectedContext } = {},
) {
  if (expectedContext === undefined) fail("RUNTIME_EXPECTED_CONTEXT_REQUIRED");
  const initial = rawEnvelopeForTargetedMerge(initialSnapshot, selectedRows, expectedContext);
  const { retryIds, retryRows } = targetedRetryScope(initial, retryIssueIds);
  validateRuntimeAuditSnapshot(retrySnapshot, retryRows, { expectedContext });

  const retrySet = new Set(retryIds);
  const issues = [
    ...initial.issues.filter((row) => !retrySet.has(row.issueId)),
    ...retrySnapshot.issues,
  ];
  const unknown = [
    ...initial.unknown.filter(
      (entry) => entry.issueId === undefined || !retrySet.has(entry.issueId),
    ),
    ...retrySnapshot.unknown,
  ];
  return finalizedTargetedMerge(initial, issues, unknown, expectedContext);
}

export function mergeTargetedRuntimeSnapshotUnknown(
  initialSnapshot,
  { selectedRows, retryIssueIds, expectedContext, code, detail } = {},
) {
  if (expectedContext === undefined) fail("RUNTIME_EXPECTED_CONTEXT_REQUIRED");
  const initial = rawEnvelopeForTargetedMerge(initialSnapshot, selectedRows, expectedContext);
  const { retryIds } = targetedRetryScope(initial, retryIssueIds);
  const normalizedCode = nonEmptyString(code, "RUNTIME_RETRY_UNKNOWN_INVALID");
  const normalizedDetail = nonEmptyString(detail, "RUNTIME_RETRY_UNKNOWN_INVALID");
  const retrySet = new Set(retryIds);
  const issues = initial.issues.filter((row) => !retrySet.has(row.issueId));
  const unknown = [
    ...initial.unknown.filter(
      (entry) => entry.issueId === undefined || !retrySet.has(entry.issueId),
    ),
    ...retryIds.map((issueId) => ({
      issueId,
      code: normalizedCode,
      detail: normalizedDetail,
    })),
  ];
  return finalizedTargetedMerge(initial, issues, unknown, expectedContext);
}
