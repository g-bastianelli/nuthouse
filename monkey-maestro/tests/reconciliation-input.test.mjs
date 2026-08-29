import { describe, expect, test } from "bun:test";
import path from "node:path";

import { buildReconciliationInput } from "../lib/reconciliation-input.mjs";

const decisionBaseline = {
  issueIds: ["DONE-1", "NEXT-2"],
  edges: [{ dependentIssueId: "NEXT-2", blockerIssueId: "DONE-1" }],
};

function control(overrides = {}) {
  return {
    schemaVersion: 1,
    projectId: "linear-project",
    runId: "run-1",
    active: true,
    repository: "org/repo",
    supersetProjectId: "superset-project",
    targetHostId: "host-1",
    defaultAgent: "codex",
    maxConcurrency: 1,
    executionIssueIds: ["DONE-1"],
    exitedExecutionIssueIds: [],
    decisionBaseline,
    decisionHash: "sha256:decision",
    graphHash: "sha256:graph",
    revision: 3,
    updatedAt: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

function packet(overrides = {}) {
  const expectedControl = control();
  return {
    expectedControl,
    linearSnapshot: {
      schemaVersion: 1,
      provider: "ready",
      control: control(),
      issues: [
        {
          id: "DONE-1",
          identifier: "DONE-1",
          projectId: "linear-project",
          statusType: "completed",
          dataState: "known",
          blockers: [],
        },
        {
          id: "NEXT-2",
          identifier: "NEXT-2",
          projectId: "linear-project",
          statusType: "backlog",
          dataState: "known",
          blockers: ["DONE-1"],
        },
      ],
      waivers: [],
      executionRecords: [
        {
          issueId: "DONE-1",
          runId: "run-1",
          taskId: "task-done",
          workspaceId: "workspace-done",
          terminalId: "terminal-done",
          hostId: "host-1",
        },
        {
          issueId: "OLD-3",
          runId: "run-0",
          taskId: "task-old",
          workspaceId: "workspace-old",
          terminalId: "terminal-old",
          hostId: "host-1",
        },
      ],
      unknown: [{ code: "OPTIONAL_LINEAR", requiredForDecision: false }],
    },
    runtimeSnapshot: {
      schemaVersion: 1,
      providers: { github: "ready", superset: "ready" },
      taskBindings: [
        {
          issueId: "DONE-1",
          taskId: "task-done",
          externalProvider: "linear",
          externalKey: "DONE-1",
          externalProjectId: "linear-project",
          managed: true,
        },
        {
          issueId: "NEXT-2",
          taskId: "task-next",
          externalProvider: "linear",
          externalKey: "NEXT-2",
          externalProjectId: "linear-project",
          managed: true,
        },
      ],
      workspaceInventory: {
        complete: true,
        hostId: "host-1",
        projectId: "superset-project",
        workspaceIds: ["main", "workspace-done"],
      },
      workspaces: [
        {
          id: "main",
          taskId: null,
          hostId: "host-1",
          projectId: "superset-project",
          terminals: [],
        },
        {
          id: "workspace-done",
          taskId: "task-done",
          hostId: "host-1",
          projectId: "superset-project",
          terminals: [{ id: "terminal-done", exited: false }],
        },
      ],
      githubPullRequests: [{ number: 42, state: "MERGED" }],
      unknown: [{ code: "OPTIONAL_RUNTIME", requiredForDecision: false }],
    },
    confirmedRunnableExpansions: ["NEXT-2"],
    ...overrides,
  };
}

describe("reconciliation input composition", () => {
  test("joins exact task bindings and preserves the full unfiltered provider snapshots", () => {
    const input = buildReconciliationInput(packet());

    expect(input.control.decisionBaseline).toEqual(decisionBaseline);
    expect(input.baseline).toEqual(decisionBaseline);
    expect(input.issues.map(({ id, taskId }) => ({ id, taskId }))).toEqual([
      { id: "DONE-1", taskId: "task-done" },
      { id: "NEXT-2", taskId: "task-next" },
    ]);
    expect(input.workspaces).toHaveLength(2);
    expect(input.workspaces[0]).not.toHaveProperty("claimed");
    expect(input.workspaces[1]).toMatchObject({ id: "workspace-done", claimed: true });
    expect(input.executionRecords.map((record) => record.activeRun)).toEqual([true, false]);
    expect(input.linearUnknown).toEqual([{ code: "OPTIONAL_LINEAR", requiredForDecision: false }]);
    expect(input.runtimeUnknown).toEqual([
      { code: "OPTIONAL_RUNTIME", requiredForDecision: false },
    ]);
    expect(input.confirmedRunnableExpansions).toEqual(["NEXT-2"]);
  });

  test("fails closed when the under-lock control changed", () => {
    expect(() =>
      buildReconciliationInput(
        packet({
          linearSnapshot: {
            ...packet().linearSnapshot,
            control: control({ revision: 4 }),
          },
        }),
      ),
    ).toThrow("CONTROL_CHANGED");
  });

  test("the resolver CLI composes a raw snapshot envelope before resolving", () => {
    const script = path.resolve(import.meta.dir, "..", "scripts", "reconcile-state.mjs");
    const rawPacket = packet();
    rawPacket.linearSnapshot.executionRecords = [rawPacket.linearSnapshot.executionRecords[0]];
    const result = Bun.spawnSync({
      cmd: [process.execPath, script],
      stdin: new Blob([JSON.stringify(rawPacket)]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const decision = JSON.parse(result.stdout.toString());

    expect(result.exitCode).toBe(0);
    expect(decision.active).toEqual([]);
    expect(decision.residual).toMatchObject([
      { issueId: "DONE-1", reason: "TERMINAL_ISSUE_RUNTIME_LIVE" },
    ]);
    expect(decision.dispatch).toMatchObject([{ issueId: "NEXT-2", taskId: "task-next" }]);
  });
});
