const STARTABLE_STATUS_TYPES = new Set(["backlog", "triage", "unstarted"]);
const TERMINAL_STATUS_TYPES = new Set(["completed", "canceled"]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compareIssue(left, right) {
  const leftOrder = Number.isFinite(left.order) ? left.order : Number.MAX_SAFE_INTEGER;
  const rightOrder = Number.isFinite(right.order) ? right.order : Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  const identifierOrder = String(left.identifier ?? "").localeCompare(
    String(right.identifier ?? ""),
  );
  return identifierOrder || String(left.id).localeCompare(String(right.id));
}

function unique(values) {
  return [...new Set(values)];
}

function normalizedStatus(issue) {
  if (issue.dataState !== undefined && issue.dataState !== "known") return "unknown";
  const type = typeof issue.statusType === "string" ? issue.statusType.toLowerCase() : "unknown";
  if (STARTABLE_STATUS_TYPES.has(type) || TERMINAL_STATUS_TYPES.has(type) || type === "started") {
    return type;
  }
  return "unknown";
}

function normalizedBaseline(baseline) {
  const issueIds = new Set(array(baseline?.issueIds).map(String));
  const blockers = new Map();
  for (const edge of array(baseline?.edges)) {
    const dependentIssueId = edge.dependentIssueId ?? edge.dependentRef;
    const blockerIssueId = edge.blockerIssueId ?? edge.blockerRef;
    if (!dependentIssueId || !blockerIssueId) continue;
    if (!blockers.has(String(dependentIssueId))) blockers.set(String(dependentIssueId), []);
    blockers.get(String(dependentIssueId)).push(String(blockerIssueId));
  }
  for (const values of blockers.values()) values.sort();
  return { issueIds, blockers };
}

function baselineObject(baseline) {
  const normalized = normalizedBaseline(baseline);
  const issueIds = [...normalized.issueIds].sort();
  const edges = [];
  for (const dependentIssueId of issueIds) {
    for (const blockerIssueId of normalized.blockers.get(dependentIssueId) ?? []) {
      edges.push({ dependentIssueId, blockerIssueId });
    }
  }
  edges.sort((left, right) => {
    const dependentOrder = left.dependentIssueId.localeCompare(right.dependentIssueId);
    return dependentOrder || left.blockerIssueId.localeCompare(right.blockerIssueId);
  });
  return { issueIds, edges };
}

function safeDecisionBaseline(issues, previousInput, quarantineReasons, unknownIssueIds) {
  const previous = normalizedBaseline(previousInput);
  const currentById = new Map(issues.map((issue) => [issue.id, issue]));
  const issueIds = new Set();
  const edges = [];

  function preservePreviousIssue(issueId) {
    if (!previous.issueIds.has(issueId)) return;
    issueIds.add(issueId);
    for (const blockerIssueId of previous.blockers.get(issueId) ?? []) {
      issueIds.add(blockerIssueId);
      edges.push({ dependentIssueId: issueId, blockerIssueId });
    }
  }

  for (const issue of issues) {
    const graphFieldsKnown =
      issue.dataState === "known" &&
      !unknownIssueIds.has(issue.id) &&
      !quarantineReasons.has(issue.id);
    if (!graphFieldsKnown) {
      preservePreviousIssue(issue.id);
      continue;
    }
    issueIds.add(issue.id);
    for (const blockerIssueId of unique(issue.blockers).sort()) {
      issueIds.add(blockerIssueId);
      edges.push({ dependentIssueId: issue.id, blockerIssueId });
    }
  }

  for (const issueId of unknownIssueIds) {
    if (!currentById.has(issueId)) preservePreviousIssue(issueId);
  }

  edges.sort((left, right) => {
    const dependentOrder = left.dependentIssueId.localeCompare(right.dependentIssueId);
    return dependentOrder || left.blockerIssueId.localeCompare(right.blockerIssueId);
  });
  return { issueIds: [...issueIds].sort(), edges };
}

function findCyclicComponents(issueIds, blockersByDependent) {
  const indexById = new Map();
  const lowLinkById = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let nextIndex = 0;

  function visit(id) {
    indexById.set(id, nextIndex);
    lowLinkById.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const blockerId of [...(blockersByDependent.get(id) ?? [])].sort()) {
      if (!issueIds.has(blockerId)) continue;
      if (!indexById.has(blockerId)) {
        visit(blockerId);
        lowLinkById.set(id, Math.min(lowLinkById.get(id), lowLinkById.get(blockerId)));
      } else if (onStack.has(blockerId)) {
        lowLinkById.set(id, Math.min(lowLinkById.get(id), indexById.get(blockerId)));
      }
    }

    if (lowLinkById.get(id) !== indexById.get(id)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== id);
    component.sort();
    if (component.length > 1) components.push(component);
  }

  for (const id of [...issueIds].sort()) {
    if (!indexById.has(id)) visit(id);
  }
  return components.sort((left, right) => left[0].localeCompare(right[0]));
}

function graphQuarantine(issues, issueById, projectId) {
  const blockersByDependent = new Map();
  const dependentsByBlocker = new Map(issues.map((issue) => [issue.id, []]));
  const reasons = new Map();

  function quarantine(id, reason) {
    if (!reasons.has(id)) reasons.set(id, []);
    reasons.get(id).push(reason);
  }

  for (const issue of issues) {
    const blockerIds = array(issue.blockers).map(String);
    blockersByDependent.set(issue.id, blockerIds);
    if (issue.projectId === undefined) {
      quarantine(issue.id, "PROJECT_UNKNOWN");
    } else if (issue.projectId !== projectId) {
      quarantine(issue.id, "CROSS_PROJECT_ISSUE");
    }
    const seen = new Set();
    for (const blockerId of blockerIds) {
      if (seen.has(blockerId)) quarantine(issue.id, `DUPLICATE_EDGE:${blockerId}`);
      seen.add(blockerId);
      if (blockerId === issue.id) quarantine(issue.id, "SELF_EDGE");
      if (!issueById.has(blockerId)) {
        quarantine(issue.id, `UNKNOWN_BLOCKER:${blockerId}`);
      } else {
        dependentsByBlocker.get(blockerId).push(issue.id);
      }
    }
  }

  for (const component of findCyclicComponents(new Set(issueById.keys()), blockersByDependent)) {
    const reason = `CYCLE_COMPONENT:${component.join(",")}`;
    for (const id of component) quarantine(id, reason);
  }

  const queue = [...reasons.keys()];
  for (let index = 0; index < queue.length; index += 1) {
    const invalidId = queue[index];
    for (const dependentId of dependentsByBlocker.get(invalidId) ?? []) {
      if (!reasons.has(dependentId)) {
        reasons.set(dependentId, [`DESCENDANT_OF_INVALID:${invalidId}`]);
        queue.push(dependentId);
      }
    }
  }
  return reasons;
}

function normalizedTerminals(workspace) {
  return array(workspace.terminals)
    .map((terminal) => {
      const id = terminal?.id ?? terminal?.terminalId;
      return id ? { ...terminal, id: String(id) } : undefined;
    })
    .filter(Boolean)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function selectedExecutionTerminal(workspace, issueRecords) {
  const terminals = normalizedTerminals(workspace);
  const terminalIds = new Set(terminals.map((terminal) => terminal.id));
  const recordedTerminalIds = unique(
    issueRecords
      .filter((record) => String(record?.workspaceId) === workspace.id && record?.terminalId)
      .map((record) => String(record.terminalId))
      .filter((terminalId) => terminalIds.has(terminalId)),
  );
  if (recordedTerminalIds.length === 1) {
    return terminals.find((terminal) => terminal.id === recordedTerminalIds[0]);
  }
  return terminals.length === 1 ? terminals[0] : undefined;
}

function consumesCapacity(workspace, issueRecords) {
  if (typeof workspace.consumesCapacity === "boolean") return workspace.consumesCapacity;
  const terminals = normalizedTerminals(workspace);
  if (terminals.length === 0) return true;
  const selected = selectedExecutionTerminal(workspace, issueRecords);
  if (selected) return selected.exited !== true;
  return terminals.some((terminal) => terminal.exited !== true);
}

function runtimeState(input, issueById) {
  const runId = input.control?.runId && String(input.control.runId);
  const targetHostId = input.control?.targetHostId && String(input.control.targetHostId);
  const supersetProjectId =
    input.control?.supersetProjectId && String(input.control.supersetProjectId);
  const records = array(input.executionRecords);
  const currentRecords = records.filter(
    (record) => !runId || !record?.runId || String(record.runId) === runId,
  );
  const issueIdsByTask = new Map();
  const taskIdsByIssue = new Map();
  const registerTaskBinding = (issueIdValue, taskIdValue) => {
    if (!issueIdValue || !taskIdValue) return;
    const issueId = String(issueIdValue);
    const taskId = String(taskIdValue);
    if (!issueIdsByTask.has(taskId)) issueIdsByTask.set(taskId, new Set());
    issueIdsByTask.get(taskId).add(issueId);
    if (!taskIdsByIssue.has(issueId)) taskIdsByIssue.set(issueId, new Set());
    taskIdsByIssue.get(issueId).add(taskId);
  };
  for (const issue of issueById.values()) registerTaskBinding(issue.id, issue.taskId);
  for (const binding of array(input.taskBindings)) {
    registerTaskBinding(binding?.issueId, binding?.taskId);
  }
  for (const record of records) registerTaskBinding(record?.issueId, record?.taskId);

  const rawWorkspaces = Array.isArray(input.workspaces) ? input.workspaces : undefined;
  const rawWorkspaceIds = rawWorkspaces?.map((workspace) =>
    workspace?.id ? String(workspace.id) : undefined,
  );
  const inventoryWorkspaceIds = Array.isArray(input.workspaceInventory?.workspaceIds)
    ? input.workspaceInventory.workspaceIds.map((workspaceId) =>
        workspaceId ? String(workspaceId) : undefined,
      )
    : undefined;
  const sortedRawWorkspaceIds = rawWorkspaceIds?.filter(Boolean).sort();
  const sortedInventoryWorkspaceIds = inventoryWorkspaceIds?.filter(Boolean).sort();
  const exactInventoryIds =
    rawWorkspaceIds !== undefined &&
    inventoryWorkspaceIds !== undefined &&
    sortedRawWorkspaceIds.length === rawWorkspaceIds.length &&
    sortedInventoryWorkspaceIds.length === inventoryWorkspaceIds.length &&
    new Set(sortedRawWorkspaceIds).size === sortedRawWorkspaceIds.length &&
    new Set(sortedInventoryWorkspaceIds).size === sortedInventoryWorkspaceIds.length &&
    sortedRawWorkspaceIds.length === sortedInventoryWorkspaceIds.length &&
    sortedRawWorkspaceIds.every(
      (workspaceId, index) => workspaceId === sortedInventoryWorkspaceIds[index],
    );
  const completeWorkspaceInventory =
    input.providers?.superset === "ready" &&
    rawWorkspaces !== undefined &&
    input.workspaceInventory?.complete === true &&
    targetHostId &&
    supersetProjectId &&
    String(input.workspaceInventory.hostId) === targetHostId &&
    String(input.workspaceInventory.projectId) === supersetProjectId &&
    exactInventoryIds &&
    rawWorkspaces.every(
      (workspace) =>
        workspace?.id &&
        workspace?.hostId &&
        String(workspace.hostId) === targetHostId &&
        workspace?.projectId &&
        String(workspace.projectId) === supersetProjectId,
    );
  const observedWorkspaceIds = new Set(sortedRawWorkspaceIds ?? []);
  const ownedTaskIds = new Set(issueIdsByTask.keys());
  const workspaces = array(rawWorkspaces)
    .filter((workspace) => workspace?.id && workspace?.taskId)
    .map((workspace) => ({
      ...workspace,
      id: String(workspace.id),
      taskId: String(workspace.taskId),
    }))
    .filter((workspace) => ownedTaskIds.has(workspace.taskId))
    .sort((left, right) => left.id.localeCompare(right.id));
  const workspacesByTask = new Map();
  const recordsByIssue = new Map();
  const currentRecordsByIssue = new Map();
  const controlExecutionIssueIds = new Set(array(input.control?.executionIssueIds).map(String));
  const exitedExecutionIssueIds = new Set(
    array(input.control?.exitedExecutionIssueIds).map(String),
  );
  const confirmedExitedIssueIds = new Set();

  function recordNeedsRuntimeProof(record) {
    if (record?.terminalExited === true) return false;
    const issueId = record?.issueId && String(record.issueId);
    if (issueId && controlExecutionIssueIds.has(issueId)) return true;
    if (!record?.runId || !runId || String(record.runId) === runId) return true;
    if (issueId && exitedExecutionIssueIds.has(issueId)) return false;
    return true;
  }
  const active = [];
  const inspect = [];
  const repair = [];
  const guardedIssueIds = new Set();

  for (const issue of issueById.values()) {
    if (!issue.taskId) {
      guardedIssueIds.add(issue.id);
      inspect.push({ issueId: issue.id, resourceIds: [], reason: "TASK_BINDING_UNKNOWN" });
      continue;
    }
    const taskOwners = issueIdsByTask.get(issue.taskId) ?? new Set();
    if (taskOwners.size > 1) {
      for (const issueId of taskOwners) guardedIssueIds.add(issueId);
      inspect.push({
        issueId: issue.id,
        resourceIds: [issue.taskId],
        reason: "TASK_BINDING_AMBIGUOUS",
      });
    }
    const recordedTaskIds = taskIdsByIssue.get(issue.id) ?? new Set();
    if ([...recordedTaskIds].some((taskId) => taskId !== issue.taskId)) {
      guardedIssueIds.add(issue.id);
      inspect.push({
        issueId: issue.id,
        resourceIds: [...recordedTaskIds].sort(),
        reason: "TASK_BINDING_MISMATCH",
      });
    }
  }

  for (const record of records) {
    if (!record?.issueId) continue;
    const issueId = String(record.issueId);
    if (!recordsByIssue.has(issueId)) recordsByIssue.set(issueId, []);
    recordsByIssue.get(issueId).push(record);
  }
  for (const record of currentRecords) {
    if (!record?.issueId) continue;
    const issueId = String(record.issueId);
    if (!currentRecordsByIssue.has(issueId)) currentRecordsByIssue.set(issueId, []);
    currentRecordsByIssue.get(issueId).push(record);
  }

  for (const workspace of workspaces) {
    const taskId = workspace.taskId;
    if (!workspacesByTask.has(taskId)) workspacesByTask.set(taskId, []);
    workspacesByTask.get(taskId).push(workspace);
    const ownerIds = [...(issueIdsByTask.get(taskId) ?? [])].sort();
    const issueId = ownerIds[0];
    const correlationRecords =
      currentRecordsByIssue.get(issueId) ?? recordsByIssue.get(issueId) ?? [];
    const selectedTerminal = selectedExecutionTerminal(workspace, correlationRecords);
    if (!consumesCapacity(workspace, correlationRecords)) {
      if (selectedTerminal?.exited === true && ownerIds.length === 1) {
        confirmedExitedIssueIds.add(issueId);
      }
      continue;
    }
    active.push({
      issueId,
      taskId,
      workspaceId: workspace.id,
      ...(selectedTerminal ? { terminalId: selectedTerminal.id } : {}),
      managed: ownerIds.length === 1 && issueById.has(issueId),
      ...(ownerIds.length > 1 ? { bindingAmbiguous: true } : {}),
    });
  }

  for (const issue of issueById.values()) {
    if (!issue.taskId) continue;
    const matches = workspacesByTask.get(issue.taskId) ?? [];
    const issueRecords = currentRecordsByIssue.get(issue.id) ?? [];
    const historicalRecords = recordsByIssue.get(issue.id) ?? [];
    if (matches.length > 1) {
      guardedIssueIds.add(issue.id);
      inspect.push({
        issueId: issue.id,
        resourceIds: matches.map((workspace) => workspace.id).sort(),
        reason: "AMBIGUOUS_TASK_ID",
      });
      continue;
    }
    if (matches.length === 0) {
      const deletedTerminalExecution =
        completeWorkspaceInventory &&
        TERMINAL_STATUS_TYPES.has(normalizedStatus(issue)) &&
        !guardedIssueIds.has(issue.id) &&
        historicalRecords.length > 0 &&
        historicalRecords.every(
          (record) =>
            record?.runId &&
            String(record.runId) === runId &&
            record?.taskId &&
            String(record.taskId) === issue.taskId &&
            record?.workspaceId &&
            String(record.workspaceId).length > 0 &&
            record?.hostId &&
            String(record.hostId) === targetHostId &&
            (record.supersetProjectId === undefined ||
              String(record.supersetProjectId) === supersetProjectId) &&
            !observedWorkspaceIds.has(String(record.workspaceId)),
        );
      if (deletedTerminalExecution) {
        confirmedExitedIssueIds.add(issue.id);
        continue;
      }
      const durableRecords = historicalRecords.filter(recordNeedsRuntimeProof);
      const hasHistoricalRuntime = durableRecords.some(
        (record) =>
          record?.taskId && (workspacesByTask.get(String(record.taskId)) ?? []).length > 0,
      );
      if (hasHistoricalRuntime) continue;
      if (durableRecords.length > 0 || controlExecutionIssueIds.has(issue.id)) {
        guardedIssueIds.add(issue.id);
        const resourceIds = unique(
          durableRecords
            .flatMap((record) => [record?.workspaceId, record?.terminalId])
            .filter(Boolean)
            .map(String),
        ).sort();
        inspect.push({
          issueId: issue.id,
          resourceIds,
          reason: "RUNTIME_MISSING",
        });
        const newestRecord = durableRecords.at(-1);
        active.push({
          issueId: issue.id,
          workspaceId: newestRecord?.workspaceId
            ? String(newestRecord.workspaceId)
            : `missing:${issue.id}`,
          ...(newestRecord?.terminalId ? { terminalId: String(newestRecord.terminalId) } : {}),
          managed: true,
          runtimeMissing: true,
        });
      }
      continue;
    }

    guardedIssueIds.add(issue.id);
    const workspace = matches[0];
    const terminals = normalizedTerminals(workspace);
    const terminalIds = terminals.map((terminal) => terminal.id);
    const historicalTerminalIds = unique(
      historicalRecords
        .filter(
          (record) =>
            String(record?.workspaceId) === workspace.id &&
            record?.terminalId &&
            terminalIds.includes(String(record.terminalId)),
        )
        .map((record) => String(record.terminalId)),
    );
    if (
      workspace.hostId &&
      input.control?.targetHostId &&
      workspace.hostId !== input.control.targetHostId
    ) {
      inspect.push({ issueId: issue.id, resourceIds: [workspace.id], reason: "HOST_MISMATCH" });
    } else if (issueRecords.length > 1) {
      inspect.push({
        issueId: issue.id,
        resourceIds: unique(issueRecords.map((record) => String(record.workspaceId))).sort(),
        reason: "AMBIGUOUS_RECORD",
      });
    } else if (terminals.length === 0) {
      inspect.push({ issueId: issue.id, resourceIds: [workspace.id], reason: "PARTIAL_WORKSPACE" });
    } else if (
      issueRecords.length === 0 &&
      terminals.length > 1 &&
      historicalTerminalIds.length !== 1
    ) {
      inspect.push({
        issueId: issue.id,
        resourceIds: [workspace.id, ...terminalIds].sort(),
        reason:
          historicalTerminalIds.length > 1 ? "AMBIGUOUS_HISTORICAL_RECORD" : "AMBIGUOUS_TERMINALS",
      });
    } else if (workspace.claimed === false) {
      inspect.push({
        issueId: issue.id,
        resourceIds: [workspace.id, ...terminalIds].sort(),
        reason: "ISSUE_UNCLAIMED",
      });
    } else if (issueRecords.length === 0) {
      repair.push({
        issueId: issue.id,
        taskId: issue.taskId,
        workspaceId: workspace.id,
        terminalId: historicalTerminalIds[0] ?? terminals[0].id,
      });
    } else {
      const record = issueRecords[0];
      const recordTerminalId = record.terminalId && String(record.terminalId);
      const recordMatches =
        String(record.workspaceId) === workspace.id &&
        (!recordTerminalId || terminalIds.includes(recordTerminalId));
      if (!recordMatches) {
        inspect.push({
          issueId: issue.id,
          resourceIds: unique(
            [workspace.id, ...terminalIds, String(record.workspaceId), recordTerminalId].filter(
              Boolean,
            ),
          ).sort(),
          reason: "RECORD_MISMATCH",
        });
      } else if (!recordTerminalId) {
        inspect.push({
          issueId: issue.id,
          resourceIds: [workspace.id, ...terminalIds].sort(),
          reason: "PARTIAL_EXECUTION_RECORD",
        });
      }
    }
  }

  const durableMissingIssueIds = new Set([
    ...controlExecutionIssueIds,
    ...records
      .filter((record) => record?.issueId && recordNeedsRuntimeProof(record))
      .map((record) => String(record.issueId)),
  ]);
  for (const issueId of durableMissingIssueIds) {
    const knownTaskIds = taskIdsByIssue.get(issueId) ?? new Set();
    const hasRuntime = [...knownTaskIds].some(
      (taskId) => (workspacesByTask.get(taskId) ?? []).length > 0,
    );
    if (issueById.has(issueId) || hasRuntime) continue;
    const issueRecords = recordsByIssue.get(issueId) ?? [];
    const newestRecord = issueRecords.at(-1);
    inspect.push({
      issueId,
      resourceIds: unique(
        issueRecords
          .flatMap((record) => [record?.workspaceId, record?.terminalId])
          .filter(Boolean)
          .map(String),
      ).sort(),
      reason: "RUNTIME_MISSING",
    });
    active.push({
      issueId,
      ...(newestRecord?.taskId ? { taskId: String(newestRecord.taskId) } : {}),
      workspaceId: newestRecord?.workspaceId
        ? String(newestRecord.workspaceId)
        : `missing:${issueId}`,
      ...(newestRecord?.terminalId ? { terminalId: String(newestRecord.terminalId) } : {}),
      managed: false,
      runtimeMissing: true,
    });
  }

  active.sort((left, right) => left.workspaceId.localeCompare(right.workspaceId));
  inspect.sort((left, right) => left.issueId.localeCompare(right.issueId));
  repair.sort((left, right) => left.issueId.localeCompare(right.issueId));
  return {
    active,
    inspect,
    repair,
    guardedIssueIds,
    confirmedExitedIssueIds: [...confirmedExitedIssueIds].sort(),
    capacityCount: active.length,
  };
}

function validWaiver(waivers, dependentIssueId, blockerIssueId) {
  return waivers.some(
    (waiver) =>
      waiver?.dependentIssueId === dependentIssueId &&
      waiver?.blockerIssueId === blockerIssueId &&
      waiver.valid === true &&
      waiver.humanApproved === true,
  );
}

function blockerReasons(blockerIds, dependentIssueId, issueById, waivers) {
  const reasons = [];
  for (const blockerId of blockerIds) {
    const blocker = issueById.get(blockerId);
    if (!blocker) {
      reasons.push(`UNKNOWN_BLOCKER:${blockerId}`);
      continue;
    }
    if (normalizedStatus(blocker) === "completed") continue;
    if (validWaiver(waivers, dependentIssueId, blockerId)) continue;
    const blockerStatus = normalizedStatus(blocker);
    if (blockerStatus === "canceled") reasons.push(`BLOCKER_CANCELED_WITHOUT_WAIVER:${blockerId}`);
    else if (blockerStatus === "unknown") reasons.push(`BLOCKER_STATUS_UNKNOWN:${blockerId}`);
    else reasons.push(`BLOCKER_NOT_COMPLETED:${blockerId}`);
  }
  return reasons;
}

function dispatchEligibility(issue, issueById, waivers) {
  return {
    issueId: issue.id,
    projectId: issue.projectId,
    statusType: normalizedStatus(issue),
    blockers: unique(issue.blockers)
      .sort()
      .map((blockerIssueId) => ({
        issueId: blockerIssueId,
        statusType: normalizedStatus(issueById.get(blockerIssueId) ?? {}),
        waiverApproved: validWaiver(waivers, issue.id, blockerIssueId),
      })),
  };
}

export function resolveReconciliation(input) {
  const issues = array(input?.issues)
    .filter((issue) => issue?.id)
    .map((issue) => ({
      ...issue,
      id: String(issue.id),
      taskId:
        typeof issue.taskId === "string" && issue.taskId.trim().length > 0
          ? issue.taskId.trim()
          : undefined,
      blockers: array(issue.blockers).map(String),
    }))
    .sort(compareIssue);
  const control = input?.control ?? {};
  const decision = {
    schemaVersion: 1,
    projectId: String(control.projectId ?? "_unknown_"),
    runId: String(control.runId ?? "_unknown_"),
    status: "blocked",
    availableSlots: 0,
    active: [],
    dispatch: [],
    repair: [],
    inspect: [],
    quarantined: [],
    confirmations: [],
    blocked: [],
    globalReasons: [],
    nextBaseline: baselineObject(input?.baseline),
    confirmedExitedIssueIds: [],
  };

  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const runtime = runtimeState(input ?? {}, issueById);
  decision.active = runtime.active;
  decision.repair = runtime.repair;
  decision.inspect = runtime.inspect;
  decision.confirmedExitedIssueIds = runtime.confirmedExitedIssueIds;

  if (input?.schemaVersion !== 1 || control.schemaVersion !== 1) {
    decision.globalReasons.push("CONTROL_INVALID_SCHEMA");
    return decision;
  }
  if (!control.projectId || !control.runId || !Number.isInteger(control.maxConcurrency)) {
    decision.globalReasons.push("CONTROL_INVALID");
    return decision;
  }
  if (control.maxConcurrency < 1 || control.maxConcurrency > 10) {
    decision.globalReasons.push("CONCURRENCY_OUT_OF_RANGE");
    return decision;
  }

  decision.availableSlots = Math.max(0, control.maxConcurrency - runtime.capacityCount);
  if (control.active !== true) {
    decision.status = "noop";
    decision.globalReasons.push("CONTROL_INACTIVE");
    return decision;
  }

  const providers = input.providers ?? {};
  if (!new Set(["ready", "partial"]).has(providers.linear)) {
    decision.globalReasons.push("LINEAR_UNAVAILABLE");
  }
  if (providers.github !== "ready") decision.globalReasons.push("GITHUB_UNAVAILABLE");
  if (!new Set(["ready", "partial"]).has(providers.superset)) {
    decision.globalReasons.push("SUPERSET_UNAVAILABLE");
  }

  const allLinearUnknown = array(input.linearUnknown ?? input.unknown);
  const linearUnknown = allLinearUnknown.filter((entry) => entry?.requiredForDecision !== false);
  const scopedUnknownIssueIds = new Set(
    linearUnknown
      .map((entry) => entry?.issueId)
      .filter(Boolean)
      .map(String),
  );
  for (const issue of issues) {
    if (scopedUnknownIssueIds.has(issue.id)) issue.dataState = "unknown";
  }
  if (
    providers.linear === "partial" &&
    allLinearUnknown.length === 0 &&
    !issues.some((issue) => issue.dataState !== undefined && issue.dataState !== "known")
  ) {
    decision.globalReasons.push("LINEAR_PARTIAL_UNSCOPED");
  }
  if (linearUnknown.some((entry) => !entry?.issueId)) {
    decision.globalReasons.push("LINEAR_REQUIRED_DATA_UNKNOWN");
  }

  const allRuntimeUnknown = array(input.runtimeUnknown);
  const runtimeUnknown = allRuntimeUnknown.filter((entry) => entry?.requiredForDecision !== false);
  const scopedRuntimeUnknownIssueIds = new Set(
    runtimeUnknown
      .map((entry) => entry?.issueId)
      .filter(Boolean)
      .map(String),
  );
  for (const issueId of scopedRuntimeUnknownIssueIds) runtime.guardedIssueIds.add(issueId);
  if (providers.superset === "partial" && allRuntimeUnknown.length === 0) {
    decision.globalReasons.push("SUPERSET_PARTIAL_UNSCOPED");
  }
  if (runtimeUnknown.some((entry) => !entry?.issueId)) {
    decision.globalReasons.push("SUPERSET_REQUIRED_DATA_UNKNOWN");
  }
  if (decision.globalReasons.length > 0) return decision;

  const quarantineReasons = graphQuarantine(issues, issueById, control.projectId);
  decision.quarantined = issues
    .filter((issue) => quarantineReasons.has(issue.id))
    .map((issue) => ({ issueId: issue.id, reasons: unique(quarantineReasons.get(issue.id)) }));

  const baseline = normalizedBaseline(input.baseline);
  decision.nextBaseline = safeDecisionBaseline(
    issues,
    input.baseline,
    quarantineReasons,
    scopedUnknownIssueIds,
  );
  const waivers = array(input.waivers);
  const confirmedExpansions = new Set(array(input.confirmedRunnableExpansions).map(String));
  const candidates = [];

  for (const issue of issues) {
    if (quarantineReasons.has(issue.id) || runtime.guardedIssueIds.has(issue.id)) continue;
    const status = normalizedStatus(issue);
    if (status === "unknown") {
      decision.blocked.push({ issueId: issue.id, reasons: ["STATUS_UNKNOWN"] });
      continue;
    }
    if (!STARTABLE_STATUS_TYPES.has(status)) continue;

    const reasons = blockerReasons(issue.blockers, issue.id, issueById, waivers);
    if (reasons.length > 0) {
      decision.blocked.push({ issueId: issue.id, reasons });
      continue;
    }

    const baselineBlockers = baseline.blockers.get(issue.id) ?? [];
    const baselineReasons = blockerReasons(baselineBlockers, issue.id, issueById, waivers);
    const expandsRunnable = !baseline.issueIds.has(issue.id) || baselineReasons.length > 0;
    if (expandsRunnable && !confirmedExpansions.has(issue.id)) {
      decision.confirmations.push({ issueId: issue.id, reason: "RUNNABLE_EXPANSION" });
      continue;
    }
    candidates.push(issue);
  }

  decision.blocked.sort((left, right) =>
    compareIssue(issueById.get(left.issueId), issueById.get(right.issueId)),
  );
  decision.confirmations.sort((left, right) =>
    compareIssue(issueById.get(left.issueId), issueById.get(right.issueId)),
  );
  decision.dispatch = candidates.slice(0, decision.availableSlots).map((issue) => ({
    issueId: issue.id,
    taskId: issue.taskId,
    order: issue.order,
    eligibility: dispatchEligibility(issue, issueById, waivers),
  }));

  if (decision.dispatch.length > 0 || decision.repair.length > 0) decision.status = "ready";
  else if (decision.availableSlots === 0) decision.status = "noop";
  else if (
    decision.inspect.length > 0 ||
    decision.quarantined.length > 0 ||
    decision.confirmations.length > 0 ||
    decision.blocked.some((entry) => entry.reasons.some((reason) => reason.includes("UNKNOWN")))
  ) {
    decision.status = "blocked";
  } else decision.status = "noop";

  return decision;
}
