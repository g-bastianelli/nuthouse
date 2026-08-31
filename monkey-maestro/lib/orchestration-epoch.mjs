import { planLinearFrontier } from "./linear-frontier.mjs";
import { validateLinearSnapshot } from "./linear-snapshot.mjs";
import {
  isOrchestrationEffectSignal,
  OrchestrationEffectsRequired,
  requiredOrchestrationEffects,
} from "./orchestration-effect-signal.mjs";
import { validateRuntimeSnapshot } from "./runtime-snapshot.mjs";

const DISPATCH_ACTIONS = new Set(["create", "reuse"]);
const RUNTIME_ACTION_TYPES = new Set([
  "create",
  "reuse",
  "monitor",
  "confirm",
  "ambiguous",
  "non-transportable",
]);
const TERMINAL_STATUS_TYPES = new Set(["completed", "canceled"]);
const FRONTIER_CLASSIFICATIONS = new Set(["terminal", "ready", "started", "blocked", "unknown"]);
const DISPATCH_RESULT_STATES = new Set(["verified", "partial", "ambiguous", "failed"]);
const RECORD_STATES = new Set(["written", "failed", "not-attempted"]);

export class OrchestrationEpochError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "OrchestrationEpochError";
    this.code = code;
  }
}

function fail(code) {
  throw new OrchestrationEpochError(code);
}

function sortedUniqueIssueIds(values) {
  if (!Array.isArray(values)) fail("ISSUE_SCOPE_INVALID");
  const issueIds = values.map((issueId) => {
    if (typeof issueId !== "string" || issueId.length === 0) fail("ISSUE_SCOPE_INVALID");
    return issueId;
  });
  return [...new Set(issueIds)].sort((left, right) => left.localeCompare(right));
}

function exactIssueScope(values) {
  const issueIds = sortedUniqueIssueIds(values);
  if (issueIds.length !== values.length) fail("ISSUE_SCOPE_INVALID");
  return issueIds;
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

function uncertaintyKey(entry) {
  return JSON.stringify([entry.issueId, entry.code]);
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizedError(error) {
  return {
    code: typeof error?.code === "string" ? error.code : "DISPATCH_FAILED",
    message: error instanceof Error ? error.message : String(error),
  };
}

function effectRequired(error) {
  return isOrchestrationEffectSignal(error);
}

function requiredEffectBatch(errors) {
  return new OrchestrationEffectsRequired(
    errors.flatMap((error) => requiredOrchestrationEffects(error) ?? []),
  );
}

function throwRequiredEffects(settled) {
  const errors = settled
    .filter((entry) => entry.status === "rejected" && effectRequired(entry.reason))
    .map((entry) => entry.reason);
  if (errors.length > 0) throw requiredEffectBatch(errors);
}

function settledResults(actions, settled) {
  return settled.map((entry, index) => ({
    issueId: actions[index].issueId,
    status: entry.status,
    ...(entry.status === "fulfilled"
      ? { value: entry.value }
      : { reason: normalizedError(entry.reason) }),
  }));
}

function requireFunction(value, code) {
  if (typeof value !== "function") fail(code);
  return value;
}

function requiredString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function lockReceipt(input, { directory, projectId, hostId }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("LOCK_RECEIPT_INVALID");
  }
  const token = requiredString(input.token, "LOCK_RECEIPT_INVALID");
  const owner = input.owner;
  if (
    input.directory !== directory ||
    input.projectId !== projectId ||
    !owner ||
    typeof owner !== "object" ||
    Array.isArray(owner) ||
    owner.schemaVersion !== 2 ||
    owner.projectId !== projectId ||
    owner.hostId !== hostId ||
    owner.token !== token
  ) {
    fail("LOCK_RECEIPT_INVALID");
  }
  const createdAt = Date.parse(owner.createdAt);
  const expiresAt = Date.parse(owner.expiresAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    fail("LOCK_RECEIPT_INVALID");
  }
  return input;
}

function runtimePlanActions(runtimePlan) {
  if (!runtimePlan || !Array.isArray(runtimePlan.actions)) fail("RUNTIME_PLAN_INVALID");
  const seen = new Set();
  const actions = [...runtimePlan.actions]
    .map((action) => {
      if (!action || typeof action.issueId !== "string" || typeof action.action !== "string") {
        fail("RUNTIME_PLAN_INVALID");
      }
      if (!RUNTIME_ACTION_TYPES.has(action.action)) fail("RUNTIME_PLAN_INVALID");
      if (
        typeof action.forced !== "boolean" ||
        typeof action.linearClassification !== "string" ||
        typeof action.linearStatusType !== "string"
      ) {
        fail("RUNTIME_PLAN_INVALID");
      }
      if (
        ["create", "reuse", "monitor"].includes(action.action) &&
        (typeof action.taskId !== "string" || action.taskId.length === 0)
      ) {
        fail("RUNTIME_PLAN_INVALID");
      }
      if (
        ["reuse", "monitor"].includes(action.action) &&
        (typeof action.workspaceId !== "string" || action.workspaceId.length === 0)
      ) {
        fail("RUNTIME_PLAN_INVALID");
      }
      if (
        action.action === "monitor" &&
        (typeof action.terminalId !== "string" || action.terminalId.length === 0)
      ) {
        fail("RUNTIME_PLAN_INVALID");
      }
      if (seen.has(action.issueId)) fail("RUNTIME_PLAN_DUPLICATE");
      seen.add(action.issueId);
      return action;
    })
    .sort((left, right) => left.issueId.localeCompare(right.issueId));
  if (runtimePlan.selectedIssueIds !== undefined) {
    const selectedIssueIds = exactIssueScope(runtimePlan.selectedIssueIds);
    if (
      !sameStrings(
        selectedIssueIds,
        actions.map((action) => action.issueId),
      )
    ) {
      fail("RUNTIME_PLAN_SCOPE_MISMATCH");
    }
  }
  const confirmationIssueIds = actions
    .filter((action) => action.action === "confirm")
    .map((action) => action.issueId);
  if (
    runtimePlan.confirmationIssueIds !== undefined &&
    !sameStrings(sortedUniqueIssueIds(runtimePlan.confirmationIssueIds), confirmationIssueIds)
  ) {
    fail("RUNTIME_PLAN_CONFIRMATION_MISMATCH");
  }
  return actions;
}

function dispatchContexts(input, actions) {
  const value = input ?? {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("DISPATCH_CONTEXT_INVALID");
  }
  const expectedIssueIds = actions.map((action) => action.issueId);
  const actualIssueIds = Object.keys(value).sort((left, right) => left.localeCompare(right));
  if (!sameStrings(actualIssueIds, expectedIssueIds)) fail("DISPATCH_CONTEXT_SCOPE_MISMATCH");
  return new Map(
    expectedIssueIds.map((issueId) => {
      const context = value[issueId];
      if (!context || typeof context !== "object" || Array.isArray(context)) {
        fail("DISPATCH_CONTEXT_INVALID");
      }
      const keys = Object.keys(context).sort((left, right) => left.localeCompare(right));
      if (!sameStrings(keys, ["branchName", "workerPrompt", "workspaceName"])) {
        fail("DISPATCH_CONTEXT_INVALID");
      }
      return [
        issueId,
        {
          branchName: requiredString(context.branchName, "DISPATCH_CONTEXT_INVALID"),
          workerPrompt: requiredString(context.workerPrompt, "DISPATCH_CONTEXT_INVALID"),
          workspaceName: requiredString(context.workspaceName, "DISPATCH_CONTEXT_INVALID"),
        },
      ];
    }),
  );
}

function frontierRows(frontierPlan) {
  if (!frontierPlan || !Array.isArray(frontierPlan.rows)) fail("FRONTIER_PLAN_INVALID");
  const rows = new Map();
  for (const row of frontierPlan.rows) {
    if (
      !row ||
      typeof row.issueId !== "string" ||
      !FRONTIER_CLASSIFICATIONS.has(row.classification) ||
      typeof row.linearStatusType !== "string" ||
      row.linearStatusType.length === 0 ||
      !Array.isArray(row.blockerIssueIds) ||
      rows.has(row.issueId)
    ) {
      fail("FRONTIER_PLAN_INVALID");
    }
    const normalized = {
      ...row,
      blockerIssueIds: exactIssueScope(row.blockerIssueIds),
    };
    if (row.forced === true) {
      normalized.forceBypassedBlockerIssueIds = exactIssueScope(row.forceBypassedBlockerIssueIds);
      normalized.forceBypassedUncertainties = normalizedUncertainties(
        row.forceBypassedUncertainties,
        "FRONTIER_PLAN_INVALID",
      );
    }
    rows.set(row.issueId, normalized);
  }
  return rows;
}

function cachedDependentsByBlocker(rows) {
  const dependents = new Map();
  for (const row of rows.values()) {
    if (row.classification === "terminal") continue;
    for (const blockerIssueId of row.blockerIssueIds) {
      const issueIds = dependents.get(blockerIssueId) ?? [];
      issueIds.push(row.issueId);
      dependents.set(blockerIssueId, issueIds);
    }
  }
  for (const [blockerIssueId, issueIds] of dependents) {
    dependents.set(blockerIssueId, sortedUniqueIssueIds(issueIds));
  }
  return dependents;
}

function exactRefreshScope(snapshot, issueId) {
  const candidate = snapshot.issues.find((issue) => issue.issueId === issueId);
  if (!candidate) fail("PRE_DISPATCH_CANDIDATE_MISSING");
  const expectedIssueIds = sortedUniqueIssueIds([issueId, ...candidate.blockerIssueIds]);
  const actualIssueIds = snapshot.issues
    .map((issue) => issue.issueId)
    .sort((left, right) => left.localeCompare(right));
  const requestedIssueIds = [...snapshot.scope.requestedIssueIds].sort((left, right) =>
    left.localeCompare(right),
  );
  if (
    !sameStrings(actualIssueIds, expectedIssueIds) ||
    !sameStrings(requestedIssueIds, expectedIssueIds)
  ) {
    fail("PRE_DISPATCH_SCOPE_MISMATCH");
  }
  return candidate;
}

function candidateAuthorizationSnapshot(snapshot, candidate) {
  const scopedIssueIds = new Set(snapshot.issues.map((issue) => issue.issueId));
  return {
    ...snapshot,
    issues: snapshot.issues.map((issue) =>
      issue.issueId === candidate.issueId
        ? issue
        : {
            ...issue,
            blockerIssueIds: issue.blockerIssueIds.filter((issueId) => scopedIssueIds.has(issueId)),
          },
    ),
  };
}

export function authorizeFreshCandidate({ action, snapshot: input, projectId }) {
  const snapshot = validateLinearSnapshot(input, projectId ? { expectedProjectId: projectId } : {});
  const candidate = exactRefreshScope(snapshot, action.issueId);
  if (TERMINAL_STATUS_TYPES.has(candidate.statusType)) {
    return { authorized: false, reason: "TERMINAL" };
  }
  if (candidate.statusType === "started" && action.linearStatusType !== "started") {
    return { authorized: false, reason: "CONFIRMATION_REQUIRED" };
  }
  if (
    action.forced === true &&
    (action.forceAuthorized !== true ||
      action.confirmationAccepted !== true ||
      !Array.isArray(action.forceBypassedUncertainties))
  ) {
    return { authorized: false, reason: "CONFIRMATION_REQUIRED" };
  }
  // The under-lock refresh intentionally contains only the candidate and its direct blockers.
  // Do not reinterpret a direct blocker's omitted subgraph as newly missing Linear data: only
  // its live status and explicit unknown evidence can change this candidate's authorization.
  const freshPlan = planLinearFrontier(candidateAuthorizationSnapshot(snapshot, candidate), {
    forcedIssueIds: action.forced === true ? [action.issueId] : [],
  });
  const freshRow = freshPlan.rows.find((row) => row.issueId === action.issueId);
  if (!freshRow) return { authorized: false, reason: "LINEAR_UNKNOWN" };
  if (action.forced === true) {
    const confirmedBypasses = Array.isArray(action.forceBypassedBlockerIssueIds)
      ? sortedUniqueIssueIds(action.forceBypassedBlockerIssueIds)
      : [];
    if (
      freshRow.forced === true &&
      exactIssueScope(freshRow.forceBypassedBlockerIssueIds).some(
        (issueId) => !confirmedBypasses.includes(issueId),
      )
    ) {
      return { authorized: false, reason: "FORCE_SCOPE_CHANGED" };
    }
    const confirmedUncertaintyKeys = new Set(
      normalizedUncertainties(
        action.forceBypassedUncertainties,
        "RUNTIME_PLAN_FORCE_SCOPE_INVALID",
      ).map(uncertaintyKey),
    );
    if (
      freshRow.forced === true &&
      normalizedUncertainties(
        freshRow.forceBypassedUncertainties,
        "RUNTIME_PLAN_FORCE_SCOPE_INVALID",
      ).some((uncertainty) => !confirmedUncertaintyKeys.has(uncertaintyKey(uncertainty)))
    ) {
      return { authorized: false, reason: "FORCE_SCOPE_CHANGED" };
    }
  }

  if (freshRow.classification === "ready") {
    return {
      authorized: true,
      candidate,
      blockerIssueIds: freshRow.blockerIssueIds,
      freshRow,
    };
  }
  if (freshRow.classification === "started" && action.confirmationAccepted === true) {
    if (action.linearClassification !== "started") {
      return { authorized: false, reason: "CONFIRMATION_REQUIRED", freshRow };
    }
    return {
      authorized: true,
      candidate,
      blockerIssueIds: freshRow.blockerIssueIds,
      freshRow,
    };
  }
  return {
    authorized: false,
    reason:
      freshRow.classification === "terminal"
        ? "TERMINAL"
        : freshRow.classification === "started"
          ? "CONFIRMATION_REQUIRED"
          : (freshRow.reason ?? freshRow.classification.toUpperCase()),
    freshRow,
  };
}

function normalizeInspection(input, action, control) {
  if (
    input?.schemaVersion !== 1 ||
    (!Array.isArray(input.matches) && !Array.isArray(input.issues))
  ) {
    fail("RUNTIME_INSPECTION_ENVELOPE_REQUIRED");
  }
  const match = validateRuntimeSnapshot(
    input,
    [
      {
        issueId: action.issueId,
        classification: action.linearClassification,
        blockerIssueIds: [],
      },
    ],
    {
      requireRaw: true,
      expectedContext: {
        targetHostId: control.targetHostId,
        supersetProjectId: control.supersetProjectId,
        linearProjectId: control.projectId,
      },
    },
  ).matches[0];
  if (!match.taskId || match.taskId !== action.taskId) fail("IDENTITY_MISMATCH");
  return match;
}

function ambiguousRuntime(match) {
  return match.workspaceIds.length > 1 || match.activeTerminalIds.length > 1;
}

function preservedRuntime(match) {
  if (match.dataState !== "known" || match.workspaceIds.length !== 1 || ambiguousRuntime(match)) {
    return { outcome: "isolated", reason: "MUTATION_AMBIGUOUS" };
  }
  return {
    outcome: "preserved",
    action: match.activeTerminalIds.length === 1 ? "monitor" : "reuse",
    workspaceId: match.workspaceIds[0],
    ...(match.activeTerminalIds.length === 1 ? { terminalId: match.activeTerminalIds[0] } : {}),
  };
}

function ambiguousMutationError(error) {
  return error?.code === "MUTATION_AMBIGUOUS" || error?.ambiguous === true;
}

function exactRuntimeContext(input, control) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.targetHostId !== control.targetHostId ||
    input.supersetProjectId !== control.supersetProjectId ||
    input.linearProjectId !== control.projectId
  ) {
    fail("DISPATCH_RESULT_CONTEXT_MISMATCH");
  }
}

function dispatchIdentity(input, action, control) {
  if (
    input.issueId !== action.issueId ||
    input.taskId !== action.taskId ||
    !input.context ||
    typeof input.context !== "object" ||
    Array.isArray(input.context)
  ) {
    fail("DISPATCH_RESULT_IDENTITY_MISMATCH");
  }
  exactRuntimeContext(input.context, control);
}

function dispatchLockVerification(input, lock) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("DISPATCH_LOCK_VERIFICATION_INVALID");
  }
  if (
    input.directory !== lock.directory ||
    input.projectId !== lock.projectId ||
    input.hostId !== lock.owner.hostId ||
    input.token !== lock.token ||
    input.expiresAt !== lock.owner.expiresAt
  ) {
    fail("DISPATCH_LOCK_VERIFICATION_INVALID");
  }
  const createdAt = Date.parse(lock.owner.createdAt);
  const verifiedAt = Date.parse(input.verifiedAt);
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(verifiedAt) || verifiedAt < createdAt || verifiedAt >= expiresAt) {
    fail("DISPATCH_LOCK_VERIFICATION_INVALID");
  }
  return {
    directory: input.directory,
    projectId: input.projectId,
    hostId: input.hostId,
    token: input.token,
    verifiedAt: new Date(verifiedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function dispatchRecord(input, state) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("DISPATCH_RESULT_RECORD_INVALID");
  }
  if (!RECORD_STATES.has(input.status)) fail("DISPATCH_RESULT_RECORD_INVALID");
  if (state === "verified" && input.status === "not-attempted") {
    fail("DISPATCH_RESULT_RECORD_INVALID");
  }
  if (
    input.status === "failed" &&
    (typeof input.detail !== "string" || input.detail.length === 0)
  ) {
    fail("DISPATCH_RESULT_RECORD_INVALID");
  }
  return {
    status: input.status,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
  };
}

function validateDispatchResult(input, action, control, lock) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.schemaVersion !== 1) {
    fail("DISPATCH_RESULT_INVALID");
  }
  if (!DISPATCH_RESULT_STATES.has(input.state)) fail("DISPATCH_RESULT_INVALID");
  const lockVerification = dispatchLockVerification(input.lockVerification, lock);

  if (["ambiguous", "failed"].includes(input.state)) {
    dispatchIdentity(input, action, control);
    if (typeof input.code !== "string" || input.code.length === 0) {
      fail("DISPATCH_RESULT_INVALID");
    }
    if (input.runtimeSnapshot !== undefined || input.record !== undefined) {
      fail("DISPATCH_RESULT_INVALID");
    }
    return {
      schemaVersion: 1,
      state: input.state,
      issueId: input.issueId,
      taskId: input.taskId,
      context: input.context,
      lockVerification,
      code: input.code,
      ...(input.detail === undefined ? {} : { detail: input.detail }),
    };
  }

  const runtimeSnapshot = validateRuntimeSnapshot(
    input.runtimeSnapshot,
    [
      {
        issueId: action.issueId,
        classification: action.linearClassification,
        blockerIssueIds: [],
      },
    ],
    {
      requireRaw: true,
      expectedContext: {
        targetHostId: control.targetHostId,
        supersetProjectId: control.supersetProjectId,
        linearProjectId: control.projectId,
      },
    },
  );
  const match = runtimeSnapshot.matches[0];
  if (!match.taskId || match.taskId !== action.taskId) fail("DISPATCH_RESULT_IDENTITY_MISMATCH");
  if (match.workspaceIds.length !== 1 || match.activeTerminalIds.length > 1) {
    fail("DISPATCH_RESULT_RUNTIME_INVALID");
  }
  if (!DISPATCH_ACTIONS.has(input.action)) fail("DISPATCH_RESULT_ACTION_INVALID");
  if (action.action === "reuse" && input.action !== "reuse") {
    fail("DISPATCH_RESULT_ACTION_INVALID");
  }
  if (action.action === "reuse" && match.workspaceIds[0] !== action.workspaceId) {
    fail("DISPATCH_RESULT_WORKSPACE_MISMATCH");
  }
  if (input.state === "verified" && match.activeTerminalIds.length !== 1) {
    fail("DISPATCH_RESULT_RUNTIME_INVALID");
  }
  if (typeof input.failedPhase !== (input.state === "partial" ? "string" : "undefined")) {
    fail("DISPATCH_RESULT_INVALID");
  }
  if (input.state === "partial" && input.failedPhase.length === 0) {
    fail("DISPATCH_RESULT_INVALID");
  }
  const record = dispatchRecord(input.record, input.state);
  return {
    schemaVersion: 1,
    state: input.state,
    action: input.action,
    lockVerification,
    runtimeSnapshot,
    record,
    ...(input.failedPhase === undefined ? {} : { failedPhase: input.failedPhase }),
  };
}

async function inspectExactRuntime(action, control, adapters) {
  const inspect = requireFunction(adapters.inspectExactRuntime, "RUNTIME_INSPECTOR_MISSING");
  return normalizeInspection(
    await inspect({
      issueId: action.issueId,
      taskId: action.taskId,
      targetHostId: control.targetHostId,
      supersetProjectId: control.supersetProjectId,
      linearProjectId: control.projectId,
    }),
    action,
    control,
  );
}

async function dispatchSequence(action, dispatchContext, control, lock, adapters) {
  const refresh = requireFunction(
    adapters.refreshCandidateAndBlockers,
    "LINEAR_REFRESH_ADAPTER_MISSING",
  );
  const snapshot = await refresh({
    issueId: action.issueId,
    refreshMode: "candidate-blockers",
  });
  const authorization = authorizeFreshCandidate({
    action,
    snapshot,
    projectId: control.projectId,
  });
  if (!authorization.authorized) {
    return { outcome: "refused", reason: authorization.reason };
  }

  const dispatch = requireFunction(adapters.dispatchIssue, "DISPATCH_ADAPTER_MISSING");
  const requestedAction = action.action;
  const dispatchInput = {
    issueId: action.issueId,
    taskId: action.taskId,
    action: requestedAction,
    ...(requestedAction === "reuse" ? { workspaceId: action.workspaceId } : {}),
    forced: action.forced === true,
    targetHostId: control.targetHostId,
    supersetProjectId: control.supersetProjectId,
    linearProjectId: control.projectId,
    runId: control.runId,
    defaultAgent: control.defaultAgent,
    branchName: dispatchContext.branchName,
    workerPrompt: dispatchContext.workerPrompt,
    workspaceName: dispatchContext.workspaceName,
    lockReceipt: lock,
  };
  let rawMutation;
  try {
    rawMutation = await dispatch(dispatchInput);
  } catch (error) {
    if (!ambiguousMutationError(error)) throw error;
    const afterAmbiguity = await inspectExactRuntime(action, control, adapters);
    return preservedRuntime(afterAmbiguity);
  }

  let mutation;
  try {
    mutation = validateDispatchResult(rawMutation, action, control, lock);
  } catch {
    const afterAmbiguity = await inspectExactRuntime(action, control, adapters);
    return preservedRuntime(afterAmbiguity);
  }

  if (mutation.state === "ambiguous") {
    const afterAmbiguity = await inspectExactRuntime(action, control, adapters);
    return preservedRuntime(afterAmbiguity);
  }
  if (mutation.state === "failed") {
    return { outcome: "failed", reason: mutation.code, mutation };
  }
  if (mutation.state === "partial") {
    return { outcome: "partial", action: mutation.action, mutation };
  }
  return {
    outcome: "dispatched",
    action: mutation.action,
    mutation,
    ...(mutation.record.status === "failed" ? { telemetryDegraded: true } : {}),
  };
}

function hardDispatchRefusal(control) {
  if (!control || control.active !== true) return "CONTROL_INACTIVE";
  if (
    typeof control.projectId !== "string" ||
    control.projectId.length === 0 ||
    typeof control.targetHostId !== "string" ||
    control.targetHostId.length === 0 ||
    typeof control.supersetProjectId !== "string" ||
    control.supersetProjectId.length === 0 ||
    typeof control.defaultAgent !== "string" ||
    control.defaultAgent.length === 0 ||
    typeof control.runId !== "string" ||
    control.runId.length === 0 ||
    !Number.isInteger(control.maxConcurrency) ||
    control.maxConcurrency < 1 ||
    control.maxConcurrency > 10
  ) {
    return "CONFIGURATION_MISSING";
  }
  return undefined;
}

async function dispatchBatch(actions, contextByIssueId, control, lockDirectory, adapters) {
  const refusal = hardDispatchRefusal(control);
  if (refusal) {
    return {
      lock: { acquired: false, reason: refusal },
      settled: actions.map((action) => ({
        issueId: action.issueId,
        status: "fulfilled",
        value: { outcome: "refused", reason: refusal },
      })),
    };
  }

  const acquire = requireFunction(adapters.acquireDispatchLock, "LOCK_ADAPTER_MISSING");
  let lock;
  try {
    lock = await acquire({
      directory: lockDirectory,
      projectId: control.projectId,
      hostId: control.targetHostId,
      issueIds: actions.map((action) => action.issueId),
    });
  } catch (error) {
    if (effectRequired(error)) throw error;
    const reason = normalizedError(error);
    return {
      lock: { acquired: false, reason: reason.code, error: reason },
      settled: actions.map((action) => ({
        issueId: action.issueId,
        status: "rejected",
        reason,
      })),
    };
  }
  if (!lock?.acquired) {
    const reason = lock?.reason ?? "LOCK_HELD";
    return {
      lock: { acquired: false, reason },
      settled: actions.map((action) => ({
        issueId: action.issueId,
        status: "fulfilled",
        value: { outcome: "refused", reason },
      })),
    };
  }
  lock = lockReceipt(lock, {
    directory: lockDirectory,
    projectId: control.projectId,
    hostId: control.targetHostId,
  });

  let settled;
  let releaseError;
  let releaseEffect;
  let bodyError;
  let effectsPending = false;
  try {
    settled = await Promise.allSettled(
      actions.map((action) =>
        dispatchSequence(action, contextByIssueId.get(action.issueId), control, lock, adapters),
      ),
    );
    throwRequiredEffects(settled);
  } catch (error) {
    if (effectRequired(error)) effectsPending = true;
    bodyError = error;
  }
  if (!effectsPending) {
    try {
      const release = await requireFunction(
        adapters.releaseDispatchLock,
        "LOCK_RELEASE_ADAPTER_MISSING",
      )(lock);
      if (release?.released !== true) {
        releaseError = {
          code: release?.reason ?? "LOCK_RELEASE_FAILED",
          message: release?.reason ?? "dispatch lock release was not verified",
        };
      }
    } catch (error) {
      if (effectRequired(error)) releaseEffect = error;
      else releaseError = normalizedError(error);
    }
  }
  if (releaseEffect) throw releaseEffect;
  if (bodyError && effectRequired(bodyError)) throw bodyError;
  if (bodyError) {
    settled = actions.map(() => ({ status: "rejected", reason: bodyError }));
  }
  return {
    lock: { acquired: true, ...(releaseError ? { releaseError } : {}) },
    settled: settledResults(actions, settled),
  };
}

function validatedMonitorResult(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("MONITOR_RESULT_INVALID");
  }
  const keys = Object.keys(input);
  if (keys.length === 0) return {};
  if (
    keys.length !== 1 ||
    keys[0] !== "event" ||
    !input.event ||
    typeof input.event !== "object" ||
    Array.isArray(input.event)
  ) {
    fail("MONITOR_RESULT_INVALID");
  }
  return { event: input.event };
}

function validatePromotionResult(input) {
  const keys =
    input && typeof input === "object" && !Array.isArray(input) ? Object.keys(input) : [];
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    keys.length !== 1 ||
    keys[0] !== "applied" ||
    input.applied !== true
  ) {
    fail("PROMOTION_RESULT_INVALID");
  }
}

async function monitorOne(action, control, adapters, dependentsByBlocker) {
  if (!action.terminalId) fail("MONITOR_TERMINAL_MISSING");
  const monitor = requireFunction(adapters.monitorWorker, "MONITOR_ADAPTER_MISSING");
  const result = validatedMonitorResult(
    await monitor({
      issueId: action.issueId,
      taskId: action.taskId,
      workspaceId: action.workspaceId,
      terminalId: action.terminalId,
    }),
  );
  if (!result.event) return { outcome: "monitored", result };

  const seedIssueIds = sortedUniqueIssueIds([
    action.issueId,
    ...(dependentsByBlocker.get(action.issueId) ?? []),
  ]);
  const refresh = requireFunction(
    adapters.refreshAfterWorkerEvent,
    "WORKER_EVENT_REFRESH_ADAPTER_MISSING",
  );
  const refreshed = validateLinearSnapshot(
    await refresh({
      issueId: action.issueId,
      issueIds: seedIssueIds,
      event: result.event,
      refreshMode: "candidate-blockers",
    }),
    { expectedProjectId: control.projectId },
  );
  const issueById = new Map(refreshed.issues.map((issue) => [issue.issueId, issue]));
  if (seedIssueIds.some((issueId) => !issueById.has(issueId))) {
    fail("WORKER_EVENT_REFRESH_SCOPE_MISMATCH");
  }
  const issueIds = sortedUniqueIssueIds([
    ...seedIssueIds,
    ...seedIssueIds.flatMap((issueId) => issueById.get(issueId).blockerIssueIds),
  ]);
  const actualIssueIds = refreshed.issues.map((issue) => issue.issueId);
  if (
    !sameStrings(actualIssueIds, issueIds) ||
    refreshed.scope.mode !== "targeted" ||
    !sameStrings(refreshed.scope.requestedIssueIds, issueIds)
  ) {
    fail("WORKER_EVENT_REFRESH_SCOPE_MISMATCH");
  }
  validatePromotionResult(
    await requireFunction(
      adapters.promoteAfterRefresh,
      "PROMOTION_ADAPTER_MISSING",
    )({
      issueId: action.issueId,
      issueIds,
      event: result.event,
      refreshed,
    }),
  );
  return { outcome: "event", issueIds, event: result.event, refreshed };
}

async function monitorBatch(actions, control, adapters, dependentsByBlocker) {
  const settled = await Promise.allSettled(
    actions.map((action) => monitorOne(action, control, adapters, dependentsByBlocker)),
  );
  throwRequiredEffects(settled);
  return { settled: settledResults(actions, settled) };
}

function postDispatchMonitorActions(dispatch, actionByIssueId) {
  return (dispatch.settled ?? [])
    .flatMap((entry) => {
      if (entry.status !== "fulfilled") return [];
      const source = actionByIssueId.get(entry.issueId);
      if (!source) return [];
      const result = entry.value;
      if (
        result?.outcome === "preserved" &&
        result.action === "monitor" &&
        typeof result.workspaceId === "string" &&
        typeof result.terminalId === "string"
      ) {
        return [
          {
            ...source,
            action: "monitor",
            workspaceId: result.workspaceId,
            terminalId: result.terminalId,
          },
        ];
      }
      if (
        !(
          (result?.outcome === "dispatched" && result.mutation?.state === "verified") ||
          (result?.outcome === "partial" && result.mutation?.state === "partial")
        )
      ) {
        return [];
      }
      const match = result.mutation.runtimeSnapshot?.matches?.[0];
      if (match?.workspaceIds?.length !== 1 || match?.activeTerminalIds?.length !== 1) {
        return [];
      }
      return [
        {
          ...source,
          action: "monitor",
          workspaceId: match.workspaceIds[0],
          terminalId: match.activeTerminalIds[0],
        },
      ];
    })
    .sort((left, right) => left.issueId.localeCompare(right.issueId));
}

function resultIsDegraded(result) {
  if (result?.lock?.releaseError) return true;
  return (result?.settled ?? []).some(
    (entry) =>
      entry.status === "rejected" ||
      ["failed", "isolated", "partial", "refused"].includes(entry.value?.outcome) ||
      (entry.value?.outcome === "preserved" && entry.value?.action === "reuse") ||
      entry.value?.telemetryDegraded === true,
  );
}

function failedBatch(actions, error, kind) {
  const reason = normalizedError(error);
  return {
    ...(kind === "dispatch"
      ? { lock: { acquired: false, reason: reason.code, error: reason } }
      : {}),
    settled: actions.map((action) => ({
      issueId: action.issueId,
      status: "rejected",
      reason,
    })),
  };
}

export async function runOrchestrationEpoch({
  frontierPlan,
  runtimePlan,
  control,
  invocationId,
  lockDirectory,
  selectedIssueIds,
  dispatchContextByIssueId,
  maxConcurrency = control?.maxConcurrency,
  adapters = {},
}) {
  requiredString(lockDirectory, "LOCK_DIRECTORY_REQUIRED");
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 10) {
    fail("MAX_CONCURRENCY_INVALID");
  }
  if (Number.isInteger(control?.maxConcurrency) && maxConcurrency > control.maxConcurrency) {
    fail("MAX_CONCURRENCY_EXCEEDS_CONTROL");
  }
  const actions = runtimePlanActions(runtimePlan);
  const rows = frontierRows(frontierPlan);
  const dependentsByBlocker = cachedDependentsByBlocker(rows);
  const expectedRuntimeIssueIds =
    selectedIssueIds === undefined
      ? [...rows.values()]
          .filter((row) => ["ready", "started"].includes(row.classification))
          .map((row) => row.issueId)
          .sort((left, right) => left.localeCompare(right))
      : exactIssueScope(selectedIssueIds);
  if (
    expectedRuntimeIssueIds.some(
      (issueId) => !["ready", "started"].includes(rows.get(issueId)?.classification),
    )
  ) {
    fail("RUNTIME_PLAN_FRONTIER_SCOPE_MISMATCH");
  }
  if (
    !sameStrings(
      actions.map((action) => action.issueId),
      expectedRuntimeIssueIds,
    )
  ) {
    fail("RUNTIME_PLAN_FRONTIER_SCOPE_MISMATCH");
  }
  for (const action of actions) {
    const row = rows.get(action.issueId);
    if (!row || !["ready", "started"].includes(row.classification)) {
      fail("RUNTIME_PLAN_FRONTIER_MISMATCH");
    }
    if (action.linearClassification !== row.classification) {
      fail("RUNTIME_PLAN_FRONTIER_MISMATCH");
    }
    if (action.linearStatusType !== row.linearStatusType) {
      fail("RUNTIME_PLAN_FRONTIER_MISMATCH");
    }
    if (action.forced !== (row.forced === true)) {
      fail("RUNTIME_PLAN_FRONTIER_MISMATCH");
    }
    if (
      action.forced === true &&
      DISPATCH_ACTIONS.has(action.action) &&
      (action.forceAuthorized !== true || action.confirmationAccepted !== true)
    ) {
      fail("RUNTIME_PLAN_FORCE_UNCONFIRMED");
    }
    if (
      action.forced === true &&
      DISPATCH_ACTIONS.has(action.action) &&
      (typeof invocationId !== "string" || action.forceInvocationId !== invocationId)
    ) {
      fail("RUNTIME_PLAN_FORCE_INVOCATION_MISMATCH");
    }
    if (
      action.forced === true &&
      DISPATCH_ACTIONS.has(action.action) &&
      (!Array.isArray(action.forceBypassedBlockerIssueIds) ||
        !Array.isArray(action.forceBypassedUncertainties))
    ) {
      fail("RUNTIME_PLAN_FORCE_SCOPE_MISSING");
    }
    if (action.forced === true && DISPATCH_ACTIONS.has(action.action)) {
      const blockerScope = exactIssueScope(action.forceBypassedBlockerIssueIds);
      const uncertaintyScope = normalizedUncertainties(
        action.forceBypassedUncertainties,
        "RUNTIME_PLAN_FORCE_SCOPE_INVALID",
      );
      if (
        !sameStrings(blockerScope, row.forceBypassedBlockerIssueIds) ||
        JSON.stringify(uncertaintyScope) !== JSON.stringify(row.forceBypassedUncertainties)
      ) {
        fail("RUNTIME_PLAN_FORCE_SCOPE_MISMATCH");
      }
    }
  }
  const monitoringActions = actions.filter((action) => action.action === "monitor");
  const plannedDispatchActions = actions.filter((action) => DISPATCH_ACTIONS.has(action.action));
  const linearUnavailableActions = frontierPlan.degraded === true ? plannedDispatchActions : [];
  const dispatchableActions = frontierPlan.degraded === true ? [] : plannedDispatchActions;
  const availableCapacity = Math.max(0, maxConcurrency - monitoringActions.length);
  const selectedActions = dispatchableActions.slice(0, availableCapacity);
  const deferredActions = dispatchableActions.slice(availableCapacity);
  const contextByIssueId = dispatchContexts(dispatchContextByIssueId, selectedActions);
  const confirmationIssueIds = actions
    .filter((action) => action.action === "confirm")
    .map((action) => action.issueId);
  const isolated = actions.filter((action) =>
    ["ambiguous", "non-transportable"].includes(action.action),
  );

  if (selectedActions.length === 0 && monitoringActions.length === 0) {
    return {
      status:
        isolated.length > 0 || frontierPlan.degraded === true
          ? "degraded"
          : confirmationIssueIds.length > 0
            ? "busy"
            : "idle",
      selectedIssueIds: [],
      deferredIssueIds: deferredActions.map((action) => action.issueId),
      confirmationIssueIds,
      isolated,
      dispatch: {
        lock: {
          acquired: false,
          reason: linearUnavailableActions.length > 0 ? "LINEAR_UNAVAILABLE" : "NOT_NEEDED",
        },
        settled: linearUnavailableActions.map((action) => ({
          issueId: action.issueId,
          status: "fulfilled",
          value: { outcome: "refused", reason: "LINEAR_UNAVAILABLE" },
        })),
      },
      monitoring: { settled: [] },
    };
  }

  let dispatch;
  try {
    dispatch =
      selectedActions.length > 0
        ? await dispatchBatch(selectedActions, contextByIssueId, control, lockDirectory, adapters)
        : {
            lock: {
              acquired: false,
              reason: linearUnavailableActions.length > 0 ? "LINEAR_UNAVAILABLE" : "NOT_NEEDED",
            },
            settled: linearUnavailableActions.map((action) => ({
              issueId: action.issueId,
              status: "fulfilled",
              value: { outcome: "refused", reason: "LINEAR_UNAVAILABLE" },
            })),
          };
  } catch (error) {
    if (effectRequired(error)) throw error;
    dispatch = failedBatch(selectedActions, error, "dispatch");
  }

  let monitoring;
  const actionByIssueId = new Map(actions.map((action) => [action.issueId, action]));
  const allMonitoringActions = [
    ...new Map(
      [...monitoringActions, ...postDispatchMonitorActions(dispatch, actionByIssueId)].map(
        (action) => [action.issueId, action],
      ),
    ).values(),
  ].sort((left, right) => left.issueId.localeCompare(right.issueId));
  if (dispatch.lock?.releaseError) {
    monitoring = {
      settled: allMonitoringActions.map((action) => ({
        issueId: action.issueId,
        status: "fulfilled",
        value: { outcome: "refused", reason: "LOCK_RELEASE_FAILED" },
      })),
    };
  } else {
    try {
      monitoring =
        allMonitoringActions.length > 0
          ? await monitorBatch(allMonitoringActions, control, adapters, dependentsByBlocker)
          : { settled: [] };
    } catch (error) {
      if (effectRequired(error)) throw error;
      monitoring = failedBatch(allMonitoringActions, error, "monitoring");
    }
  }
  const degraded =
    frontierPlan.degraded === true ||
    isolated.length > 0 ||
    resultIsDegraded(dispatch) ||
    resultIsDegraded(monitoring);

  return {
    status: degraded ? "degraded" : "busy",
    selectedIssueIds: selectedActions.map((action) => action.issueId),
    deferredIssueIds: deferredActions.map((action) => action.issueId),
    confirmationIssueIds,
    isolated,
    dispatch,
    monitoring,
  };
}
