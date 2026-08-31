import { describe, expect, mock, test } from "bun:test";

import {
  authorizeFreshCandidate,
  runOrchestrationEpoch as runOrchestrationEpochKernel,
} from "../lib/orchestration-epoch.mjs";
import { OrchestrationEffectRequired } from "../lib/orchestration-effect-signal.mjs";
import { planRuntimeActions } from "../lib/runtime-actions.mjs";

const LOCK_DIRECTORY = "/tmp/monkey-maestro-test-locks";

function runOrchestrationEpoch(input) {
  const runtimeActions = [...(input.runtimePlan?.actions ?? [])].sort((left, right) =>
    left.issueId.localeCompare(right.issueId),
  );
  const availableCapacity = Math.max(
    0,
    (input.maxConcurrency ?? input.control?.maxConcurrency ?? 0) -
      runtimeActions.filter((item) => item.action === "monitor").length,
  );
  const selectedDispatchActions =
    input.frontierPlan?.degraded === true
      ? []
      : runtimeActions
          .filter((item) => ["create", "reuse"].includes(item.action))
          .slice(0, availableCapacity);
  const dispatchContextByIssueId =
    input.dispatchContextByIssueId ??
    Object.fromEntries(
      selectedDispatchActions.map((item) => [
        item.issueId,
        {
          branchName: `feature/${item.issueId.toLowerCase()}`,
          workspaceName: `workspace-${item.issueId.toLowerCase()}`,
          workerPrompt: `linear-devotee:greet ${item.issueId}\nDo the exact scoped work.`,
        },
      ]),
    );
  return runOrchestrationEpochKernel({
    lockDirectory: LOCK_DIRECTORY,
    dispatchContextByIssueId,
    ...input,
  });
}

function row(issueId, overrides = {}) {
  const classification = overrides.classification ?? "ready";
  const value = {
    issueId,
    blockerIssueIds: [],
    classification,
    linearStatusType:
      overrides.linearStatusType ?? (classification === "started" ? "started" : "unstarted"),
    forced: false,
    ...overrides,
  };
  return value.forced === true
    ? {
        ...value,
        forceBypassedBlockerIssueIds: value.forceBypassedBlockerIssueIds ?? value.blockerIssueIds,
        forceBypassedUncertainties: value.forceBypassedUncertainties ?? [],
      }
    : value;
}

function frontier(rows = []) {
  return {
    rows,
    readyIssueIds: rows
      .filter((item) => item.classification === "ready")
      .map((item) => item.issueId),
    startedIssueIds: rows
      .filter((item) => item.classification === "started")
      .map((item) => item.issueId),
    confirmationIssueIds: [],
    unknownIssueIds: [],
  };
}

function action(issueId, overrides = {}) {
  const linearClassification = overrides.linearClassification ?? "ready";
  return {
    issueId,
    action: "create",
    taskId: `task-${issueId}`,
    forced: false,
    linearClassification,
    linearStatusType:
      overrides.linearStatusType ?? (linearClassification === "started" ? "started" : "unstarted"),
    ...overrides,
  };
}

function runtimePlan(actions = []) {
  return { actions, selectedIssueIds: actions.map((item) => item.issueId), capacityUsed: 0 };
}

function control(overrides = {}) {
  return {
    projectId: "linear-project",
    runId: "run-1",
    active: true,
    targetHostId: "host-1",
    supersetProjectId: "superset-project",
    defaultAgent: "codex",
    maxConcurrency: 2,
    revision: 1,
    ...overrides,
  };
}

function issue(issueId, statusType, blockerIssueIds = []) {
  return {
    issueId,
    projectId: "linear-project",
    statusType,
    blockerIssueIds,
    dataState: "known",
  };
}

function freshSnapshot(issueId, { statusType = "backlog", blockers = [], unknown = [] } = {}) {
  const blockerIssueIds = blockers.map((blocker) => blocker.issueId);
  const issues = [issue(issueId, statusType, blockerIssueIds), ...blockers];
  return {
    schemaVersion: 1,
    projectId: "linear-project",
    scope: {
      mode: "targeted",
      requestedIssueIds: issues.map((item) => item.issueId).sort(),
    },
    issues,
    unknown,
  };
}

function runtimeInspection(issueId, overrides = {}) {
  const runtimeControl = overrides.control ?? control();
  const taskId = overrides.taskId ?? `task-${issueId}`;
  const workspaceIds = overrides.workspaceIds ?? [];
  const terminalIds = overrides.terminalIds ?? [];
  const activeTerminalIds = new Set(overrides.activeTerminalIds ?? terminalIds);
  return {
    schemaVersion: 1,
    provider: "ready",
    context: {
      targetHostId: runtimeControl.targetHostId,
      supersetProjectId: runtimeControl.supersetProjectId,
      linearProjectId: runtimeControl.projectId,
    },
    scope: { selectedIssueIds: [issueId] },
    issues: [
      {
        issueId,
        task: {
          id: taskId,
          externalProvider: "linear",
          externalKey: issueId,
          externalProjectId: runtimeControl.projectId.startsWith("manual:")
            ? null
            : runtimeControl.projectId,
          deletedAt: null,
          syncError: null,
        },
        workspaces: workspaceIds.map((workspaceId) => ({
          workspaceId,
          taskId,
          hostId: runtimeControl.targetHostId,
          projectId: runtimeControl.supersetProjectId,
        })),
        terminals: terminalIds.map((terminalId) => ({
          workspaceId: workspaceIds[0],
          terminalId,
          active: activeTerminalIds.has(terminalId),
        })),
        dataState: "known",
      },
    ],
    unknown: [],
  };
}

function dispatchResult(input, overrides = {}) {
  const state = overrides.state ?? "verified";
  const runtimeControl = control({
    projectId: input.linearProjectId,
    targetHostId: input.targetHostId,
    supersetProjectId: input.supersetProjectId,
  });
  const lockVerification = {
    directory: input.lockReceipt.directory,
    projectId: input.lockReceipt.projectId,
    hostId: input.lockReceipt.owner.hostId,
    token: input.lockReceipt.token,
    verifiedAt: "2026-08-30T10:01:00.000Z",
    expiresAt: input.lockReceipt.owner.expiresAt,
  };
  if (["ambiguous", "failed"].includes(state)) {
    return {
      schemaVersion: 1,
      state,
      issueId: input.issueId,
      taskId: input.taskId,
      context: {
        targetHostId: input.targetHostId,
        supersetProjectId: input.supersetProjectId,
        linearProjectId: input.linearProjectId,
      },
      lockVerification,
      code: overrides.code ?? (state === "ambiguous" ? "MUTATION_AMBIGUOUS" : "MUTATION_FAILED"),
    };
  }
  const workspaceId = overrides.workspaceId ?? input.workspaceId ?? `workspace-${input.issueId}`;
  const terminalIds =
    overrides.terminalIds ?? (state === "verified" ? [`terminal-${input.issueId}`] : []);
  return {
    schemaVersion: 1,
    state,
    action: overrides.action ?? input.action,
    lockVerification,
    runtimeSnapshot: runtimeInspection(input.issueId, {
      control: runtimeControl,
      taskId: input.taskId,
      workspaceIds: [workspaceId],
      terminalIds,
      activeTerminalIds: overrides.activeTerminalIds ?? terminalIds,
    }),
    record: overrides.record ?? { status: state === "verified" ? "written" : "not-attempted" },
    ...(state === "partial" ? { failedPhase: overrides.failedPhase ?? "agent-create" } : {}),
  };
}

function eventRefreshSnapshot(issueIds, blockersByIssueId = {}) {
  const blockerIds = issueIds.flatMap((issueId) => blockersByIssueId[issueId] ?? []);
  const requestedIssueIds = [...new Set([...issueIds, ...blockerIds])].sort();
  return {
    schemaVersion: 1,
    projectId: "linear-project",
    scope: { mode: "targeted", requestedIssueIds },
    issues: requestedIssueIds.map((issueId) =>
      issue(
        issueId,
        issueIds.includes(issueId) ? "backlog" : "completed",
        blockersByIssueId[issueId] ?? [],
      ),
    ),
    unknown: [],
  };
}

function baseAdapters(overrides = {}) {
  return {
    acquireDispatchLock: mock(async (input) => ({
      acquired: true,
      directory: input.directory,
      projectId: input.projectId,
      token: "lock-token",
      owner: {
        schemaVersion: 2,
        projectId: input.projectId,
        hostId: input.hostId,
        token: "lock-token",
        createdAt: "2026-08-30T10:00:00.000Z",
        expiresAt: "2026-08-30T10:15:00.000Z",
      },
    })),
    releaseDispatchLock: mock(async () => ({ released: true })),
    refreshCandidateAndBlockers: mock(async ({ issueId }) => freshSnapshot(issueId)),
    inspectExactRuntime: mock(async ({ issueId }) => runtimeInspection(issueId)),
    dispatchIssue: mock(async (input) => dispatchResult(input)),
    monitorWorker: mock(async () => ({})),
    refreshAfterWorkerEvent: mock(async ({ issueIds }) => eventRefreshSnapshot(issueIds)),
    ...overrides,
  };
}

describe("one orchestration epoch", () => {
  test("requires an explicit lock directory even for an idle invocation", async () => {
    await expect(
      runOrchestrationEpochKernel({
        frontierPlan: frontier(),
        runtimePlan: runtimePlan(),
        control: control(),
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("LOCK_DIRECTORY_REQUIRED");
  });

  test("cannot exceed the validated control concurrency policy", async () => {
    await expect(
      runOrchestrationEpoch({
        frontierPlan: frontier(),
        runtimePlan: runtimePlan(),
        control: control({ maxConcurrency: 2 }),
        maxConcurrency: 3,
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("MAX_CONCURRENCY_EXCEEDS_CONTROL");
    await expect(
      runOrchestrationEpoch({
        frontierPlan: frontier(),
        runtimePlan: runtimePlan(),
        control: control({ maxConcurrency: 11 }),
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("MAX_CONCURRENCY_INVALID");
  });

  test("requires exact creation context only for create and reuse actions", async () => {
    const input = {
      frontierPlan: frontier([row("NOT-CONTEXT")]),
      runtimePlan: runtimePlan([action("NOT-CONTEXT")]),
      control: control(),
      lockDirectory: LOCK_DIRECTORY,
      adapters: baseAdapters(),
    };

    await expect(runOrchestrationEpochKernel(input)).rejects.toThrow(
      "DISPATCH_CONTEXT_SCOPE_MISMATCH",
    );
    await expect(
      runOrchestrationEpochKernel({
        ...input,
        dispatchContextByIssueId: {
          "NOT-CONTEXT": {
            branchName: "feature/not-context",
            workspaceName: "workspace-not-context",
            workerPrompt: "linear-devotee:greet NOT-CONTEXT",
          },
          "NOT-EXTRA": {
            branchName: "feature/not-extra",
            workspaceName: "workspace-not-extra",
            workerPrompt: "linear-devotee:greet NOT-EXTRA",
          },
        },
      }),
    ).rejects.toThrow("DISPATCH_CONTEXT_SCOPE_MISMATCH");

    const monitorOnly = await runOrchestrationEpochKernel({
      frontierPlan: frontier([row("NOT-MONITOR", { classification: "started" })]),
      runtimePlan: runtimePlan([
        action("NOT-MONITOR", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-monitor",
          terminalId: "terminal-monitor",
        }),
      ]),
      control: control(),
      lockDirectory: LOCK_DIRECTORY,
      adapters: baseAdapters(),
    });
    expect(monitorOnly.status).toBe("busy");
  });

  test("returns idle immediately without polling, refresh, Superset, or GitHub", async () => {
    const adapters = baseAdapters({
      wait: mock(async () => undefined),
      github: mock(async () => undefined),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(),
      runtimePlan: runtimePlan(),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("idle");
    expect(adapters.wait).toHaveBeenCalledTimes(0);
    expect(adapters.github).toHaveBeenCalledTimes(0);
    expect(adapters.refreshCandidateAndBlockers).toHaveBeenCalledTimes(0);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
    expect(adapters.acquireDispatchLock).toHaveBeenCalledTimes(0);
  });

  test("cannot report idle when runtime planning omitted a ready Linear issue", async () => {
    await expect(
      runOrchestrationEpoch({
        frontierPlan: frontier([row("NOT-OMITTED")]),
        runtimePlan: runtimePlan(),
        control: control(),
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("RUNTIME_PLAN_FRONTIER_SCOPE_MISMATCH");
  });

  test("accepts one exact candidate scope while retaining unrelated frontier rows", async () => {
    const rows = [row("NOT-CANDIDATE"), row("NOT-UNRELATED")];
    const adapters = baseAdapters();

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([action("NOT-CANDIDATE")]),
      selectedIssueIds: ["NOT-CANDIDATE"],
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      issueId: "NOT-CANDIDATE",
      value: { outcome: "dispatched" },
    });
    expect(adapters.refreshCandidateAndBlockers).toHaveBeenCalledTimes(1);
  });

  test("reports degraded rather than idle for an empty globally unavailable Linear view", async () => {
    const result = await runOrchestrationEpoch({
      frontierPlan: {
        ...frontier(),
        degraded: true,
        globalUnknown: [{ code: "LINEAR_UNAVAILABLE", detail: "membership read failed" }],
      },
      runtimePlan: runtimePlan(),
      control: control(),
      adapters: baseAdapters(),
    });

    expect(result.status).toBe("degraded");
  });

  test("refuses stale dispatch actions before lock when Linear is globally unavailable", async () => {
    const adapters = baseAdapters();
    const result = await runOrchestrationEpoch({
      frontierPlan: {
        ...frontier([row("NOT-STALE")]),
        degraded: true,
        globalUnknown: [{ code: "LINEAR_UNAVAILABLE", detail: "membership read failed" }],
      },
      runtimePlan: runtimePlan([action("NOT-STALE")]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("degraded");
    expect(result.dispatch).toMatchObject({
      lock: { acquired: false, reason: "LINEAR_UNAVAILABLE" },
      settled: [
        {
          issueId: "NOT-STALE",
          value: { outcome: "refused", reason: "LINEAR_UNAVAILABLE" },
        },
      ],
    });
    expect(adapters.acquireDispatchLock).toHaveBeenCalledTimes(0);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(0);
  });

  test("limits dispatch by capacity and lets a sibling succeed through allSettled", async () => {
    const calls = [];
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) => {
        calls.push(`${issueId}:refresh`);
        return freshSnapshot(issueId, {
          blockers: issueId === "NOT-A" ? [issue("NOT-DONE", "completed")] : [],
        });
      }),
      dispatchIssue: mock(async (input) => {
        calls.push(`${input.issueId}:dispatch`);
        if (input.issueId === "NOT-A") {
          throw Object.assign(new Error("A failed"), { code: "A_FAILED" });
        }
        return dispatchResult(input);
      }),
    });
    const rows = [row("NOT-A", { blockerIssueIds: ["NOT-DONE"] }), row("NOT-B"), row("NOT-C")];

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan(rows.map((item) => action(item.issueId))),
      control: control({ maxConcurrency: 2 }),
      adapters,
    });

    expect(result.selectedIssueIds).toEqual(["NOT-A", "NOT-B"]);
    expect(result.deferredIssueIds).toEqual(["NOT-C"]);
    expect(result.dispatch.settled).toMatchObject([
      { issueId: "NOT-A", status: "rejected", reason: { code: "A_FAILED" } },
      {
        issueId: "NOT-B",
        status: "fulfilled",
        value: { outcome: "dispatched" },
      },
    ]);
    expect(calls).toContain("NOT-A:dispatch");
    expect(calls).toContain("NOT-B:dispatch");
    expect(calls).not.toContain("NOT-C:refresh");
    for (const issueId of ["NOT-A", "NOT-B"]) {
      expect(calls.indexOf(`${issueId}:refresh`)).toBeLessThan(
        calls.indexOf(`${issueId}:dispatch`),
      );
    }
    expect(adapters.acquireDispatchLock).toHaveBeenCalledTimes(1);
    expect(adapters.acquireDispatchLock.mock.calls[0][0]).toEqual({
      directory: LOCK_DIRECTORY,
      projectId: "linear-project",
      hostId: "host-1",
      issueIds: ["NOT-A", "NOT-B"],
    });
    expect(adapters.releaseDispatchLock).toHaveBeenCalledTimes(1);
    expect(adapters.releaseDispatchLock.mock.calls[0][0]).toMatchObject({
      acquired: true,
      directory: LOCK_DIRECTORY,
      projectId: "linear-project",
      token: "lock-token",
      owner: { schemaVersion: 2, hostId: "host-1", token: "lock-token" },
    });
  });

  test("refuses mutation when the acquired lock receipt is not exactly bound", async () => {
    const adapters = baseAdapters({
      acquireDispatchLock: mock(async () => ({ acquired: true, token: "unbound" })),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-LOCK")]),
      runtimePlan: runtimePlan([action("NOT-LOCK")]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("degraded");
    expect(result.dispatch.settled[0]).toMatchObject({
      status: "rejected",
      reason: { code: "LOCK_RECEIPT_INVALID" },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(0);
    expect(adapters.releaseDispatchLock).toHaveBeenCalledTimes(0);
  });

  test("cannot derive force authority from an unconfirmed runtime action", () => {
    const snapshot = freshSnapshot("NOT-FORGE", {
      blockers: [issue("NOT-BLOCKER", "backlog")],
    });

    expect(
      authorizeFreshCandidate({
        action: action("NOT-FORGE", { forced: true }),
        snapshot,
        projectId: "linear-project",
      }),
    ).toEqual({ authorized: false, reason: "CONFIRMATION_REQUIRED" });
  });

  test("rejects a runtime plan that forges or drops the frontier force bit", async () => {
    await expect(
      runOrchestrationEpoch({
        frontierPlan: frontier([row("NOT-FORGE-FORCE")]),
        runtimePlan: runtimePlan([
          action("NOT-FORGE-FORCE", {
            forced: true,
            forceAuthorized: true,
            confirmationAccepted: true,
            forceInvocationId: "invocation-force",
            forceBypassedBlockerIssueIds: [],
            forceBypassedUncertainties: [],
          }),
        ]),
        control: control(),
        invocationId: "invocation-force",
        adapters: baseAdapters(),
      }),
    ).rejects.toThrow("RUNTIME_PLAN_FRONTIER_MISMATCH");
  });

  test("refreshes candidate and live blockers under lock, with force scoped to one issue", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, {
          blockers: [issue(`${issueId}-BLOCKER`, "backlog")],
        }),
      ),
    });
    const rows = [
      row("NOT-FORCED", {
        blockerIssueIds: ["NOT-FORCED-BLOCKER"],
        forced: true,
      }),
      row("NOT-NORMAL", { blockerIssueIds: ["NOT-NORMAL-BLOCKER"] }),
    ];

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([
        action("NOT-FORCED", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: ["NOT-FORCED-BLOCKER"],
          forceBypassedUncertainties: [],
        }),
        action("NOT-NORMAL"),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled).toMatchObject([
      {
        issueId: "NOT-FORCED",
        status: "fulfilled",
        value: { outcome: "dispatched" },
      },
      {
        issueId: "NOT-NORMAL",
        status: "fulfilled",
        value: {
          outcome: "refused",
          reason: "BLOCKERS_INCOMPLETE:NOT-NORMAL-BLOCKER",
        },
      },
    ]);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.dispatchIssue.mock.calls[0][0].issueId).toBe("NOT-FORCED");
  });

  test("reauthorizes confirmed force without inventing uncertainty for an omitted blocker subgraph", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, {
          blockers: [issue("NOT-DIRECT-BLOCKER", "backlog", ["NOT-TRANSITIVE-BLOCKER"])],
        }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-MULTILEVEL-FORCE", {
          blockerIssueIds: ["NOT-DIRECT-BLOCKER"],
          forced: true,
        }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-MULTILEVEL-FORCE", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-multilevel-force",
          forceBypassedBlockerIssueIds: ["NOT-DIRECT-BLOCKER"],
          forceBypassedUncertainties: [],
        }),
      ]),
      control: control(),
      invocationId: "invocation-multilevel-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      status: "fulfilled",
      value: { outcome: "dispatched" },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
  });

  test("uses newly-added live blockers instead of the cached pre-lock relation set", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, { blockers: [issue("NOT-NEW-BLOCKER", "backlog")] }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-RACE")]),
      runtimePlan: runtimePlan([action("NOT-RACE")]),
      control: control(),
      adapters,
    });

    expect(adapters.refreshCandidateAndBlockers.mock.calls[0][0]).toEqual({
      issueId: "NOT-RACE",
      refreshMode: "candidate-blockers",
    });
    expect(result.dispatch.settled[0]).toMatchObject({
      value: {
        outcome: "refused",
        reason: "BLOCKERS_INCOMPLETE:NOT-NEW-BLOCKER",
      },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
  });

  test("does not widen confirmed force when the live bypass scope changed", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, {
          blockers: [issue("NOT-OLD", "backlog"), issue("NOT-NEW", "backlog")],
        }),
      ),
    });
    const forcedAction = action("NOT-FORCE-RACE", {
      forced: true,
      forceAuthorized: true,
      confirmationAccepted: true,
      forceInvocationId: "invocation-force",
      forceBypassedBlockerIssueIds: ["NOT-OLD"],
      forceBypassedUncertainties: [],
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-RACE", { blockerIssueIds: ["NOT-OLD"], forced: true }),
      ]),
      runtimePlan: runtimePlan([forcedAction]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "FORCE_SCOPE_CHANGED" },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(0);
  });

  test("does not widen confirmed force when fresh Linear uncertainty appears", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, {
          blockers: [issue("NOT-UNCERTAIN-BLOCKER", "backlog")],
          unknown: [
            {
              issueId,
              code: "RELATIONS_PARTIAL",
              detail: "relation pagination became incomplete",
            },
          ],
        }),
      ),
    });
    const forcedAction = action("NOT-FORCE-UNCERTAINTY", {
      forced: true,
      forceAuthorized: true,
      confirmationAccepted: true,
      forceInvocationId: "invocation-force",
      forceBypassedBlockerIssueIds: ["NOT-UNCERTAIN-BLOCKER"],
      forceBypassedUncertainties: [],
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-UNCERTAINTY", {
          blockerIssueIds: ["NOT-UNCERTAIN-BLOCKER"],
          forced: true,
        }),
      ]),
      runtimePlan: runtimePlan([forcedAction]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "FORCE_SCOPE_CHANGED" },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
  });

  test("allows only the exact previewed force uncertainty scope", async () => {
    const forceBypassedUncertainties = [
      {
        issueId: "NOT-FORCE-PREVIEWED",
        code: "DEPENDS_ON_INVALID:NOT-PREVIEWED-BLOCKER",
      },
      {
        issueId: "NOT-PREVIEWED-BLOCKER",
        code: "UNKNOWN:RELATIONS_PARTIAL",
      },
    ];
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, {
          blockers: [issue("NOT-PREVIEWED-BLOCKER", "backlog")],
          unknown: [
            {
              issueId: "NOT-PREVIEWED-BLOCKER",
              code: "RELATIONS_PARTIAL",
              detail: "previewed relation uncertainty",
            },
          ],
        }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-PREVIEWED", {
          blockerIssueIds: ["NOT-PREVIEWED-BLOCKER"],
          forced: true,
          forceBypassedUncertainties,
        }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-FORCE-PREVIEWED", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: ["NOT-PREVIEWED-BLOCKER"],
          forceBypassedUncertainties,
        }),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({ value: { outcome: "dispatched" } });
  });

  test("invalidates force when a fresh deterministic relation cycle appears", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, {
          blockers: [issue("NOT-CYCLE-BLOCKER", "backlog", [issueId])],
        }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-CYCLE", {
          blockerIssueIds: ["NOT-CYCLE-BLOCKER"],
          forced: true,
        }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-FORCE-CYCLE", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: ["NOT-CYCLE-BLOCKER"],
          forceBypassedUncertainties: [],
        }),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "FORCE_SCOPE_CHANGED" },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
  });

  test("allows confirmed force scope to narrow when a relation is removed", async () => {
    const adapters = baseAdapters();
    const forcedAction = action("NOT-FORCE-NARROW", {
      forced: true,
      forceAuthorized: true,
      confirmationAccepted: true,
      forceInvocationId: "invocation-force",
      forceBypassedBlockerIssueIds: ["NOT-REMOVED"],
      forceBypassedUncertainties: [],
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-NARROW", {
          blockerIssueIds: ["NOT-REMOVED"],
          forced: true,
        }),
      ]),
      runtimePlan: runtimePlan([forcedAction]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({ value: { outcome: "dispatched" } });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
  });

  test("requires a new confirmation when ready work becomes started under lock", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, { statusType: "started" }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-START-RACE")]),
      runtimePlan: runtimePlan([action("NOT-START-RACE")]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "CONFIRMATION_REQUIRED" },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
  });

  test("requires a new started confirmation when forced unstarted work becomes started", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, { statusType: "started" }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-START-RACE", { forced: true, linearStatusType: "unstarted" }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-FORCE-START-RACE", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: [],
          forceBypassedUncertainties: [],
        }),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "CONFIRMATION_REQUIRED" },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
  });

  test("accepts force confirmation that previewed an already-started issue", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, { statusType: "started" }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-FORCE-STARTED", { forced: true, linearStatusType: "started" }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-FORCE-STARTED", {
          forced: true,
          linearStatusType: "started",
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: [],
          forceBypassedUncertainties: [],
        }),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({ value: { outcome: "dispatched" } });
  });

  test("dispatches started work only when that started state was explicitly confirmed", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, { statusType: "started" }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-START-CONFIRMED", { classification: "started" })]),
      runtimePlan: runtimePlan([
        action("NOT-START-CONFIRMED", {
          linearClassification: "started",
          confirmationAccepted: true,
        }),
      ]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "dispatched", action: "create" },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
  });

  test("refuses a forced dispatch when Linear became terminal", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) =>
        freshSnapshot(issueId, { statusType: "completed" }),
      ),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-DONE", { forced: true })]),
      runtimePlan: runtimePlan([
        action("NOT-DONE", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: [],
          forceBypassedUncertainties: [],
        }),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      status: "fulfilled",
      value: { outcome: "refused", reason: "TERMINAL" },
    });
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(0);
  });

  test("rejects malformed fallback inspections after invalid dispatch evidence", async () => {
    const adapters = baseAdapters({
      inspectExactRuntime: mock(async ({ issueId }) => ({
        issueId,
        taskId: `task-${issueId}`,
        workspaceIds: [],
        terminalIds: [],
        dataState: "known",
      })),
      dispatchIssue: mock(async (input) => {
        const result = dispatchResult(input);
        delete result.action;
        return result;
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-DIRECT")]),
      runtimePlan: runtimePlan([action("NOT-DIRECT")]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      status: "rejected",
      reason: { code: "RUNTIME_INSPECTION_ENVELOPE_REQUIRED" },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(1);
  });

  test("lets dispatch absorb a live runtime race and monitors it only after lock release", async () => {
    const order = [];
    const adapters = baseAdapters({
      dispatchIssue: mock(async (input) => {
        order.push("dispatch");
        return dispatchResult(input, {
          action: "reuse",
          workspaceId: "workspace-adopted",
          terminalIds: ["terminal-adopted"],
          activeTerminalIds: ["terminal-adopted"],
        });
      }),
      releaseDispatchLock: mock(async () => {
        order.push("release");
        return { released: true };
      }),
      monitorWorker: mock(async (input) => {
        order.push(`monitor:${input.terminalId}`);
        return {};
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-ADOPT")]),
      runtimePlan: runtimePlan([action("NOT-ADOPT")]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: {
        outcome: "dispatched",
        action: "reuse",
      },
    });
    expect(result.monitoring.settled[0]).toMatchObject({
      issueId: "NOT-ADOPT",
      value: { outcome: "monitored" },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(0);
    expect(order).toEqual(["dispatch", "release", "monitor:terminal-adopted"]);
  });

  test("rejects reuse evidence that changes the requested action or workspace", async () => {
    for (const invalidMutation of [
      { action: "create", workspaceId: "workspace-expected" },
      { action: "reuse", workspaceId: "workspace-other" },
    ]) {
      const adapters = baseAdapters({
        inspectExactRuntime: mock(async ({ issueId }) =>
          runtimeInspection(issueId, { workspaceIds: ["workspace-expected"] }),
        ),
        dispatchIssue: mock(async (input) => dispatchResult(input, invalidMutation)),
      });

      const result = await runOrchestrationEpoch({
        frontierPlan: frontier([row("NOT-REUSE")]),
        runtimePlan: runtimePlan([
          action("NOT-REUSE", { action: "reuse", workspaceId: "workspace-expected" }),
        ]),
        control: control(),
        adapters,
      });

      expect(result.dispatch.settled[0]).toMatchObject({
        status: "fulfilled",
        value: {
          outcome: "preserved",
          action: "reuse",
          workspaceId: "workspace-expected",
        },
      });
      expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(1);
    }
  });

  test("inspects exactly once after an ambiguous mutation and never retries it", async () => {
    const order = [];
    const adapters = baseAdapters({
      inspectExactRuntime: mock(async ({ issueId }) =>
        runtimeInspection(issueId, {
          workspaceIds: ["workspace-created"],
          terminalIds: ["terminal-created"],
          activeTerminalIds: ["terminal-created"],
        }),
      ),
      dispatchIssue: mock(async (input) => dispatchResult(input, { state: "ambiguous" })),
      releaseDispatchLock: mock(async () => {
        order.push("release");
        return { released: true };
      }),
      monitorWorker: mock(async (input) => {
        order.push(`monitor:${input.terminalId}`);
        return {};
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-AMB")]),
      runtimePlan: runtimePlan([action("NOT-AMB")]),
      control: control(),
      adapters,
    });

    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(1);
    expect(result.dispatch.settled[0]).toMatchObject({
      status: "fulfilled",
      value: {
        outcome: "preserved",
        action: "monitor",
        workspaceId: "workspace-created",
        terminalId: "terminal-created",
      },
    });
    expect(result.monitoring.settled[0]).toMatchObject({
      issueId: "NOT-AMB",
      value: { outcome: "monitored" },
    });
    expect(order).toEqual(["release", "monitor:terminal-created"]);
  });

  test("reports workspace-only ambiguous mutation recovery as degraded", async () => {
    const adapters = baseAdapters({
      inspectExactRuntime: mock(async ({ issueId }) =>
        runtimeInspection(issueId, { workspaceIds: ["workspace-created"] }),
      ),
      dispatchIssue: mock(async (input) => dispatchResult(input, { state: "ambiguous" })),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-WORKSPACE-ONLY")]),
      runtimePlan: runtimePlan([action("NOT-WORKSPACE-ONLY")]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("degraded");
    expect(result.dispatch.settled[0]).toMatchObject({
      status: "fulfilled",
      value: {
        outcome: "preserved",
        action: "reuse",
        workspaceId: "workspace-created",
      },
    });
    expect(result.monitoring.settled).toEqual([]);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(1);
  });

  test("discovers a partial workspace and reuses it on the next invocation", async () => {
    const firstDispatch = mock(async (input) =>
      dispatchResult(input, {
        state: "partial",
        workspaceId: "workspace-partial",
        failedPhase: "agent-create",
      }),
    );
    const first = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-PARTIAL")]),
      runtimePlan: runtimePlan([action("NOT-PARTIAL")]),
      control: control(),
      adapters: baseAdapters({ dispatchIssue: firstDispatch }),
    });

    expect(first.status).toBe("degraded");
    expect(firstDispatch).toHaveBeenCalledTimes(1);
    expect(first.dispatch.settled[0]).toMatchObject({
      value: {
        outcome: "partial",
        mutation: {
          state: "partial",
          failedPhase: "agent-create",
        },
      },
    });

    const preservedWorkspaceIds =
      first.dispatch.settled[0].value.mutation.runtimeSnapshot.matches[0].workspaceIds;
    expect(preservedWorkspaceIds).toEqual(["workspace-partial"]);
    const secondFrontier = frontier([row("NOT-PARTIAL")]);
    const secondRuntimePlan = planRuntimeActions(
      secondFrontier,
      runtimeInspection("NOT-PARTIAL", { workspaceIds: preservedWorkspaceIds }),
      {
        control: control(),
        selectedIssueIds: ["NOT-PARTIAL"],
      },
    );
    expect(secondRuntimePlan.actions[0]).toMatchObject({
      action: "reuse",
      workspaceId: "workspace-partial",
    });

    const secondDispatch = mock(async (input) => dispatchResult(input));
    const secondAdapters = baseAdapters({ dispatchIssue: secondDispatch });
    const second = await runOrchestrationEpoch({
      frontierPlan: secondFrontier,
      runtimePlan: secondRuntimePlan,
      control: control(),
      adapters: secondAdapters,
    });

    expect(second.status).toBe("busy");
    expect(secondDispatch).toHaveBeenCalledTimes(1);
    expect(secondDispatch.mock.calls[0][0]).toMatchObject({
      action: "reuse",
      workspaceId: "workspace-partial",
      branchName: "feature/not-partial",
      workspaceName: "workspace-not-partial",
      workerPrompt: "linear-devotee:greet NOT-PARTIAL\nDo the exact scoped work.",
      lockReceipt: {
        directory: LOCK_DIRECTORY,
        projectId: "linear-project",
        token: "lock-token",
        owner: { hostId: "host-1", token: "lock-token" },
      },
    });
  });

  test("monitors an exact active terminal preserved by a partial mutation after release", async () => {
    const order = [];
    const adapters = baseAdapters({
      dispatchIssue: mock(async (input) =>
        dispatchResult(input, {
          state: "partial",
          failedPhase: "execution-record",
          terminalIds: ["terminal-partial-active"],
          activeTerminalIds: ["terminal-partial-active"],
        }),
      ),
      releaseDispatchLock: mock(async () => {
        order.push("release");
        return { released: true };
      }),
      monitorWorker: mock(async (input) => {
        order.push(`monitor:${input.terminalId}`);
        return {};
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-PARTIAL-ACTIVE")]),
      runtimePlan: runtimePlan([action("NOT-PARTIAL-ACTIVE")]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("degraded");
    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "partial", mutation: { state: "partial" } },
    });
    expect(result.monitoring.settled[0]).toMatchObject({
      issueId: "NOT-PARTIAL-ACTIVE",
      value: { outcome: "monitored" },
    });
    expect(order).toEqual(["release", "monitor:terminal-partial-active"]);
  });

  test("inspects once and isolates when an unproven fulfilled mutation has no runtime", async () => {
    const adapters = baseAdapters({ dispatchIssue: mock(async () => undefined) });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-UNPROVEN")]),
      runtimePlan: runtimePlan([action("NOT-UNPROVEN")]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("degraded");
    expect(result.dispatch.settled[0]).toMatchObject({
      status: "fulfilled",
      value: { outcome: "isolated", reason: "MUTATION_AMBIGUOUS" },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(1);
  });

  test("preserves and monitors exact runtime after malformed fulfilled dispatch evidence", async () => {
    const order = [];
    const adapters = baseAdapters({
      inspectExactRuntime: mock(async ({ issueId }) =>
        runtimeInspection(issueId, {
          workspaceIds: ["workspace-after-malformed"],
          terminalIds: ["terminal-after-malformed"],
          activeTerminalIds: ["terminal-after-malformed"],
        }),
      ),
      dispatchIssue: mock(async (input) => {
        const result = dispatchResult(input);
        return {
          ...result,
          lockVerification: {
            ...result.lockVerification,
            verifiedAt: result.lockVerification.expiresAt,
          },
        };
      }),
      releaseDispatchLock: mock(async () => {
        order.push("release");
        return { released: true };
      }),
      monitorWorker: mock(async (input) => {
        order.push(`monitor:${input.terminalId}`);
        return {};
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-EXPIRED")]),
      runtimePlan: runtimePlan([action("NOT-EXPIRED")]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      status: "fulfilled",
      value: {
        outcome: "preserved",
        action: "monitor",
        workspaceId: "workspace-after-malformed",
        terminalId: "terminal-after-malformed",
      },
    });
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(adapters.inspectExactRuntime).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["release", "monitor:terminal-after-malformed"]);
  });

  test("keeps a verified runtime when only its record write failed", async () => {
    const dispatchIssue = mock(async (input) =>
      dispatchResult(input, {
        record: { status: "failed", detail: "Linear comment unavailable" },
      }),
    );
    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-RECORD")]),
      runtimePlan: runtimePlan([action("NOT-RECORD")]),
      control: control(),
      adapters: baseAdapters({ dispatchIssue }),
    });

    expect(result.status).toBe("degraded");
    expect(dispatchIssue).toHaveBeenCalledTimes(1);
    expect(result.dispatch.settled[0]).toMatchObject({
      value: {
        outcome: "dispatched",
        telemetryDegraded: true,
        mutation: { record: { status: "failed" } },
      },
    });
    expect(result.monitoring.settled[0]).toMatchObject({
      issueId: "NOT-RECORD",
      value: { outcome: "monitored" },
    });
  });

  test("monitors only exact active terminals and refreshes targeted Linear state before promotion", async () => {
    const order = [];
    const adapters = baseAdapters({
      monitorWorker: mock(async (input) => {
        order.push(`monitor:${input.terminalId}`);
        return { event: { type: "worker-finished", refreshIssueIds: ["NOT-ROGUE"] } };
      }),
      refreshAfterWorkerEvent: mock(async ({ issueIds }) => {
        order.push(`refresh:${issueIds.join(",")}`);
        return eventRefreshSnapshot(issueIds);
      }),
      promoteAfterRefresh: mock(async ({ issueIds }) => {
        order.push(`promote:${issueIds.join(",")}`);
        return { applied: true };
      }),
      github: mock(async () => undefined),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-ACTIVE", { classification: "started" }),
        row("NOT-CANDIDATE", {
          classification: "blocked",
          blockerIssueIds: ["NOT-ACTIVE"],
        }),
        row("NOT-DEPENDENT", {
          classification: "blocked",
          blockerIssueIds: ["NOT-ACTIVE"],
        }),
        row("NOT-TERMINAL-DEPENDENT", {
          classification: "terminal",
          linearStatusType: "completed",
          blockerIssueIds: ["NOT-ACTIVE"],
        }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-ACTIVE", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-active",
          terminalId: "terminal-active",
        }),
      ]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("busy");
    expect(order).toEqual([
      "monitor:terminal-active",
      "refresh:NOT-ACTIVE,NOT-CANDIDATE,NOT-DEPENDENT",
      "promote:NOT-ACTIVE,NOT-CANDIDATE,NOT-DEPENDENT",
    ]);
    expect(adapters.github).toHaveBeenCalledTimes(0);
    expect(adapters.acquireDispatchLock).toHaveBeenCalledTimes(0);
  });

  test("rejects malformed monitor and promotion adapter envelopes", async () => {
    const monitorAction = action("NOT-MONITOR-SCHEMA", {
      action: "monitor",
      linearClassification: "started",
      workspaceId: "workspace-monitor-schema",
      terminalId: "terminal-monitor-schema",
    });
    const rows = [row("NOT-MONITOR-SCHEMA", { classification: "started" })];
    const malformedMonitorAdapters = baseAdapters({
      monitorWorker: mock(async () => ({ ok: false })),
    });
    const malformedMonitor = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([monitorAction]),
      control: control(),
      adapters: malformedMonitorAdapters,
    });

    expect(malformedMonitor.monitoring.settled[0]).toMatchObject({
      status: "rejected",
      reason: { code: "MONITOR_RESULT_INVALID" },
    });
    expect(malformedMonitorAdapters.refreshAfterWorkerEvent).toHaveBeenCalledTimes(0);

    const rejectedPromotion = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([monitorAction]),
      control: control(),
      adapters: baseAdapters({
        monitorWorker: mock(async () => ({ event: { type: "worker-finished" } })),
        promoteAfterRefresh: mock(async () => ({ applied: false })),
      }),
    });
    expect(rejectedPromotion.monitoring.settled[0]).toMatchObject({
      status: "rejected",
      reason: { code: "PROMOTION_RESULT_INVALID" },
    });
  });

  test("refreshes event candidates first and validates newly discovered live blockers", async () => {
    const calls = [];
    const adapters = baseAdapters({
      monitorWorker: mock(async () => ({ event: { type: "worker-finished" } })),
      refreshAfterWorkerEvent: mock(async (input) => {
        calls.push(input);
        return eventRefreshSnapshot(input.issueIds, { "NOT-B": ["NOT-C"] });
      }),
      promoteAfterRefresh: mock(async (input) => {
        calls.push(input);
        return { applied: true };
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([
        row("NOT-A", { classification: "started" }),
        row("NOT-B", { classification: "blocked", blockerIssueIds: ["NOT-A"] }),
      ]),
      runtimePlan: runtimePlan([
        action("NOT-A", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-a",
          terminalId: "terminal-a",
        }),
      ]),
      control: control(),
      adapters,
    });

    expect(result.monitoring.settled[0]).toMatchObject({
      value: { outcome: "event", issueIds: ["NOT-A", "NOT-B", "NOT-C"] },
    });
    expect(calls[0]).toMatchObject({
      issueIds: ["NOT-A", "NOT-B"],
      refreshMode: "candidate-blockers",
    });
    expect(calls[1].issueIds).toEqual(["NOT-A", "NOT-B", "NOT-C"]);
  });

  test("counts active workers against maxConcurrency", async () => {
    const rows = [row("NOT-ACTIVE", { classification: "started" }), row("NOT-B"), row("NOT-C")];
    const order = [];
    const adapters = baseAdapters({
      releaseDispatchLock: mock(async () => {
        order.push("release");
        return { released: true };
      }),
      monitorWorker: mock(async () => {
        order.push("monitor");
        return {};
      }),
    });
    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([
        action("NOT-ACTIVE", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-active",
          terminalId: "terminal-active",
        }),
        action("NOT-B"),
        action("NOT-C"),
      ]),
      control: control({ maxConcurrency: 2 }),
      adapters,
    });

    expect(result.selectedIssueIds).toEqual(["NOT-B"]);
    expect(result.deferredIssueIds).toEqual(["NOT-C"]);
    expect(adapters.monitorWorker).toHaveBeenCalledTimes(2);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["release", "monitor", "monitor"]);
  });

  test("does not monitor while a dispatch lock release remains unverified", async () => {
    const adapters = baseAdapters({
      releaseDispatchLock: mock(async () => ({ released: false, reason: "TOKEN_MISMATCH" })),
    });
    const rows = [row("NOT-ACTIVE", { classification: "started" }), row("NOT-DISPATCH")];

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([
        action("NOT-ACTIVE", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-active",
          terminalId: "terminal-active",
        }),
        action("NOT-DISPATCH"),
      ]),
      control: control(),
      adapters,
    });

    expect(result.status).toBe("degraded");
    expect(result.dispatch.lock.releaseError).toMatchObject({ code: "TOKEN_MISMATCH" });
    expect(result.monitoring.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "LOCK_RELEASE_FAILED" },
    });
    expect(adapters.monitorWorker).toHaveBeenCalledTimes(0);
  });

  test("preserves release failure when a provider also failed under the lock", async () => {
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async () => {
        throw Object.assign(new Error("Linear unavailable"), { code: "LINEAR_UNAVAILABLE" });
      }),
      releaseDispatchLock: mock(async () => ({ released: false, reason: "TOKEN_MISMATCH" })),
    });
    const rows = [row("NOT-ACTIVE", { classification: "started" }), row("NOT-DISPATCH")];

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([
        action("NOT-ACTIVE", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-active",
          terminalId: "terminal-active",
        }),
        action("NOT-DISPATCH"),
      ]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.lock.releaseError).toMatchObject({ code: "TOKEN_MISMATCH" });
    expect(result.dispatch.settled[0]).toMatchObject({
      status: "rejected",
      reason: { code: "LINEAR_UNAVAILABLE" },
    });
    expect(result.monitoring.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "LOCK_RELEASE_FAILED" },
    });
    expect(adapters.monitorWorker).toHaveBeenCalledTimes(0);
  });

  test("a held lock refuses force locally while active monitoring continues", async () => {
    const adapters = baseAdapters({
      acquireDispatchLock: mock(async () => ({ acquired: false, reason: "LOCK_HELD" })),
    });
    const rows = [
      row("NOT-ACTIVE", { classification: "started" }),
      row("NOT-FORCE", { forced: true }),
    ];

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier(rows),
      runtimePlan: runtimePlan([
        action("NOT-ACTIVE", {
          action: "monitor",
          linearClassification: "started",
          workspaceId: "workspace-active",
          terminalId: "terminal-active",
        }),
        action("NOT-FORCE", {
          forced: true,
          forceAuthorized: true,
          confirmationAccepted: true,
          forceInvocationId: "invocation-force",
          forceBypassedBlockerIssueIds: [],
          forceBypassedUncertainties: [],
        }),
      ]),
      control: control(),
      invocationId: "invocation-force",
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "refused", reason: "LOCK_HELD" },
    });
    expect(adapters.monitorWorker).toHaveBeenCalledTimes(1);
    expect(adapters.refreshCandidateAndBlockers).toHaveBeenCalledTimes(0);
  });

  test("uses the validated batch control without reloading it under lock", async () => {
    const order = [];
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) => {
        order.push("refresh");
        return freshSnapshot(issueId);
      }),
      dispatchIssue: mock(async (input) => {
        order.push("dispatch");
        return dispatchResult(input);
      }),
      releaseDispatchLock: mock(async () => {
        order.push("release");
        return { released: true };
      }),
    });

    const result = await runOrchestrationEpoch({
      frontierPlan: frontier([row("NOT-STOP-RACE")]),
      runtimePlan: runtimePlan([action("NOT-STOP-RACE")]),
      control: control(),
      adapters,
    });

    expect(result.dispatch.settled[0]).toMatchObject({
      value: { outcome: "dispatched", action: "create" },
    });
    expect(order).toEqual(["refresh", "dispatch", "release"]);
    expect(adapters.refreshCandidateAndBlockers).toHaveBeenCalledTimes(1);
    expect(adapters.dispatchIssue).toHaveBeenCalledTimes(1);
  });

  test("batches required provider effects and preserves the held lock between transcripts", async () => {
    const effect = (issueId) =>
      new OrchestrationEffectRequired({
        effectId: `refresh:${issueId}`,
        adapter: "refreshCandidateAndBlockers",
        input: { issueId },
      });
    const adapters = baseAdapters({
      refreshCandidateAndBlockers: mock(async ({ issueId }) => {
        throw effect(issueId);
      }),
    });

    try {
      await runOrchestrationEpoch({
        frontierPlan: frontier([row("NOT-A"), row("NOT-B")]),
        runtimePlan: runtimePlan([action("NOT-A"), action("NOT-B")]),
        control: control(),
        adapters,
      });
      throw new Error("expected effects");
    } catch (error) {
      expect(error.code).toBe("ORCHESTRATION_EFFECTS_REQUIRED");
      expect(error.effects.map((item) => item.effectId)).toEqual([
        "refresh:NOT-A",
        "refresh:NOT-B",
      ]);
    }
    expect(adapters.acquireDispatchLock).toHaveBeenCalledTimes(1);
    expect(adapters.releaseDispatchLock).toHaveBeenCalledTimes(0);
  });
});
