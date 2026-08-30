import { validateRuntimeSnapshot } from "./runtime-snapshot.mjs";

const SELECTABLE_CLASSIFICATIONS = new Set(["ready", "started"]);

export const RUNTIME_ACTION_REASONS = Object.freeze({
  configurationMissing: "CONFIGURATION_MISSING",
  controlInactive: "CONTROL_INACTIVE",
  identityMissing: "IDENTITY_MISSING",
  lockHeld: "LOCK_HELD",
  runtimeAmbiguous: "RUNTIME_AMBIGUOUS",
  runtimeUnknown: "RUNTIME_UNKNOWN",
  forceConfirmationRequired: "FORCE_CONFIRMATION_REQUIRED",
  startedWithoutRuntime: "STARTED_WITHOUT_RUNTIME",
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function uniqueIssueIds(value, code) {
  if (!Array.isArray(value)) fail(code);
  const issueIds = value.map((issueId) => {
    if (typeof issueId !== "string" || issueId.length === 0) fail(code);
    return issueId;
  });
  if (new Set(issueIds).size !== issueIds.length) fail(code);
  return issueIds.sort((left, right) => left.localeCompare(right));
}

function normalizedUncertainties(value, code) {
  if (!Array.isArray(value)) fail(code);
  const seen = new Set();
  const uncertainties = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(code);
    const keys = Object.keys(entry).sort((left, right) => left.localeCompare(right));
    if (keys.length !== 2 || keys[0] !== "code" || keys[1] !== "issueId") fail(code);
    if (
      (entry.issueId !== null &&
        (typeof entry.issueId !== "string" || entry.issueId.length === 0)) ||
      typeof entry.code !== "string" ||
      entry.code.length === 0
    ) {
      fail(code);
    }
    const normalized = { issueId: entry.issueId, code: entry.code };
    const key = JSON.stringify([normalized.issueId, normalized.code]);
    if (seen.has(key)) fail(code);
    seen.add(key);
    return normalized;
  });
  return uncertainties.sort((left, right) => {
    const issueOrder = (left.issueId ?? "").localeCompare(right.issueId ?? "");
    return issueOrder || left.code.localeCompare(right.code);
  });
}

function frontierRows(frontierPlan) {
  if (!frontierPlan || !Array.isArray(frontierPlan.rows)) fail("FRONTIER_PLAN_INVALID");
  const seen = new Set();
  const rows = frontierPlan.rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.issueId !== "string" ||
      typeof row.linearStatusType !== "string" ||
      row.linearStatusType.length === 0
    ) {
      fail("FRONTIER_PLAN_INVALID");
    }
    if (seen.has(row.issueId)) fail("FRONTIER_PLAN_DUPLICATE");
    seen.add(row.issueId);
    if (row.forced === true) {
      return {
        ...row,
        forceBypassedBlockerIssueIds: uniqueIssueIds(
          row.forceBypassedBlockerIssueIds,
          "FRONTIER_PLAN_INVALID",
        ),
        forceBypassedUncertainties: normalizedUncertainties(
          row.forceBypassedUncertainties,
          "FRONTIER_PLAN_INVALID",
        ),
      };
    }
    return row;
  });
  return rows;
}

function selection(frontierPlan, selectedIssueIds) {
  const rows = frontierRows(frontierPlan);
  const byIssueId = new Map(rows.map((row) => [row.issueId, row]));
  const issueIds =
    selectedIssueIds === undefined
      ? rows
          .filter((row) => SELECTABLE_CLASSIFICATIONS.has(row.classification))
          .map((row) => row.issueId)
          .sort((left, right) => left.localeCompare(right))
      : uniqueIssueIds(selectedIssueIds, "RUNTIME_SELECTION_INVALID");

  return issueIds.map((issueId) => {
    const row = byIssueId.get(issueId);
    if (!row) fail("RUNTIME_SELECTION_MISSING_FROM_FRONTIER");
    if (!SELECTABLE_CLASSIFICATIONS.has(row.classification)) {
      fail(
        row.classification === "terminal"
          ? "RUNTIME_TERMINAL_SELECTION_FORBIDDEN"
          : "RUNTIME_NON_CANDIDATE_SELECTION_FORBIDDEN",
      );
    }
    return row;
  });
}

function configured(control, explicit) {
  if (explicit === false) return false;
  if (control === undefined) return true;
  return (
    typeof control.projectId === "string" &&
    control.projectId.length > 0 &&
    typeof control.targetHostId === "string" &&
    control.targetHostId.length > 0 &&
    typeof control.supersetProjectId === "string" &&
    control.supersetProjectId.length > 0 &&
    typeof control.defaultAgent === "string" &&
    control.defaultAgent.length > 0 &&
    typeof control.runId === "string" &&
    control.runId.length > 0 &&
    Number.isInteger(control.maxConcurrency) &&
    control.maxConcurrency >= 1 &&
    control.maxConcurrency <= 10
  );
}

function expectedRuntimeContext(control) {
  if (
    !control ||
    typeof control.projectId !== "string" ||
    control.projectId.length === 0 ||
    typeof control.targetHostId !== "string" ||
    control.targetHostId.length === 0 ||
    typeof control.supersetProjectId !== "string" ||
    control.supersetProjectId.length === 0
  ) {
    return undefined;
  }
  return {
    targetHostId: control.targetHostId,
    supersetProjectId: control.supersetProjectId,
    linearProjectId: control.projectId,
  };
}

function forceAuthorizationScope(value, expectedInvocationId) {
  if (value === undefined) {
    return { bypasses: new Map(), uncertainties: new Map(), invocationId: undefined };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("RUNTIME_FORCE_AUTHORIZATION_INVALID");
  }
  if (
    typeof value.invocationId !== "string" ||
    value.invocationId.length === 0 ||
    typeof value.confirmedAt !== "string" ||
    value.confirmedAt.length === 0 ||
    Number.isNaN(Date.parse(value.confirmedAt)) ||
    !value.bypassedBlockerIssueIds ||
    typeof value.bypassedBlockerIssueIds !== "object" ||
    Array.isArray(value.bypassedBlockerIssueIds) ||
    !value.bypassedUncertainties ||
    typeof value.bypassedUncertainties !== "object" ||
    Array.isArray(value.bypassedUncertainties)
  ) {
    fail("RUNTIME_FORCE_AUTHORIZATION_INVALID");
  }
  if (
    typeof expectedInvocationId !== "string" ||
    expectedInvocationId.length === 0 ||
    value.invocationId !== expectedInvocationId
  ) {
    fail("RUNTIME_FORCE_AUTHORIZATION_INVOCATION_MISMATCH");
  }
  const issueIds = uniqueIssueIds(value.issueIds, "RUNTIME_FORCE_AUTHORIZATION_INVALID");
  const bypasses = new Map();
  const uncertainties = new Map();
  for (const [issueId, blockerIssueIds] of Object.entries(value.bypassedBlockerIssueIds)) {
    if (!issueIds.includes(issueId)) fail("RUNTIME_FORCE_AUTHORIZATION_INVALID");
    bypasses.set(issueId, uniqueIssueIds(blockerIssueIds, "RUNTIME_FORCE_AUTHORIZATION_INVALID"));
  }
  for (const [issueId, entries] of Object.entries(value.bypassedUncertainties)) {
    if (!issueIds.includes(issueId)) fail("RUNTIME_FORCE_AUTHORIZATION_INVALID");
    uncertainties.set(
      issueId,
      normalizedUncertainties(entries, "RUNTIME_FORCE_AUTHORIZATION_INVALID"),
    );
  }
  for (const issueId of issueIds) {
    if (!bypasses.has(issueId) || !uncertainties.has(issueId)) {
      fail("RUNTIME_FORCE_AUTHORIZATION_INVALID");
    }
  }
  return { bypasses, uncertainties, invocationId: value.invocationId };
}

function blockedAction(match, row, reason, forceRefusal) {
  return {
    issueId: match.issueId,
    action: "non-transportable",
    linearClassification: row.classification,
    linearStatusType: row.linearStatusType,
    ...(match.taskId ? { taskId: match.taskId } : {}),
    reason,
    ...(row.forced === true ? { forceRefusal } : {}),
    forced: row.forced === true,
  };
}

function actionForMatch(match, row, options) {
  if (options.control !== undefined && options.control.active !== true) {
    return blockedAction(match, row, RUNTIME_ACTION_REASONS.controlInactive, "control-inactive");
  }
  if (!configured(options.control, options.transportConfigured)) {
    return blockedAction(
      match,
      row,
      RUNTIME_ACTION_REASONS.configurationMissing,
      "configuration-missing",
    );
  }
  if (options.lockAvailable === false) {
    return blockedAction(match, row, RUNTIME_ACTION_REASONS.lockHeld, "lock-held");
  }
  if (match.dataState !== "known") {
    return blockedAction(match, row, RUNTIME_ACTION_REASONS.runtimeUnknown);
  }
  if (!match.taskId) {
    return blockedAction(match, row, RUNTIME_ACTION_REASONS.identityMissing, "identity-missing");
  }
  if (match.workspaceIds.length > 1 || match.activeTerminalIds.length > 1) {
    return {
      issueId: match.issueId,
      action: "ambiguous",
      linearClassification: row.classification,
      linearStatusType: row.linearStatusType,
      taskId: match.taskId,
      reason: RUNTIME_ACTION_REASONS.runtimeAmbiguous,
      ...(row.forced === true ? { forceRefusal: "runtime-ambiguous" } : {}),
      forced: row.forced === true,
    };
  }

  const common = {
    issueId: match.issueId,
    taskId: match.taskId,
    forced: row.forced === true,
    linearClassification: row.classification,
    linearStatusType: row.linearStatusType,
  };
  if (match.workspaceIds.length === 0) {
    if (row.forced === true && !options.forceAuthorizedIssueIds.has(match.issueId)) {
      return {
        ...common,
        action: "confirm",
        reason: RUNTIME_ACTION_REASONS.forceConfirmationRequired,
      };
    }
    if (row.classification === "started" && !options.confirmedIssueIds.has(match.issueId)) {
      return {
        ...common,
        action: "confirm",
        reason: RUNTIME_ACTION_REASONS.startedWithoutRuntime,
      };
    }
    return {
      ...common,
      action: "create",
      ...(row.classification === "started" ? { confirmationAccepted: true } : {}),
      ...(row.forced === true
        ? {
            forceAuthorized: true,
            confirmationAccepted: true,
            forceBypassedBlockerIssueIds: options.forceAuthorizedIssueIds.get(match.issueId),
            forceBypassedUncertainties: options.forceAuthorizedUncertainties.get(match.issueId),
            forceInvocationId: options.forceInvocationId,
          }
        : {}),
    };
  }

  const workspaceId = match.workspaceIds[0];
  if (match.activeTerminalIds.length === 1) {
    return {
      ...common,
      action: "monitor",
      workspaceId,
      terminalId: match.activeTerminalIds[0],
    };
  }
  if (row.forced === true && !options.forceAuthorizedIssueIds.has(match.issueId)) {
    return {
      ...common,
      action: "confirm",
      workspaceId,
      reason: RUNTIME_ACTION_REASONS.forceConfirmationRequired,
    };
  }
  if (row.classification === "started" && !options.confirmedIssueIds.has(match.issueId)) {
    return {
      ...common,
      action: "confirm",
      workspaceId,
      reason: RUNTIME_ACTION_REASONS.startedWithoutRuntime,
    };
  }
  return {
    ...common,
    action: "reuse",
    workspaceId,
    ...(row.classification === "started" ? { confirmationAccepted: true } : {}),
    ...(row.forced === true
      ? {
          forceAuthorized: true,
          confirmationAccepted: true,
          forceBypassedBlockerIssueIds: options.forceAuthorizedIssueIds.get(match.issueId),
          forceBypassedUncertainties: options.forceAuthorizedUncertainties.get(match.issueId),
          forceInvocationId: options.forceInvocationId,
        }
      : {}),
  };
}

export function planRuntimeActions(frontierPlan, runtimeSnapshot, options = {}) {
  const selectedRows = selection(frontierPlan, options.selectedIssueIds);
  const expectedContext = expectedRuntimeContext(options.control);
  const snapshot = validateRuntimeSnapshot(
    runtimeSnapshot,
    selectedRows,
    expectedContext ? { expectedContext, requireRaw: true } : { requireRaw: true },
  );
  const selectedIssueIds = selectedRows.map((row) => row.issueId);
  const selectedSet = new Set(selectedIssueIds);
  const confirmedIssueIds = new Set(
    uniqueIssueIds(options.confirmedIssueIds ?? [], "RUNTIME_CONFIRMATION_INVALID"),
  );
  const forceAuthorization = forceAuthorizationScope(
    options.forceAuthorization,
    options.invocationId,
  );
  const forceAuthorizedIssueIds = forceAuthorization.bypasses;
  const forceAuthorizedUncertainties = forceAuthorization.uncertainties;
  if (
    [...confirmedIssueIds, ...forceAuthorizedIssueIds.keys()].some(
      (issueId) => !selectedSet.has(issueId),
    )
  ) {
    fail("RUNTIME_CONFIRMATION_SCOPE_MISMATCH");
  }

  const rowByIssueId = new Map(selectedRows.map((row) => [row.issueId, row]));
  if (
    [...confirmedIssueIds].some(
      (issueId) => rowByIssueId.get(issueId)?.classification !== "started",
    )
  ) {
    fail("RUNTIME_CONFIRMATION_SCOPE_MISMATCH");
  }
  if (
    [...forceAuthorizedIssueIds.keys()].some(
      (issueId) => rowByIssueId.get(issueId)?.forced !== true,
    )
  ) {
    fail("RUNTIME_FORCE_AUTHORIZATION_SCOPE_MISMATCH");
  }
  for (const [issueId, blockerIssueIds] of forceAuthorizedIssueIds) {
    const row = rowByIssueId.get(issueId);
    const uncertainties = forceAuthorizedUncertainties.get(issueId);
    if (
      JSON.stringify(blockerIssueIds) !== JSON.stringify(row.forceBypassedBlockerIssueIds) ||
      JSON.stringify(uncertainties) !== JSON.stringify(row.forceBypassedUncertainties)
    ) {
      fail("RUNTIME_FORCE_AUTHORIZATION_SCOPE_MISMATCH");
    }
  }
  const actions = snapshot.matches
    .map((match) =>
      actionForMatch(match, rowByIssueId.get(match.issueId), {
        ...options,
        confirmedIssueIds,
        forceAuthorizedIssueIds,
        forceAuthorizedUncertainties,
        forceInvocationId: forceAuthorization.invocationId,
      }),
    )
    .sort((left, right) => left.issueId.localeCompare(right.issueId));

  return {
    actions,
    selectedIssueIds,
    confirmationIssueIds: actions
      .filter((action) => action.action === "confirm")
      .map((action) => action.issueId),
    capacityUsed: actions.filter((action) => action.action === "monitor").length,
  };
}
