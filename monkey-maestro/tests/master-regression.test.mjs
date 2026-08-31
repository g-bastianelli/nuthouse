import { expect, test } from "bun:test";

import { planLinearFrontier } from "../lib/linear-frontier.mjs";
import { advanceOrchestrationEpoch } from "../lib/orchestration-effects.mjs";
import { planRuntimeActions } from "../lib/runtime-actions.mjs";

const projectId = "linear-project";
const lockDirectory = "/tmp/maestro-master-regression-locks";
const invocationId = "55555555-5555-4555-8555-555555555555";
const control = {
  projectId,
  runId: "run-regression",
  active: true,
  targetHostId: "host-1",
  supersetProjectId: "superset-project",
  defaultAgent: "codex",
  maxConcurrency: 2,
  revision: 5,
};

function issue(issueId, statusType, blockerIssueIds = [], overrides = {}) {
  return {
    issueId,
    projectId,
    statusType,
    blockerIssueIds,
    dataState: statusType === "unknown" ? "unknown" : "known",
    ...overrides,
  };
}

function runtimeSnapshot(issueId, { launched = false } = {}) {
  const workspaceId = `workspace-${issueId}`;
  return {
    schemaVersion: 1,
    provider: "ready",
    context: {
      targetHostId: control.targetHostId,
      supersetProjectId: control.supersetProjectId,
      linearProjectId: projectId,
    },
    scope: { selectedIssueIds: [issueId] },
    issues: [
      {
        issueId,
        task: {
          id: `task-${issueId}`,
          externalProvider: "linear",
          externalKey: issueId,
          externalProjectId: projectId,
          deletedAt: null,
          syncError: null,
        },
        workspaces: launched
          ? [
              {
                workspaceId,
                taskId: `task-${issueId}`,
                hostId: control.targetHostId,
                projectId: control.supersetProjectId,
              },
            ]
          : [],
        terminals: launched
          ? [{ workspaceId, terminalId: `terminal-${issueId}`, active: true }]
          : [],
        dataState: "known",
      },
    ],
    unknown: [],
  };
}

function freshNot550Snapshot() {
  const issues = [
    issue("NOT-547", "completed"),
    issue("NOT-548", "completed", ["NOT-547"]),
    issue("NOT-549", "completed", ["NOT-547", "NOT-548"]),
    issue("NOT-550", "unstarted", ["NOT-547", "NOT-548", "NOT-549"]),
  ];
  return {
    schemaVersion: 1,
    projectId,
    scope: {
      mode: "targeted",
      requestedIssueIds: issues.map((item) => item.issueId).sort(),
    },
    issues,
    unknown: [],
  };
}

test("started work with relation defects remains monitored and consumes capacity", () => {
  const frontierPlan = planLinearFrontier({
    schemaVersion: 1,
    projectId,
    scope: { mode: "full", requestedIssueIds: [] },
    issues: [issue("NOT-STARTED", "started", ["NOT-MISSING-BLOCKER"])],
    unknown: [],
  });

  expect(frontierPlan.startedIssueIds).toEqual(["NOT-STARTED"]);
  expect(frontierPlan.rows[0]).toMatchObject({
    classification: "started",
    reason: "BLOCKER_UNKNOWN:NOT-MISSING-BLOCKER",
  });

  const runtimePlan = planRuntimeActions(
    frontierPlan,
    runtimeSnapshot("NOT-STARTED", { launched: true }),
    {
      control,
      selectedIssueIds: ["NOT-STARTED"],
    },
  );

  expect(runtimePlan.actions).toMatchObject([
    {
      issueId: "NOT-STARTED",
      action: "monitor",
      terminalId: "terminal-NOT-STARTED",
    },
  ]);
  expect(runtimePlan.capacityUsed).toBe(1);
});

test("NOT-550 dispatches through the production bridge despite terminal residue and unrelated unknown", async () => {
  let githubCalls = 0;
  const githubUnavailable = () => {
    githubCalls += 1;
    throw new Error("GitHub unavailable");
  };
  const runtimeDatabase = new Map([
    ["NOT-549", { workspaceIds: ["residual-workspace-549"], terminalIds: [] }],
    ["NOT-550", { workspaceIds: [], terminalIds: [] }],
  ]);
  const initialLinearSnapshot = {
    schemaVersion: 1,
    projectId,
    scope: { mode: "full", requestedIssueIds: [] },
    issues: [
      issue("NOT-547", "completed"),
      issue("NOT-548", "completed", ["NOT-547"]),
      issue("NOT-549", "completed", ["NOT-547", "NOT-548"], {
        residualRuntime: runtimeDatabase.get("NOT-549"),
      }),
      issue("NOT-550", "unstarted", ["NOT-547", "NOT-548", "NOT-549"]),
      issue("NOT-554", "unknown"),
    ],
    unknown: [{ issueId: "NOT-554", code: "STATUS_UNKNOWN", detail: "unrelated" }],
    github: githubUnavailable,
  };

  const frontierPlan = planLinearFrontier(initialLinearSnapshot);
  expect(frontierPlan.rows.find((row) => row.issueId === "NOT-549")).toMatchObject({
    classification: "terminal",
  });
  expect(frontierPlan.rows.find((row) => row.issueId === "NOT-550")).toMatchObject({
    classification: "ready",
  });
  expect(frontierPlan.unknownIssueIds).toEqual(["NOT-554"]);

  const runtimePlan = planRuntimeActions(frontierPlan, runtimeSnapshot("NOT-550"), {
    control,
    selectedIssueIds: ["NOT-550"],
  });
  expect(runtimePlan.actions).toMatchObject([{ issueId: "NOT-550", action: "create" }]);

  const transcript = [];
  const inspectedIssueIds = [];
  const dispatchSubsteps = [];
  const effectAdapters = [];
  let epoch;

  for (let step = 0; step < 12; step += 1) {
    epoch = await advanceOrchestrationEpoch({
      schemaVersion: 1,
      request: {
        invocationId,
        frontierPlan,
        runtimePlan,
        control,
        selectedIssueIds: ["NOT-550"],
        lockDirectory,
        dispatchContextByIssueId: {
          "NOT-550": {
            branchName: "linear/not-550-adaptive-runtime",
            workspaceName: "not-550-adaptive-runtime",
            workerPrompt:
              "linear-devotee:greet NOT-550\nImplement NOT-550, verify acceptance, and return the required envelope.",
          },
        },
      },
      transcript,
    });
    if (epoch.state === "complete") break;

    for (const effect of epoch.effects) {
      effectAdapters.push(effect.adapter);
      let value;
      switch (effect.adapter) {
        case "acquireDispatchLock":
          value = {
            acquired: true,
            directory: lockDirectory,
            projectId,
            token: "lock-token",
            owner: {
              schemaVersion: 2,
              projectId,
              hostId: control.targetHostId,
              token: "lock-token",
              createdAt: "2026-08-30T10:00:00.000Z",
              expiresAt: "2026-08-30T10:15:00.000Z",
            },
          };
          break;
        case "refreshCandidateAndBlockers":
          expect(effect.input).toMatchObject({
            issueId: "NOT-550",
            refreshMode: "candidate-blockers",
          });
          value = freshNot550Snapshot();
          break;
        case "inspectExactRuntime":
          inspectedIssueIds.push(effect.input.issueId);
          expect(effect.input.issueId).toBe("NOT-550");
          value = runtimeSnapshot("NOT-550");
          break;
        case "dispatchIssue":
          expect(effect.input).toMatchObject({
            issueId: "NOT-550",
            branchName: "linear/not-550-adaptive-runtime",
            workspaceName: "not-550-adaptive-runtime",
            workerPrompt:
              "linear-devotee:greet NOT-550\nImplement NOT-550, verify acceptance, and return the required envelope.",
          });
          dispatchSubsteps.push(
            "lock-verify",
            "task",
            "workspace-check",
            "workspace-create",
            "workspace-verify",
            "terminal-snapshot",
            "agent-create",
            "terminal-correlation",
            "execution-record",
          );
          value = {
            schemaVersion: 1,
            state: "verified",
            action: effect.input.action,
            lockVerification: {
              directory: effect.input.lockReceipt.directory,
              projectId: effect.input.lockReceipt.projectId,
              hostId: effect.input.lockReceipt.owner.hostId,
              token: effect.input.lockReceipt.token,
              verifiedAt: "2026-08-30T10:05:00.000Z",
              expiresAt: effect.input.lockReceipt.owner.expiresAt,
            },
            runtimeSnapshot: runtimeSnapshot("NOT-550", { launched: true }),
            record: { status: "written" },
          };
          break;
        case "releaseDispatchLock":
          expect(effect.input).toMatchObject({
            directory: lockDirectory,
            projectId,
            token: "lock-token",
          });
          value = { released: true };
          break;
        case "monitorWorker":
          expect(effect.input).toEqual({
            issueId: "NOT-550",
            taskId: "task-NOT-550",
            workspaceId: "workspace-NOT-550",
            terminalId: "terminal-NOT-550",
          });
          value = {};
          break;
        default:
          throw new Error(`unexpected effect ${effect.adapter}`);
      }
      transcript.push({ effectId: effect.effectId, status: "fulfilled", value });
    }
  }

  expect(epoch?.state).toBe("complete");
  expect(epoch.result.dispatch.settled).toMatchObject([
    {
      issueId: "NOT-550",
      status: "fulfilled",
      value: { outcome: "dispatched", action: "create" },
    },
  ]);
  expect(inspectedIssueIds).toEqual([]);
  expect(effectAdapters).not.toContain("github");
  expect(effectAdapters).toEqual([
    "acquireDispatchLock",
    "refreshCandidateAndBlockers",
    "dispatchIssue",
    "releaseDispatchLock",
    "monitorWorker",
  ]);
  expect(githubCalls).toBe(0);
  expect(dispatchSubsteps).toEqual([
    "lock-verify",
    "task",
    "workspace-check",
    "workspace-create",
    "workspace-verify",
    "terminal-snapshot",
    "agent-create",
    "terminal-correlation",
    "execution-record",
  ]);
  expect(runtimeDatabase.get("NOT-549")).toEqual({
    workspaceIds: ["residual-workspace-549"],
    terminalIds: [],
  });
});
