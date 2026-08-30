import { describe, expect, test } from "bun:test";
import path from "node:path";

import { resolveReconciliation } from "../lib/reconciliation-state.mjs";
import { buildControlRecord } from "../lib/records.mjs";

function issue(id, order, overrides = {}) {
  return {
    id,
    identifier: `PROJ-${order}`,
    taskId: id,
    projectId: "project-1",
    order,
    statusType: "unstarted",
    blockers: [],
    dataState: "known",
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    schemaVersion: 1,
    control: {
      schemaVersion: 1,
      projectId: "project-1",
      runId: "run-1",
      active: true,
      maxConcurrency: 4,
      targetHostId: "host-1",
      supersetProjectId: "superset-project-1",
    },
    providers: { linear: "ready", github: "ready", superset: "ready" },
    issues: [],
    waivers: [],
    workspaces: [],
    executionRecords: [],
    baseline: { issueIds: [], edges: [] },
    confirmedRunnableExpansions: [],
    ...overrides,
  };
}

function ids(entries) {
  return entries.map((entry) => entry.issueId);
}

describe("capacity and deterministic dispatch", () => {
  test("fills remaining slots in Linear order without duplicating an existing taskId", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("issue-c", 3), issue("issue-a", 1), issue("issue-b", 2)],
        baseline: { issueIds: ["issue-a", "issue-b", "issue-c"], edges: [] },
        workspaces: [
          {
            id: "workspace-a",
            taskId: "issue-a",
            hostId: "host-1",
            terminals: [{ id: "terminal-a" }],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "issue-a",
            workspaceId: "workspace-a",
            terminalId: "terminal-a",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.availableSlots).toBe(3);
    expect(ids(decision.active)).toEqual(["issue-a"]);
    expect(ids(decision.dispatch)).toEqual(["issue-b", "issue-c"]);
  });

  test("reports a successful no-op when capacity is exhausted", () => {
    const workspaces = [1, 2, 3, 4].map((number) => ({
      id: `workspace-${number}`,
      taskId: `active-${number}`,
      hostId: "host-1",
      terminals: [{ id: `terminal-${number}` }],
      claimed: true,
    }));
    const decision = resolveReconciliation(
      input({
        issues: [issue("candidate", 5)],
        baseline: {
          issueIds: ["active-1", "active-2", "active-3", "active-4", "candidate"],
          edges: [],
        },
        taskBindings: [1, 2, 3, 4].map((number) => ({
          issueId: `active-${number}`,
          taskId: `active-${number}`,
        })),
        workspaces,
      }),
    );

    expect(decision.status).toBe("noop");
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
    expect(decision.active).toHaveLength(4);
  });

  test("correlates a Linear identifier through its distinct Superset task id", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("OPS-7", 1, { identifier: "OPS-7", taskId: "task-ops-7" }),
          issue("ENG-42", 2, { identifier: "ENG-42", taskId: "task-eng-42" }),
        ],
        baseline: { issueIds: ["OPS-7", "ENG-42"], edges: [] },
        workspaces: [
          {
            id: "workspace-547",
            taskId: "task-ops-7",
            hostId: "host-1",
            terminals: [{ id: "terminal-547" }],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "OPS-7",
            taskId: "task-ops-7",
            workspaceId: "workspace-547",
            terminalId: "terminal-547",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.active).toEqual([
      {
        issueId: "OPS-7",
        taskId: "task-ops-7",
        workspaceId: "workspace-547",
        terminalId: "terminal-547",
        managed: true,
      },
    ]);
    expect(decision.dispatch).toMatchObject([{ issueId: "ENG-42", taskId: "task-eng-42" }]);
  });

  test("does not dispatch an issue whose Superset task binding is unknown", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("OPS-7", 1, { identifier: "OPS-7", taskId: undefined })],
        baseline: { issueIds: ["OPS-7"], edges: [] },
      }),
    );

    expect(decision.dispatch).toEqual([]);
    expect(decision.inspect).toEqual([
      { issueId: "OPS-7", resourceIds: [], reason: "TASK_BINDING_UNKNOWN" },
    ]);
  });

  test("quarantines a duplicate task binding while independent work remains dispatchable", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("OPS-7", 1, { taskId: "task-shared" }),
          issue("ENG-42", 2, { taskId: "task-shared" }),
          issue("WEB-3", 3, { taskId: "task-web-3" }),
        ],
        baseline: { issueIds: ["OPS-7", "ENG-42", "WEB-3"], edges: [] },
        workspaces: [
          {
            id: "workspace-shared",
            taskId: "task-shared",
            hostId: "host-1",
            terminals: [{ id: "terminal-shared" }],
          },
        ],
      }),
    );

    expect(ids(decision.inspect)).toEqual(["ENG-42", "OPS-7"]);
    expect(decision.active).toHaveLength(1);
    expect(decision.availableSlots).toBe(3);
    expect(decision.dispatch).toMatchObject([{ issueId: "WEB-3", taskId: "task-web-3" }]);
  });
});

describe("blockers and waivers", () => {
  test("only Linear completion or the exact valid waiver satisfies a blocker", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("completed", 1, { statusType: "completed" }),
          issue("canceled", 2, { statusType: "canceled" }),
          issue("open", 3, { statusType: "started" }),
          issue("after-completed", 4, { blockers: ["completed"] }),
          issue("after-canceled", 5, { blockers: ["canceled"] }),
          issue("after-waiver", 6, { blockers: ["canceled"] }),
          issue("after-github", 7, { blockers: ["open"] }),
        ],
        waivers: [
          {
            dependentIssueId: "after-waiver",
            blockerIssueId: "canceled",
            valid: true,
            humanApproved: true,
          },
        ],
        githubPullRequests: [{ issueId: "open", state: "merged" }],
        baseline: {
          issueIds: [
            "completed",
            "canceled",
            "open",
            "after-completed",
            "after-canceled",
            "after-waiver",
            "after-github",
          ],
          edges: [
            { dependentIssueId: "after-completed", blockerIssueId: "completed" },
            { dependentIssueId: "after-canceled", blockerIssueId: "canceled" },
            { dependentIssueId: "after-waiver", blockerIssueId: "canceled" },
            { dependentIssueId: "after-github", blockerIssueId: "open" },
          ],
        },
      }),
    );

    expect(ids(decision.dispatch)).toEqual(["after-completed", "after-waiver"]);
    expect(ids(decision.blocked)).toEqual(["after-canceled", "after-github"]);
  });

  test("a waiver satisfies only its named relation", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("canceled", 1, { statusType: "canceled" }),
          issue("one", 2, { blockers: ["canceled"] }),
          issue("two", 3, { blockers: ["canceled"] }),
        ],
        waivers: [
          {
            dependentIssueId: "one",
            blockerIssueId: "canceled",
            valid: true,
            humanApproved: true,
          },
        ],
        baseline: {
          issueIds: ["canceled", "one", "two"],
          edges: [
            { dependentIssueId: "one", blockerIssueId: "canceled" },
            { dependentIssueId: "two", blockerIssueId: "canceled" },
          ],
        },
      }),
    );
    expect(ids(decision.dispatch)).toEqual(["one"]);
    expect(ids(decision.blocked)).toEqual(["two"]);
  });
});

describe("Linear evolution", () => {
  test("adopts fresh issue metadata and ordering without graph approval", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("issue-a", 20, {
            title: "Renamed in Linear",
            priority: 1,
            assigneeId: "user-new",
          }),
          issue("issue-b", 10, {
            title: "Also renamed",
            priority: 4,
            assigneeId: null,
          }),
        ],
        baseline: { issueIds: ["issue-a", "issue-b"], edges: [] },
      }),
    );

    expect(ids(decision.dispatch)).toEqual(["issue-b", "issue-a"]);
    expect(decision.confirmations).toEqual([]);
  });

  test("adopts a constraining dependency but gates a runnable expansion", () => {
    const constrained = resolveReconciliation(
      input({
        issues: [
          issue("blocker", 1, { statusType: "started" }),
          issue("dependent", 2, { blockers: ["blocker"] }),
        ],
        baseline: { issueIds: ["blocker", "dependent"], edges: [] },
      }),
    );
    expect(constrained.confirmations).toEqual([]);
    expect(ids(constrained.blocked)).toEqual(["dependent"]);

    const expandedInput = input({
      issues: [issue("blocker", 1, { statusType: "started" }), issue("dependent", 2)],
      baseline: {
        issueIds: ["blocker", "dependent"],
        edges: [{ dependentIssueId: "dependent", blockerIssueId: "blocker" }],
      },
    });
    const expanded = resolveReconciliation(expandedInput);
    expect(ids(expanded.dispatch)).toEqual([]);
    expect(ids(expanded.confirmations)).toEqual(["dependent"]);

    const confirmed = resolveReconciliation({
      ...expandedInput,
      confirmedRunnableExpansions: ["dependent"],
    });
    expect(ids(confirmed.dispatch)).toEqual(["dependent"]);
  });

  test("removes a stale completed dependency without gating an already-ready successor", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("completed-a", 1, { statusType: "completed" }),
          issue("completed-b", 2, { statusType: "completed" }),
          issue("successor", 3, { blockers: ["completed-a", "completed-b"] }),
        ],
        baseline: {
          issueIds: ["completed-a", "completed-b", "successor"],
          edges: [
            { dependentIssueId: "completed-b", blockerIssueId: "completed-a" },
            { dependentIssueId: "successor", blockerIssueId: "completed-a" },
            { dependentIssueId: "successor", blockerIssueId: "completed-b" },
          ],
        },
      }),
    );

    expect(decision.confirmations).toEqual([]);
    expect(ids(decision.dispatch)).toEqual(["successor"]);
    expect(decision.nextBaseline.edges).toEqual([
      { dependentIssueId: "successor", blockerIssueId: "completed-a" },
      { dependentIssueId: "successor", blockerIssueId: "completed-b" },
    ]);
  });

  test("requires confirmation for a newly added startable issue", () => {
    const fresh = resolveReconciliation(
      input({ issues: [issue("new-issue", 1)], baseline: { issueIds: [], edges: [] } }),
    );
    expect(ids(fresh.confirmations)).toEqual(["new-issue"]);
    expect(fresh.dispatch).toEqual([]);
  });

  test("quarantines an invalid component and descendants while independent work continues", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("cycle-a", 1, { blockers: ["cycle-b"] }),
          issue("cycle-b", 2, { blockers: ["cycle-a"] }),
          issue("descendant", 3, { blockers: ["cycle-b"] }),
          issue("independent", 4),
        ],
        baseline: {
          issueIds: ["cycle-a", "cycle-b", "descendant", "independent"],
          edges: [],
        },
      }),
    );
    expect(ids(decision.quarantined)).toEqual(["cycle-a", "cycle-b", "descendant"]);
    expect(ids(decision.dispatch)).toEqual(["independent"]);
    expect(decision.nextBaseline).toEqual({
      issueIds: ["cycle-a", "cycle-b", "descendant", "independent"],
      edges: [],
    });
    expect(() =>
      buildControlRecord({
        projectId: "project-1",
        runId: "run-1",
        active: true,
        repository: "org/repo",
        supersetProjectId: "superset-project",
        targetHostId: "host-1",
        defaultAgent: "codex",
        decisionBaseline: decision.nextBaseline,
        graphHash: `sha256:${"a".repeat(64)}`,
        updatedAt: "2026-08-27T10:00:00.000Z",
      }),
    ).not.toThrow();
  });

  test("quarantines every invalid component without suppressing separate valid work", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("cycle-a1", 1, { blockers: ["cycle-a2"] }),
          issue("cycle-a2", 2, { blockers: ["cycle-a1"] }),
          issue("cycle-b1", 3, { blockers: ["cycle-b2"] }),
          issue("cycle-b2", 4, { blockers: ["cycle-b1"] }),
          issue("descendant-b", 5, { blockers: ["cycle-b2"] }),
          issue("independent", 6),
        ],
        baseline: {
          issueIds: ["cycle-a1", "cycle-a2", "cycle-b1", "cycle-b2", "descendant-b", "independent"],
          edges: [],
        },
      }),
    );

    expect(ids(decision.quarantined)).toEqual([
      "cycle-a1",
      "cycle-a2",
      "cycle-b1",
      "cycle-b2",
      "descendant-b",
    ]);
    expect(ids(decision.dispatch)).toEqual(["independent"]);
  });

  test("blocks only decisions with unknown normalized Linear data", () => {
    const decision = resolveReconciliation(
      input({
        issues: [
          issue("unknown", 1, { statusType: "mystery", dataState: "unknown" }),
          issue("dependent", 2, { blockers: ["unknown"] }),
          issue("independent", 3),
        ],
        baseline: {
          issueIds: ["unknown", "dependent", "independent"],
          edges: [{ dependentIssueId: "dependent", blockerIssueId: "unknown" }],
        },
      }),
    );
    expect(ids(decision.dispatch)).toEqual(["independent"]);
    expect(ids(decision.blocked)).toEqual(["unknown", "dependent"]);
  });

  test("a scoped partial Linear response blocks only affected decisions", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "partial", github: "ready", superset: "ready" },
        issues: [
          issue("unknown", 1),
          issue("dependent", 2, { blockers: ["unknown"] }),
          issue("independent", 3),
        ],
        linearUnknown: [
          { code: "STATUS_FIELD_CHANGED", issueId: "unknown", requiredForDecision: true },
        ],
        baseline: {
          issueIds: ["unknown", "dependent", "independent"],
          edges: [{ dependentIssueId: "dependent", blockerIssueId: "unknown" }],
        },
      }),
    );

    expect(decision.globalReasons).toEqual([]);
    expect(ids(decision.dispatch)).toEqual(["independent"]);
    expect(ids(decision.blocked)).toEqual(["unknown", "dependent"]);
  });

  test("retains previous blocker edges when a scoped partial read omits them", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "partial", github: "ready", superset: "ready" },
        issues: [
          issue("dependent", 1, { blockers: [], dataState: "unknown" }),
          issue("blocker", 2, { statusType: "started" }),
          issue("independent", 3),
        ],
        linearUnknown: [
          {
            code: "BLOCKER_FIELD_MISSING",
            issueId: "dependent",
            field: "blockers",
            requiredForDecision: true,
          },
        ],
        baseline: {
          issueIds: ["dependent", "blocker", "independent"],
          edges: [{ dependentIssueId: "dependent", blockerIssueId: "blocker" }],
        },
      }),
    );

    expect(ids(decision.dispatch)).toEqual(["independent"]);
    expect(decision.nextBaseline.edges).toEqual([
      { dependentIssueId: "dependent", blockerIssueId: "blocker" },
    ]);
  });

  test("allows a partial response whose unknown fields are explicitly optional", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "partial", github: "ready", superset: "ready" },
        issues: [issue("candidate", 1)],
        linearUnknown: [
          { code: "OPTIONAL_METADATA_MISSING", field: "estimate", requiredForDecision: false },
        ],
        baseline: { issueIds: ["candidate"], edges: [] },
      }),
    );

    expect(decision.globalReasons).toEqual([]);
    expect(ids(decision.dispatch)).toEqual(["candidate"]);
  });

  test("an unscoped partial Linear response stops all new dispatch", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "partial", github: "ready", superset: "ready" },
        issues: [issue("candidate", 1)],
        baseline: { issueIds: ["candidate"], edges: [] },
      }),
    );

    expect(decision.dispatch).toEqual([]);
    expect(decision.globalReasons).toEqual(["LINEAR_PARTIAL_UNSCOPED"]);
  });
});

describe("runtime reconstruction", () => {
  test("keeps a changed task binding guarded without double-counting its live runtime", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("OPS-7", 1, { taskId: "task-current" })],
        baseline: { issueIds: ["OPS-7"], edges: [] },
        workspaces: [
          {
            id: "workspace-old",
            taskId: "task-recorded",
            hostId: "host-1",
            terminals: [{ id: "terminal-old" }],
          },
        ],
        executionRecords: [
          {
            issueId: "OPS-7",
            taskId: "task-recorded",
            runId: "run-1",
            workspaceId: "workspace-old",
            terminalId: "terminal-old",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.dispatch).toEqual([]);
    expect(decision.active).toHaveLength(1);
    expect(decision.active[0]).toMatchObject({ issueId: "OPS-7", taskId: "task-recorded" });
    expect(decision.inspect).toEqual([
      {
        issueId: "OPS-7",
        resourceIds: ["task-current", "task-recorded"],
        reason: "TASK_BINDING_MISMATCH",
      },
    ]);
  });

  test("repairs one exact runtime match instead of redispatching", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        workspaces: [
          {
            id: "workspace-1",
            taskId: "issue-1",
            hostId: "host-1",
            terminals: [{ id: "terminal-1" }],
            claimed: true,
          },
        ],
      }),
    );
    expect(decision.dispatch).toEqual([]);
    expect(decision.repair).toEqual([
      {
        issueId: "issue-1",
        taskId: "issue-1",
        workspaceId: "workspace-1",
        terminalId: "terminal-1",
      },
    ]);
  });

  test("uses a recorded agent terminal even when the workspace has extra terminals", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        workspaces: [
          {
            id: "workspace-1",
            taskId: "issue-1",
            hostId: "host-1",
            terminals: [
              { id: "terminal-agent", exited: false },
              { id: "terminal-dev-server", exited: false },
            ],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "issue-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            terminalId: "terminal-agent",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.inspect).toEqual([]);
    expect(decision.active).toEqual([
      {
        issueId: "issue-1",
        taskId: "issue-1",
        workspaceId: "workspace-1",
        terminalId: "terminal-agent",
        managed: true,
      },
    ]);
  });

  test("adopts an exact earlier-run terminal into the active run without ambiguity", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          runId: "run-2",
          executionIssueIds: ["issue-1"],
        },
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        workspaces: [
          {
            id: "workspace-1",
            taskId: "issue-1",
            hostId: "host-1",
            terminals: [
              { id: "terminal-agent", exited: false },
              { id: "terminal-dev-server", exited: false },
            ],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "issue-1",
            runId: "run-1",
            workspaceId: "workspace-1",
            terminalId: "terminal-agent",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.inspect).toEqual([]);
    expect(decision.repair).toEqual([
      {
        issueId: "issue-1",
        taskId: "issue-1",
        workspaceId: "workspace-1",
        terminalId: "terminal-agent",
      },
    ]);
    expect(decision.active[0].terminalId).toBe("terminal-agent");
  });

  test("counts only owned live task executions, not main, foreign, or exited workspaces", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("done", 1, { statusType: "completed" }), issue("candidate", 2)],
        baseline: { issueIds: ["done", "candidate"], edges: [] },
        workspaces: [
          { id: "main", taskId: null, terminals: [{ id: "shell", exited: false }] },
          {
            id: "foreign",
            taskId: "other-project-issue",
            terminals: [{ id: "foreign-agent", exited: false }],
          },
          {
            id: "workspace-done",
            taskId: "done",
            hostId: "host-1",
            terminals: [{ id: "terminal-done", exited: true }],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "done",
            runId: "run-1",
            workspaceId: "workspace-done",
            terminalId: "terminal-done",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.active).toEqual([]);
    expect(decision.confirmedExitedIssueIds).toEqual(["done"]);
    expect(decision.availableSlots).toBe(4);
    expect(ids(decision.dispatch)).toEqual(["candidate"]);
  });

  test("a completed issue releases capacity while its live runtime is reported as residual", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaces: [
          {
            id: "workspace-done",
            taskId: "done",
            hostId: "host-1",
            projectId: "superset-project-1",
            terminals: [{ id: "terminal-done", exited: false }],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-done",
            terminalId: "terminal-done",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.active).toEqual([]);
    expect(decision.residual).toEqual([
      {
        issueId: "done",
        taskId: "done",
        workspaceId: "workspace-done",
        terminalId: "terminal-done",
        statusType: "completed",
        reason: "TERMINAL_ISSUE_RUNTIME_LIVE",
      },
    ]);
    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.availableSlots).toBe(1);
    expect(ids(decision.dispatch)).toEqual(["next"]);
  });

  test("a completed issue keeps consuming capacity when its durable runtime record mismatches", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaces: [
          {
            id: "workspace-current",
            taskId: "done",
            hostId: "host-1",
            projectId: "superset-project-1",
            terminals: [{ id: "terminal-current", exited: false }],
            claimed: true,
          },
        ],
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-missing",
            terminalId: "terminal-missing",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.residual).toEqual([]);
    expect(decision.active).toMatchObject([
      {
        issueId: "done",
        workspaceId: "workspace-current",
        terminalId: "terminal-current",
      },
    ]);
    expect(decision.inspect).toEqual([
      {
        issueId: "done",
        resourceIds: [
          "terminal-current",
          "terminal-missing",
          "workspace-current",
          "workspace-missing",
        ],
        reason: "RECORD_MISMATCH",
      },
    ]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("blocks ambiguous taskId matches and lists every resource", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        workspaces: [
          { id: "workspace-a", taskId: "issue-1", hostId: "host-1", terminals: [] },
          { id: "workspace-b", taskId: "issue-1", hostId: "host-1", terminals: [] },
        ],
      }),
    );
    expect(decision.dispatch).toEqual([]);
    expect(decision.inspect).toEqual([
      {
        issueId: "issue-1",
        resourceIds: ["workspace-a", "workspace-b"],
        reason: "AMBIGUOUS_TASK_ID",
      },
    ]);
  });

  test("preserves partial and unclaimed workspaces without relaunch", () => {
    const partial = resolveReconciliation(
      input({
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        workspaces: [{ id: "workspace-1", taskId: "issue-1", hostId: "host-1", terminals: [] }],
      }),
    );
    expect(partial.dispatch).toEqual([]);
    expect(partial.inspect[0].reason).toBe("PARTIAL_WORKSPACE");

    const unclaimed = resolveReconciliation(
      input({
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        workspaces: [
          {
            id: "workspace-1",
            taskId: "issue-1",
            hostId: "host-1",
            terminals: [{ id: "terminal-1" }],
            claimed: false,
          },
        ],
      }),
    );
    expect(unclaimed.dispatch).toEqual([]);
    expect(unclaimed.inspect[0].reason).toBe("ISSUE_UNCLAIMED");
  });

  test("inspects a durable execution record whose runtime disappeared", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("issue-1", 1)],
        baseline: { issueIds: ["issue-1"], edges: [] },
        executionRecords: [
          {
            issueId: "issue-1",
            workspaceId: "workspace-missing",
            terminalId: "terminal-missing",
            outcome: "verified",
          },
        ],
      }),
    );
    expect(decision.dispatch).toEqual([]);
    expect(decision.inspect[0].reason).toBe("RUNTIME_MISSING");
    expect(decision.active[0]).toMatchObject({
      issueId: "issue-1",
      runtimeMissing: true,
      managed: true,
    });
    expect(decision.availableSlots).toBe(3);
  });

  test("a deleted workspace releases capacity after its managed issue completes", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaceInventory: {
          complete: true,
          hostId: "host-1",
          projectId: "superset-project-1",
          workspaceIds: [],
        },
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-deleted",
            terminalId: "terminal-deleted",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.active).toEqual([]);
    expect(decision.inspect).toEqual([]);
    expect(decision.confirmedExitedIssueIds).toEqual(["done"]);
    expect(decision.availableSlots).toBe(1);
    expect(ids(decision.dispatch)).toEqual(["next"]);
  });

  test("a deleted workspace stays guarded when Superset is not fully authoritative", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        providers: { linear: "ready", github: "ready", superset: "partial" },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaceInventory: {
          complete: true,
          hostId: "host-1",
          projectId: "superset-project-1",
          workspaceIds: [],
        },
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-unknown",
            terminalId: "terminal-unknown",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
        runtimeUnknown: [
          {
            code: "WORKSPACE_LIST_PARTIAL",
            issueId: "done",
            requiredForDecision: true,
          },
        ],
      }),
    );

    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.active).toMatchObject([{ issueId: "done", runtimeMissing: true }]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("a terminal issue stays guarded without a same-scope workspace inventory", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaces: undefined,
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-unobserved",
            terminalId: "terminal-unobserved",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.active).toMatchObject([{ issueId: "done", runtimeMissing: true }]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("a recorded workspace observed under another task stays guarded", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaceInventory: {
          complete: true,
          hostId: "host-1",
          projectId: "superset-project-1",
          workspaceIds: ["workspace-recorded"],
        },
        workspaces: [
          {
            id: "workspace-recorded",
            taskId: "foreign-task",
            hostId: "host-1",
            projectId: "superset-project-1",
            terminals: [{ id: "terminal-live", exited: false }],
          },
        ],
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-recorded",
            terminalId: "terminal-recorded",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.active).toMatchObject([{ issueId: "done", runtimeMissing: true }]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("a filtered workspace array cannot prove a recorded workspace was deleted", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaceInventory: {
          complete: true,
          hostId: "host-1",
          projectId: "superset-project-1",
          workspaceIds: ["workspace-filtered"],
        },
        workspaces: [],
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-filtered",
            terminalId: "terminal-filtered",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.active).toMatchObject([{ issueId: "done", runtimeMissing: true }]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("a workspace inventory for another host or project cannot prove deletion", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaceInventory: {
          complete: true,
          hostId: "host-2",
          projectId: "superset-project-2",
          workspaceIds: [],
        },
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-other-scope",
            terminalId: "terminal-other-scope",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.active).toMatchObject([{ issueId: "done", runtimeMissing: true }]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("a terminal execution from an earlier run stays guarded after restart", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          runId: "run-2",
          maxConcurrency: 1,
          executionIssueIds: ["done"],
        },
        issues: [
          issue("done", 1, { statusType: "completed" }),
          issue("next", 2, { blockers: ["done"] }),
        ],
        baseline: {
          issueIds: ["done", "next"],
          edges: [{ dependentIssueId: "next", blockerIssueId: "done" }],
        },
        workspaceInventory: {
          complete: true,
          hostId: "host-1",
          projectId: "superset-project-1",
          workspaceIds: [],
        },
        executionRecords: [
          {
            issueId: "done",
            taskId: "done",
            runId: "run-1",
            workspaceId: "workspace-previous-run",
            terminalId: "terminal-previous-run",
            hostId: "host-1",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.confirmedExitedIssueIds).toEqual([]);
    expect(decision.active).toMatchObject([{ issueId: "done", runtimeMissing: true }]);
    expect(decision.availableSlots).toBe(0);
    expect(decision.dispatch).toEqual([]);
  });

  test("a previous-run missing execution consumes capacity after restart", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          runId: "run-2",
          maxConcurrency: 1,
          executionIssueIds: ["previous"],
        },
        issues: [issue("previous", 1), issue("independent", 2)],
        baseline: { issueIds: ["previous", "independent"], edges: [] },
        executionRecords: [
          {
            issueId: "previous",
            runId: "run-1",
            workspaceId: "workspace-missing",
            terminalId: "terminal-missing",
            outcome: "verified",
          },
        ],
      }),
    );

    expect(decision.availableSlots).toBe(0);
    expect(ids(decision.active)).toEqual(["previous"]);
    expect(decision.dispatch).toEqual([]);
  });

  test("an explicit control tombstone records that an earlier terminal already exited", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          runId: "run-2",
          maxConcurrency: 1,
          executionIssueIds: [],
          exitedExecutionIssueIds: ["candidate"],
        },
        issues: [issue("candidate", 1)],
        baseline: { issueIds: ["candidate"], edges: [] },
        executionRecords: [
          {
            issueId: "candidate",
            runId: "run-1",
            workspaceId: "workspace-old",
            terminalId: "terminal-old",
            outcome: "verified",
            recordedAt: "2026-08-27T10:00:00.000Z",
          },
        ],
      }),
    );

    expect(decision.active).toEqual([]);
    expect(decision.availableSlots).toBe(1);
    expect(ids(decision.dispatch)).toEqual(["candidate"]);
  });

  test("a missing moved execution remains capacity-consuming and unmanaged", () => {
    const decision = resolveReconciliation(
      input({
        control: {
          ...input().control,
          maxConcurrency: 1,
          executionIssueIds: ["moved"],
        },
        issues: [issue("candidate", 1)],
        baseline: { issueIds: ["candidate"], edges: [] },
      }),
    );

    expect(decision.availableSlots).toBe(0);
    expect(decision.active).toEqual([
      {
        issueId: "moved",
        workspaceId: "missing:moved",
        managed: false,
        runtimeMissing: true,
      },
    ]);
    expect(decision.dispatch).toEqual([]);
  });

  test("keeps a moved issue's execution active but unmanaged", () => {
    const decision = resolveReconciliation(
      input({
        issues: [issue("managed", 1)],
        control: {
          ...input().control,
          executionIssueIds: ["moved"],
        },
        baseline: { issueIds: ["managed"], edges: [] },
        workspaces: [
          {
            id: "workspace-moved",
            taskId: "moved",
            hostId: "host-1",
            terminals: [{ id: "terminal-moved" }],
            claimed: true,
          },
        ],
      }),
    );
    expect(decision.active[0]).toMatchObject({ issueId: "moved", managed: false });
    expect(ids(decision.confirmations)).toEqual([]);
  });
});

describe("Superset partial observations", () => {
  test("blocks only an issue whose required task binding is unknown", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "ready", github: "ready", superset: "partial" },
        issues: [
          issue("OPS-7", 1, { taskId: undefined }),
          issue("ENG-42", 2, { taskId: "task-eng-42" }),
        ],
        baseline: { issueIds: ["OPS-7", "ENG-42"], edges: [] },
        runtimeUnknown: [
          {
            code: "TASK_BINDING_UNAVAILABLE",
            issueId: "OPS-7",
            requiredForDecision: true,
          },
        ],
      }),
    );

    expect(decision.globalReasons).toEqual([]);
    expect(decision.dispatch).toMatchObject([{ issueId: "ENG-42", taskId: "task-eng-42" }]);
  });

  test("allows a partial response whose runtime unknown is optional", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "ready", github: "ready", superset: "partial" },
        issues: [issue("ENG-42", 1, { taskId: "task-eng-42" })],
        baseline: { issueIds: ["ENG-42"], edges: [] },
        runtimeUnknown: [{ code: "TASK_LABEL_UNKNOWN", requiredForDecision: false }],
      }),
    );

    expect(ids(decision.dispatch)).toEqual(["ENG-42"]);
  });

  test("stops dispatch for an unscoped required runtime unknown", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "ready", github: "ready", superset: "partial" },
        issues: [issue("ENG-42", 1, { taskId: "task-eng-42" })],
        baseline: { issueIds: ["ENG-42"], edges: [] },
        runtimeUnknown: [{ code: "WORKSPACE_LIST_PARTIAL", requiredForDecision: true }],
      }),
    );

    expect(decision.dispatch).toEqual([]);
    expect(decision.globalReasons).toEqual(["SUPERSET_REQUIRED_DATA_UNKNOWN"]);
  });
});

describe("safe global stops", () => {
  test("provider unavailability prevents dispatch but preserves active work", () => {
    const decision = resolveReconciliation(
      input({
        providers: { linear: "unavailable", github: "ready", superset: "ready" },
        issues: [issue("candidate", 1)],
        baseline: { issueIds: ["active", "candidate"], edges: [] },
        taskBindings: [{ issueId: "active", taskId: "active" }],
        workspaces: [
          {
            id: "workspace-active",
            taskId: "active",
            hostId: "host-1",
            terminals: [{ id: "terminal-active" }],
            claimed: true,
          },
        ],
      }),
    );
    expect(decision.status).toBe("blocked");
    expect(decision.dispatch).toEqual([]);
    expect(decision.active).toHaveLength(1);
  });

  test("an inactive control emits no dispatch and does not terminate work", () => {
    const base = input({
      issues: [issue("candidate", 1)],
      baseline: { issueIds: ["active", "candidate"], edges: [] },
      taskBindings: [{ issueId: "active", taskId: "active" }],
      workspaces: [
        {
          id: "workspace-active",
          taskId: "active",
          hostId: "host-1",
          terminals: [{ id: "terminal-active" }],
          claimed: true,
        },
      ],
    });
    const decision = resolveReconciliation({
      ...base,
      control: { ...base.control, active: false },
    });
    expect(decision.status).toBe("noop");
    expect(decision.dispatch).toEqual([]);
    expect(decision.active).toHaveLength(1);
  });
});

test("the resolver CLI emits the same structured decision", () => {
  const script = path.resolve(import.meta.dir, "..", "scripts", "reconcile-state.mjs");
  const payload = input({
    issues: [issue("candidate", 1)],
    baseline: { issueIds: ["candidate"], edges: [] },
    confirmedRunnableExpansions: ["candidate"],
  });
  const result = Bun.spawnSync({
    cmd: [process.execPath, script],
    stdin: new Blob([JSON.stringify(payload)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(0);
  expect(ids(JSON.parse(result.stdout.toString()).dispatch)).toEqual(["candidate"]);
});
