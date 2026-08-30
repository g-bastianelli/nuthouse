import { LinearSnapshotValidationError, validateLinearSnapshot } from "./linear-snapshot.mjs";

export const STARTABLE_LINEAR_STATUS_TYPES = new Set(["backlog", "triage", "unstarted"]);
export const TERMINAL_LINEAR_STATUS_TYPES = new Set(["completed", "canceled"]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addReason(reasonMap, issueId, reason) {
  if (!reasonMap.has(issueId)) reasonMap.set(issueId, new Set());
  reasonMap.get(issueId).add(reason);
}

function knownTerminal(issue, projectId) {
  return (
    issue !== undefined &&
    issue.projectId === projectId &&
    issue.dataState === "known" &&
    TERMINAL_LINEAR_STATUS_TYPES.has(issue.statusType)
  );
}

function findCycles(issueById, projectId) {
  const indexById = new Map();
  const lowLinkById = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  let nextIndex = 0;

  function visit(issueId) {
    indexById.set(issueId, nextIndex);
    lowLinkById.set(issueId, nextIndex);
    nextIndex += 1;
    stack.push(issueId);
    onStack.add(issueId);

    const issue = issueById.get(issueId);
    for (const blockerIssueId of issue.blockerIssueIds) {
      const blocker = issueById.get(blockerIssueId);
      if (
        blockerIssueId === issueId ||
        !blocker ||
        blocker.projectId !== projectId ||
        knownTerminal(blocker, projectId)
      ) {
        continue;
      }
      if (!indexById.has(blockerIssueId)) {
        visit(blockerIssueId);
        lowLinkById.set(
          issueId,
          Math.min(lowLinkById.get(issueId), lowLinkById.get(blockerIssueId)),
        );
      } else if (onStack.has(blockerIssueId)) {
        lowLinkById.set(issueId, Math.min(lowLinkById.get(issueId), indexById.get(blockerIssueId)));
      }
    }

    if (lowLinkById.get(issueId) !== indexById.get(issueId)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== issueId);
    component.sort(compareStrings);
    if (component.length > 1) cycles.push(component);
  }

  for (const issue of issueById.values()) {
    if (
      issue.projectId === projectId &&
      !knownTerminal(issue, projectId) &&
      !indexById.has(issue.issueId)
    ) {
      visit(issue.issueId);
    }
  }
  return cycles.sort((left, right) => compareStrings(left[0], right[0]));
}

function normalizeForcedIssueIds(value) {
  if (!Array.isArray(value)) {
    throw new LinearSnapshotValidationError(
      "FRONTIER_INVALID_FORCE_SCOPE",
      "forcedIssueIds must be an array",
    );
  }
  const normalized = value.map((issueId) => {
    if (typeof issueId !== "string" || issueId.trim().length === 0) {
      throw new LinearSnapshotValidationError(
        "FRONTIER_INVALID_FORCE_SCOPE",
        "forcedIssueIds must contain non-empty strings",
      );
    }
    return issueId.trim();
  });
  return new Set(normalized);
}

function sortedReasons(reasons) {
  return [...(reasons ?? [])].sort(compareStrings);
}

function forceBypassedBlockerIssueIds(issue, issueById, projectId) {
  return issue.blockerIssueIds
    .filter((blockerIssueId) => !knownTerminal(issueById.get(blockerIssueId), projectId))
    .sort(compareStrings);
}

function forceBypassedUncertainties(issue, invalidReasons) {
  const relevantIssueIds = [...new Set([issue.issueId, ...issue.blockerIssueIds])].sort(
    compareStrings,
  );
  return relevantIssueIds.flatMap((issueId) =>
    sortedReasons(invalidReasons.get(issueId)).map((code) => ({ issueId, code })),
  );
}

export function planLinearFrontier(snapshotOrCache, { forcedIssueIds = [] } = {}) {
  const snapshot = validateLinearSnapshot(snapshotOrCache);
  const forceScope = normalizeForcedIssueIds(forcedIssueIds);
  const issueById = new Map(snapshot.issues.map((issue) => [issue.issueId, issue]));
  const dependentsByBlocker = new Map(snapshot.issues.map((issue) => [issue.issueId, new Set()]));
  const invalidReasons = new Map();
  const hardInvalidIssueIds = new Set();

  for (const issue of snapshot.issues) {
    const isTerminal = knownTerminal(issue, snapshot.projectId);
    if (issue.projectId !== snapshot.projectId) {
      hardInvalidIssueIds.add(issue.issueId);
      addReason(invalidReasons, issue.issueId, `CROSS_PROJECT_ISSUE:${issue.projectId}`);
    }
    if (issue.dataState !== "known") {
      hardInvalidIssueIds.add(issue.issueId);
      addReason(invalidReasons, issue.issueId, "DATA_UNKNOWN");
    }
    if (issue.statusType === "unknown") {
      hardInvalidIssueIds.add(issue.issueId);
      addReason(invalidReasons, issue.issueId, "STATUS_UNKNOWN");
    }
    if (isTerminal) continue;
    for (const blockerIssueId of issue.blockerIssueIds) {
      if (blockerIssueId === issue.issueId) {
        addReason(invalidReasons, issue.issueId, "SELF_RELATION");
        continue;
      }
      const blocker = issueById.get(blockerIssueId);
      if (!blocker) {
        addReason(invalidReasons, issue.issueId, `BLOCKER_UNKNOWN:${blockerIssueId}`);
        continue;
      }
      dependentsByBlocker.get(blockerIssueId).add(issue.issueId);
      if (blocker.projectId !== snapshot.projectId) {
        addReason(invalidReasons, issue.issueId, `CROSS_PROJECT_RELATION:${blockerIssueId}`);
      }
    }
  }

  for (const entry of snapshot.unknown) {
    if (entry.issueId === undefined) {
      for (const issue of snapshot.issues) {
        if (knownTerminal(issue, snapshot.projectId)) continue;
        hardInvalidIssueIds.add(issue.issueId);
        addReason(invalidReasons, issue.issueId, `UNKNOWN:${entry.code}`);
      }
      continue;
    }
    const issue = issueById.get(entry.issueId);
    if (!knownTerminal(issue, snapshot.projectId)) {
      addReason(invalidReasons, entry.issueId, `UNKNOWN:${entry.code}`);
    }
  }

  for (const component of findCycles(issueById, snapshot.projectId)) {
    const reason = `CYCLE:${component.join(",")}`;
    for (const issueId of component) addReason(invalidReasons, issueId, reason);
  }

  const propagationQueue = [...invalidReasons.keys()].sort(compareStrings);
  const queued = new Set(propagationQueue);
  for (let index = 0; index < propagationQueue.length; index += 1) {
    const invalidIssueId = propagationQueue[index];
    for (const dependentIssueId of dependentsByBlocker.get(invalidIssueId) ?? []) {
      const dependent = issueById.get(dependentIssueId);
      if (knownTerminal(dependent, snapshot.projectId)) continue;
      addReason(invalidReasons, dependentIssueId, `DEPENDS_ON_INVALID:${invalidIssueId}`);
      if (!queued.has(dependentIssueId)) {
        queued.add(dependentIssueId);
        propagationQueue.push(dependentIssueId);
      }
    }
  }

  const rows = snapshot.issues.map((issue) => {
    const terminal = knownTerminal(issue, snapshot.projectId);
    if (terminal) {
      return {
        issueId: issue.issueId,
        blockerIssueIds: issue.blockerIssueIds,
        linearStatusType: issue.statusType,
        classification: "terminal",
        forced: false,
      };
    }

    const forceEligible =
      forceScope.has(issue.issueId) &&
      !hardInvalidIssueIds.has(issue.issueId) &&
      (STARTABLE_LINEAR_STATUS_TYPES.has(issue.statusType) || issue.statusType === "started");
    if (forceEligible) {
      return {
        issueId: issue.issueId,
        blockerIssueIds: issue.blockerIssueIds,
        linearStatusType: issue.statusType,
        classification: "ready",
        reason: "FORCED",
        forced: true,
        forceBypassedBlockerIssueIds: forceBypassedBlockerIssueIds(
          issue,
          issueById,
          snapshot.projectId,
        ),
        forceBypassedUncertainties: forceBypassedUncertainties(issue, invalidReasons),
      };
    }

    const reasons = sortedReasons(invalidReasons.get(issue.issueId));
    if (issue.statusType === "started" && !hardInvalidIssueIds.has(issue.issueId)) {
      return {
        issueId: issue.issueId,
        blockerIssueIds: issue.blockerIssueIds,
        linearStatusType: issue.statusType,
        classification: "started",
        ...(reasons.length > 0 ? { reason: reasons.join(";") } : {}),
        forced: false,
      };
    }

    if (reasons.length > 0) {
      return {
        issueId: issue.issueId,
        blockerIssueIds: issue.blockerIssueIds,
        linearStatusType: issue.statusType,
        classification: "unknown",
        reason: reasons.join(";"),
        forced: false,
      };
    }

    if (STARTABLE_LINEAR_STATUS_TYPES.has(issue.statusType)) {
      const incompleteBlockerIssueIds = issue.blockerIssueIds.filter(
        (blockerIssueId) => !knownTerminal(issueById.get(blockerIssueId), snapshot.projectId),
      );
      if (incompleteBlockerIssueIds.length === 0) {
        return {
          issueId: issue.issueId,
          blockerIssueIds: issue.blockerIssueIds,
          linearStatusType: issue.statusType,
          classification: "ready",
          forced: false,
        };
      }
      return {
        issueId: issue.issueId,
        blockerIssueIds: issue.blockerIssueIds,
        linearStatusType: issue.statusType,
        classification: "blocked",
        reason: `BLOCKERS_INCOMPLETE:${incompleteBlockerIssueIds.join(",")}`,
        forced: false,
      };
    }

    return {
      issueId: issue.issueId,
      blockerIssueIds: issue.blockerIssueIds,
      linearStatusType: issue.statusType,
      classification: "unknown",
      reason: "STATUS_UNKNOWN",
      forced: false,
    };
  });

  const issueIdsWithClassification = (classification) =>
    rows.filter((row) => row.classification === classification).map((row) => row.issueId);
  const startedIssueIds = issueIdsWithClassification("started");
  const globalUnknown = snapshot.unknown.filter((entry) => entry.issueId === undefined);
  return {
    rows,
    readyIssueIds: issueIdsWithClassification("ready"),
    startedIssueIds,
    confirmationIssueIds: [...startedIssueIds],
    unknownIssueIds: issueIdsWithClassification("unknown"),
    degraded: globalUnknown.length > 0,
    globalUnknown,
  };
}
