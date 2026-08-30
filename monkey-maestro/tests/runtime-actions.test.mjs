import { describe, expect, test } from "bun:test";
import path from "node:path";

import { planRuntimeActions } from "../lib/runtime-actions.mjs";

function frontier(rows) {
  const sorted = [...rows].sort((left, right) => left.issueId.localeCompare(right.issueId));
  return {
    rows: sorted,
    readyIssueIds: sorted.filter((row) => row.classification === "ready").map((row) => row.issueId),
    startedIssueIds: sorted
      .filter((row) => row.classification === "started")
      .map((row) => row.issueId),
    confirmationIssueIds: [],
    unknownIssueIds: [],
  };
}

function row(issueId, classification = "ready", overrides = {}) {
  const value = {
    issueId,
    blockerIssueIds: [],
    classification,
    linearStatusType: classification === "started" ? "started" : "unstarted",
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

function match(issueId, overrides = {}) {
  return {
    issueId,
    taskId: `task-${issueId}`,
    workspaceIds: [],
    terminalIds: [],
    dataState: "known",
    ...overrides,
  };
}

const runtimeContext = {
  targetHostId: "host-1",
  supersetProjectId: "superset-project",
  linearProjectId: "linear-project",
};

function runtime(matches, context = runtimeContext) {
  const requestedIssueIds = matches.map((item) => item.issueId).sort();
  const issues = matches
    .filter((item) => item.dataState === "known")
    .map((item) => {
      const task =
        item.taskId === undefined
          ? null
          : {
              id: item.taskId,
              externalProvider: "linear",
              externalKey: item.issueId,
              externalProjectId: context.linearProjectId.startsWith("manual:")
                ? null
                : context.linearProjectId,
              deletedAt: null,
              syncError: null,
            };
      const workspaceIds = item.workspaceIds ?? [];
      const activeTerminalIds = new Set(item.activeTerminalIds ?? item.terminalIds ?? []);
      return {
        issueId: item.issueId,
        task,
        workspaces: workspaceIds.map((workspaceId) => ({
          workspaceId,
          taskId: item.taskId,
          hostId: context.targetHostId,
          projectId: context.supersetProjectId,
        })),
        terminals: (item.terminalIds ?? []).map((terminalId) => ({
          workspaceId: workspaceIds[0],
          terminalId,
          active: activeTerminalIds.has(terminalId),
        })),
        dataState: "known",
      };
    });
  const unknown = matches
    .filter((item) => item.dataState === "unknown")
    .map((item) => ({ issueId: item.issueId, code: "RUNTIME_UNKNOWN", detail: "fixture" }));
  return {
    schemaVersion: 1,
    provider: unknown.length === 0 ? "ready" : issues.length === 0 ? "unavailable" : "partial",
    context,
    scope: { selectedIssueIds: requestedIssueIds },
    issues,
    unknown,
  };
}

function forceAuthorization(issueIds, uncertaintiesByIssueId = {}) {
  return {
    invocationId: "invocation-1",
    issueIds,
    confirmedAt: "2026-08-30T10:00:00.000Z",
    bypassedBlockerIssueIds: Object.fromEntries(issueIds.map((issueId) => [issueId, []])),
    bypassedUncertainties: Object.fromEntries(
      issueIds.map((issueId) => [issueId, uncertaintiesByIssueId[issueId] ?? []]),
    ),
  };
}

describe("runtime action planning", () => {
  test("maps zero, one, and multiple exact workspaces without global ambiguity", () => {
    const plan = planRuntimeActions(
      frontier([
        row("NOT-1"),
        row("NOT-2"),
        row("NOT-3"),
        row("NOT-4"),
        row("NOT-5"),
        row("NOT-6"),
      ]),
      runtime([
        match("NOT-1"),
        match("NOT-2", { workspaceIds: ["workspace-2"] }),
        match("NOT-3", {
          workspaceIds: ["workspace-3"],
          terminalIds: ["terminal-3"],
        }),
        match("NOT-4", { workspaceIds: ["workspace-4a", "workspace-4b"] }),
        match("NOT-5", {
          workspaceIds: ["workspace-5"],
          terminalIds: ["terminal-5a", "terminal-5b"],
        }),
        match("NOT-6", {
          workspaceIds: ["workspace-6"],
          terminalIds: ["terminal-exited"],
          activeTerminalIds: [],
          exitedTerminalIds: ["terminal-exited"],
        }),
      ]),
    );

    expect(plan.actions).toEqual([
      {
        issueId: "NOT-1",
        taskId: "task-NOT-1",
        forced: false,
        linearClassification: "ready",
        linearStatusType: "unstarted",
        action: "create",
      },
      {
        issueId: "NOT-2",
        taskId: "task-NOT-2",
        forced: false,
        linearClassification: "ready",
        linearStatusType: "unstarted",
        action: "reuse",
        workspaceId: "workspace-2",
      },
      {
        issueId: "NOT-3",
        taskId: "task-NOT-3",
        forced: false,
        linearClassification: "ready",
        linearStatusType: "unstarted",
        action: "monitor",
        workspaceId: "workspace-3",
        terminalId: "terminal-3",
      },
      {
        issueId: "NOT-4",
        action: "ambiguous",
        linearClassification: "ready",
        linearStatusType: "unstarted",
        taskId: "task-NOT-4",
        reason: "RUNTIME_AMBIGUOUS",
        forced: false,
      },
      {
        issueId: "NOT-5",
        action: "ambiguous",
        linearClassification: "ready",
        linearStatusType: "unstarted",
        taskId: "task-NOT-5",
        reason: "RUNTIME_AMBIGUOUS",
        forced: false,
      },
      {
        issueId: "NOT-6",
        taskId: "task-NOT-6",
        forced: false,
        linearClassification: "ready",
        linearStatusType: "unstarted",
        action: "reuse",
        workspaceId: "workspace-6",
      },
    ]);
    expect(plan.capacityUsed).toBe(1);
  });

  test("groups started issues with no exact runtime for confirmation", () => {
    const inputFrontier = frontier([
      row("NOT-8", "started"),
      row("NOT-7", "started"),
      row("NOT-9", "started"),
    ]);
    const inputRuntime = runtime([
      match("NOT-8"),
      match("NOT-7"),
      match("NOT-9", { workspaceIds: ["workspace-9"] }),
    ]);

    const pending = planRuntimeActions(inputFrontier, inputRuntime);
    expect(pending.confirmationIssueIds).toEqual(["NOT-7", "NOT-8", "NOT-9"]);
    expect(pending.actions.every((action) => action.action === "confirm")).toBe(true);

    const confirmed = planRuntimeActions(inputFrontier, inputRuntime, {
      confirmedIssueIds: ["NOT-9", "NOT-8", "NOT-7"],
    });
    expect(confirmed.confirmationIssueIds).toEqual([]);
    expect(confirmed.actions.map((action) => action.action)).toEqual(["create", "create", "reuse"]);
    expect(confirmed.actions.every((action) => action.confirmationAccepted)).toBe(true);
  });

  test("requires issue-scoped force confirmation for mutation but not active monitoring", () => {
    const inputFrontier = frontier([
      row("NOT-FORCE-CREATE", "ready", { forced: true }),
      row("NOT-FORCE-MONITOR", "ready", { forced: true }),
      row("NOT-FORCE-REUSE", "ready", { forced: true }),
    ]);
    const inputRuntime = runtime([
      match("NOT-FORCE-CREATE"),
      match("NOT-FORCE-MONITOR", {
        workspaceIds: ["workspace-monitor"],
        terminalIds: ["terminal-monitor"],
      }),
      match("NOT-FORCE-REUSE", { workspaceIds: ["workspace-reuse"] }),
    ]);

    const pending = planRuntimeActions(inputFrontier, inputRuntime);
    expect(pending.confirmationIssueIds).toEqual(["NOT-FORCE-CREATE", "NOT-FORCE-REUSE"]);
    expect(pending.actions).toMatchObject([
      { issueId: "NOT-FORCE-CREATE", action: "confirm" },
      { issueId: "NOT-FORCE-MONITOR", action: "monitor" },
      { issueId: "NOT-FORCE-REUSE", action: "confirm" },
    ]);

    const authorized = planRuntimeActions(inputFrontier, inputRuntime, {
      invocationId: "invocation-1",
      forceAuthorization: forceAuthorization(["NOT-FORCE-CREATE", "NOT-FORCE-REUSE"]),
    });
    expect(authorized.confirmationIssueIds).toEqual([]);
    expect(authorized.actions).toMatchObject([
      {
        issueId: "NOT-FORCE-CREATE",
        action: "create",
        forceAuthorized: true,
        confirmationAccepted: true,
        forceInvocationId: "invocation-1",
        forceBypassedUncertainties: [],
      },
      { issueId: "NOT-FORCE-MONITOR", action: "monitor" },
      {
        issueId: "NOT-FORCE-REUSE",
        action: "reuse",
        forceAuthorized: true,
        confirmationAccepted: true,
        forceInvocationId: "invocation-1",
        forceBypassedUncertainties: [],
      },
    ]);
  });

  test("rejects force authorization replayed into another invocation", () => {
    expect(() =>
      planRuntimeActions(
        frontier([row("NOT-FORCE", "ready", { forced: true })]),
        runtime([match("NOT-FORCE")]),
        {
          invocationId: "invocation-2",
          forceAuthorization: forceAuthorization(["NOT-FORCE"]),
        },
      ),
    ).toThrow("RUNTIME_FORCE_AUTHORIZATION_INVOCATION_MISMATCH");
  });

  test("requires and propagates an exact force uncertainty preview", () => {
    const preview = [{ issueId: "NOT-FORCE-UNCERTAINTY", code: "UNKNOWN:RELATIONS_PARTIAL" }];
    const inputFrontier = frontier([
      row("NOT-FORCE-UNCERTAINTY", "ready", {
        forced: true,
        forceBypassedUncertainties: preview,
      }),
    ]);
    const inputRuntime = runtime([match("NOT-FORCE-UNCERTAINTY")]);
    const authorization = forceAuthorization(["NOT-FORCE-UNCERTAINTY"], {
      "NOT-FORCE-UNCERTAINTY": preview,
    });

    expect(
      planRuntimeActions(inputFrontier, inputRuntime, {
        invocationId: "invocation-1",
        forceAuthorization: authorization,
      }).actions[0],
    ).toMatchObject({
      action: "create",
      forceBypassedUncertainties: preview,
    });
    const { bypassedUncertainties: _bypassedUncertainties, ...incomplete } = authorization;
    expect(() =>
      planRuntimeActions(inputFrontier, inputRuntime, {
        invocationId: "invocation-1",
        forceAuthorization: incomplete,
      }),
    ).toThrow("RUNTIME_FORCE_AUTHORIZATION_INVALID");
    expect(() =>
      planRuntimeActions(inputFrontier, inputRuntime, {
        invocationId: "invocation-1",
        forceAuthorization: forceAuthorization(["NOT-FORCE-UNCERTAINTY"]),
      }),
    ).toThrow("RUNTIME_FORCE_AUTHORIZATION_SCOPE_MISMATCH");
  });

  test("passes exact control context into runtime boundary validation", () => {
    const inputFrontier = frontier([row("NOT-CONTEXT")]);
    const validControl = {
      projectId: "linear-project",
      active: true,
      targetHostId: "host-1",
      supersetProjectId: "superset-project",
      defaultAgent: "codex",
      runId: "run-1",
      maxConcurrency: 2,
    };

    expect(
      planRuntimeActions(inputFrontier, runtime([match("NOT-CONTEXT")], runtimeContext), {
        control: validControl,
      }).actions[0],
    ).toMatchObject({ issueId: "NOT-CONTEXT", action: "create" });
    expect(() =>
      planRuntimeActions(
        inputFrontier,
        runtime([match("NOT-CONTEXT")], { ...runtimeContext, targetHostId: "host-other" }),
        { control: validControl },
      ),
    ).toThrow("RUNTIME_CONTEXT_MISMATCH");
  });

  test("rejects normalized match facts at the canonical subagent boundary", () => {
    expect(() =>
      planRuntimeActions(frontier([row("NOT-UNTRUSTED")]), {
        schemaVersion: 1,
        scope: { mode: "targeted", requestedIssueIds: ["NOT-UNTRUSTED"] },
        matches: [match("NOT-UNTRUSTED")],
        unknown: [],
      }),
    ).toThrow("RUNTIME_RAW_ENVELOPE_REQUIRED");
  });

  test("accepts exact manual-scope task evidence only with a null external project", () => {
    const manualContext = { ...runtimeContext, linearProjectId: "manual:NOT-MANUAL" };
    const manualControl = {
      projectId: "manual:NOT-MANUAL",
      active: true,
      targetHostId: "host-1",
      supersetProjectId: "superset-project",
      defaultAgent: "codex",
      runId: "manual-run",
      maxConcurrency: 1,
    };

    expect(
      planRuntimeActions(
        frontier([row("NOT-MANUAL")]),
        runtime([match("NOT-MANUAL")], manualContext),
        { control: manualControl },
      ).actions[0],
    ).toMatchObject({ action: "create", taskId: "task-NOT-MANUAL" });
  });

  test("returns issue-scoped hard refusals for force safety boundaries", () => {
    const forcedFrontier = frontier([row("NOT-10", "ready", { forced: true })]);

    const cases = [
      {
        options: { control: { active: false } },
        runtime: runtime([match("NOT-10")]),
        reason: "CONTROL_INACTIVE",
        forceRefusal: "control-inactive",
      },
      {
        options: { control: { active: true, targetHostId: "", supersetProjectId: "project" } },
        runtime: runtime([match("NOT-10")]),
        reason: "CONFIGURATION_MISSING",
        forceRefusal: "configuration-missing",
      },
      {
        options: { lockAvailable: false },
        runtime: runtime([match("NOT-10")]),
        reason: "LOCK_HELD",
        forceRefusal: "lock-held",
      },
      {
        options: {},
        runtime: runtime([match("NOT-10", { taskId: undefined })]),
        reason: "IDENTITY_MISSING",
        forceRefusal: "identity-missing",
      },
      {
        options: {},
        runtime: runtime([match("NOT-10", { workspaceIds: ["workspace-a", "workspace-b"] })]),
        reason: "RUNTIME_AMBIGUOUS",
        forceRefusal: "runtime-ambiguous",
      },
    ];

    for (const item of cases) {
      expect(
        planRuntimeActions(forcedFrontier, item.runtime, item.options).actions[0],
      ).toMatchObject({
        issueId: "NOT-10",
        reason: item.reason,
        forceRefusal: item.forceRefusal,
      });
    }
  });

  test("refuses terminal issues before runtime data can influence them", () => {
    expect(() =>
      planRuntimeActions(
        frontier([row("NOT-11", "terminal", { forced: true })]),
        runtime([match("NOT-11")]),
        { selectedIssueIds: ["NOT-11"] },
      ),
    ).toThrow("RUNTIME_TERMINAL_SELECTION_FORBIDDEN");
  });

  test("isolates unknown runtime evidence without affecting a sibling", () => {
    const plan = planRuntimeActions(
      frontier([row("NOT-12"), row("NOT-13")]),
      runtime([match("NOT-12", { dataState: "unknown", taskId: undefined }), match("NOT-13")]),
    );

    expect(plan.actions[0]).toMatchObject({
      issueId: "NOT-12",
      action: "non-transportable",
      reason: "RUNTIME_UNKNOWN",
    });
    expect(plan.actions[1]).toMatchObject({ issueId: "NOT-13", action: "create" });
  });

  test("the CLI emits the same validated plan", () => {
    const script = path.resolve(import.meta.dir, "..", "scripts", "runtime-actions.mjs");
    const payload = {
      frontierPlan: frontier([row("NOT-14")]),
      runtimeSnapshot: {
        schemaVersion: 1,
        provider: "ready",
        context: runtimeContext,
        scope: { selectedIssueIds: ["NOT-14"] },
        issues: [
          {
            issueId: "NOT-14",
            task: {
              id: "task-NOT-14",
              externalProvider: "linear",
              externalKey: "NOT-14",
              externalProjectId: "linear-project",
              deletedAt: null,
              syncError: null,
            },
            workspaces: [],
            terminals: [],
            dataState: "known",
          },
        ],
        unknown: [],
      },
      options: {
        control: {
          projectId: "linear-project",
          active: true,
          targetHostId: "host-1",
          supersetProjectId: "superset-project",
          defaultAgent: "codex",
          runId: "run-1",
          maxConcurrency: 2,
        },
      },
    };
    const result = Bun.spawnSync({
      cmd: [process.execPath, script],
      stdin: new Blob([JSON.stringify(payload)]),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      ok: true,
      plan: { actions: [{ issueId: "NOT-14", action: "create" }] },
    });
  });
});
