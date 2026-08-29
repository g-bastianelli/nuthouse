const CLAIMED_STATUS_TYPES = new Set(["started", "completed", "canceled"]);
const UNCLAIMED_STATUS_TYPES = new Set(["backlog", "triage", "unstarted"]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function fail(code) {
  throw new Error(code);
}

function requireMatchingControl(expectedControl, currentControl) {
  if (!expectedControl || !currentControl) fail("CONTROL_MISSING");
  for (const field of ["projectId", "runId", "revision", "decisionHash"]) {
    if (expectedControl[field] !== currentControl[field]) fail("CONTROL_CHANGED");
  }
  if (expectedControl.active !== true || currentControl.active !== true) fail("CONTROL_INACTIVE");
  if (!expectedControl.decisionBaseline) fail("CONTROL_BASELINE_MISSING");
  return {
    ...expectedControl,
    ...currentControl,
    decisionBaseline: expectedControl.decisionBaseline,
  };
}

function exactBinding(issue, bindings, projectId) {
  const matches = bindings.filter(
    (binding) =>
      binding?.issueId === issue.id &&
      typeof binding.taskId === "string" &&
      binding.taskId.length > 0 &&
      binding.externalProvider === "linear" &&
      binding.externalKey === issue.id &&
      binding.externalProjectId === projectId &&
      binding.managed === true,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function claimedForStatus(statusType) {
  const normalized = typeof statusType === "string" ? statusType.toLowerCase() : "unknown";
  if (CLAIMED_STATUS_TYPES.has(normalized)) return true;
  if (UNCLAIMED_STATUS_TYPES.has(normalized)) return false;
  return undefined;
}

export function buildReconciliationInput({
  expectedControl,
  linearSnapshot,
  runtimeSnapshot,
  confirmedRunnableExpansions = [],
}) {
  if (linearSnapshot?.schemaVersion !== 1 || runtimeSnapshot?.schemaVersion !== 1) {
    fail("SNAPSHOT_INVALID_SCHEMA");
  }
  const control = requireMatchingControl(expectedControl, linearSnapshot.control);
  const taskBindings = array(runtimeSnapshot.taskBindings);
  const issues = array(linearSnapshot.issues).map((issue) => {
    const binding = exactBinding(issue, taskBindings, control.projectId);
    return { ...issue, taskId: binding?.taskId };
  });
  const issueByTaskId = new Map(
    issues.filter((issue) => issue.taskId).map((issue) => [issue.taskId, issue]),
  );
  const workspaces = array(runtimeSnapshot.workspaces).map((workspace) => {
    const normalized = { ...workspace };
    delete normalized.claimed;
    const issue = issueByTaskId.get(workspace?.taskId);
    const claimed = issue && claimedForStatus(issue.statusType);
    return claimed === undefined ? normalized : { ...normalized, claimed };
  });
  const executionRecords = array(linearSnapshot.executionRecords).map((record) => ({
    ...record,
    activeRun: record?.runId === control.runId,
  }));

  return {
    schemaVersion: 1,
    control,
    providers: {
      linear: linearSnapshot.provider,
      github: runtimeSnapshot.providers?.github,
      superset: runtimeSnapshot.providers?.superset,
    },
    issues,
    waivers: array(linearSnapshot.waivers),
    executionRecords,
    taskBindings,
    workspaceInventory: runtimeSnapshot.workspaceInventory,
    workspaces,
    githubPullRequests: array(runtimeSnapshot.githubPullRequests),
    baseline: control.decisionBaseline,
    confirmedRunnableExpansions: array(confirmedRunnableExpansions),
    linearUnknown: array(linearSnapshot.unknown),
    runtimeUnknown: array(runtimeSnapshot.unknown),
  };
}
