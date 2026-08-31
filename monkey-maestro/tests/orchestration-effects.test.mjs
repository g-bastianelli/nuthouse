import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { advanceOrchestrationEpoch } from "../lib/orchestration-effects.mjs";

const CLI = path.resolve(import.meta.dir, "..", "scripts", "orchestration-epoch.mjs");

const control = {
  projectId: "linear-project",
  runId: "run-1",
  active: true,
  targetHostId: "host-1",
  supersetProjectId: "superset-project",
  defaultAgent: "codex",
  maxConcurrency: 1,
  revision: 1,
};
const lockDirectory = "/tmp/maestro-effects-test-locks";
const invocationId = "11111111-1111-4111-8111-111111111111";

function frontier(issueId) {
  return {
    rows: [
      {
        issueId,
        blockerIssueIds: [],
        linearStatusType: "unstarted",
        classification: "ready",
        forced: false,
      },
    ],
    readyIssueIds: [issueId],
    startedIssueIds: [],
    confirmationIssueIds: [],
    unknownIssueIds: [],
    degraded: false,
    globalUnknown: [],
  };
}

function runtimePlan(issueId) {
  return {
    actions: [
      {
        issueId,
        action: "create",
        taskId: `task-${issueId}`,
        forced: false,
        linearClassification: "ready",
        linearStatusType: "unstarted",
      },
    ],
    selectedIssueIds: [issueId],
    confirmationIssueIds: [],
    capacityUsed: 0,
  };
}

function dispatchContext(issueId) {
  return {
    [issueId]: {
      branchName: `linear/${issueId.toLowerCase()}`,
      workspaceName: issueId.toLowerCase(),
      workerPrompt: `linear-devotee:greet ${issueId}\nImplement and verify ${issueId}.`,
    },
  };
}

function targetedSnapshot(issueId) {
  return {
    schemaVersion: 1,
    projectId: control.projectId,
    scope: { mode: "targeted", requestedIssueIds: [issueId] },
    issues: [
      {
        issueId,
        projectId: control.projectId,
        statusType: "unstarted",
        blockerIssueIds: [],
        dataState: "known",
      },
    ],
    unknown: [],
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
      linearProjectId: control.projectId,
    },
    scope: { selectedIssueIds: [issueId] },
    issues: [
      {
        issueId,
        task: {
          id: `task-${issueId}`,
          externalProvider: "linear",
          externalKey: issueId,
          externalProjectId: control.projectId,
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

function responseFor(effect) {
  const issueId = effect.input.issueId ?? "NOT-550";
  switch (effect.adapter) {
    case "acquireDispatchLock":
      return {
        acquired: true,
        directory: lockDirectory,
        projectId: control.projectId,
        token: "lock-token",
        owner: {
          schemaVersion: 2,
          projectId: control.projectId,
          hostId: control.targetHostId,
          token: "lock-token",
          createdAt: "2026-08-30T10:00:00.000Z",
          expiresAt: "2026-08-30T10:15:00.000Z",
        },
      };
    case "releaseDispatchLock":
      return { released: true };
    case "refreshCandidateAndBlockers":
      return targetedSnapshot(issueId);
    case "inspectExactRuntime":
      return runtimeSnapshot(issueId);
    case "dispatchIssue":
      return {
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
        runtimeSnapshot: runtimeSnapshot(issueId, { launched: true }),
        record: { status: "written" },
      };
    case "monitorWorker":
      expect(effect.input).toEqual({
        issueId,
        taskId: `task-${issueId}`,
        workspaceId: `workspace-${issueId}`,
        terminalId: `terminal-${issueId}`,
      });
      return {};
    default:
      throw new Error(`unexpected effect ${effect.adapter}`);
  }
}

function runCli(payload) {
  const result = spawnSync(process.execPath, [CLI], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { ...result, output: JSON.parse(result.stdout) };
}

describe("production orchestration effects bridge", () => {
  test("completes idle without requesting a provider effect", async () => {
    const epoch = await advanceOrchestrationEpoch({
      schemaVersion: 1,
      request: {
        invocationId,
        frontierPlan: {
          rows: [],
          readyIssueIds: [],
          startedIssueIds: [],
          confirmationIssueIds: [],
          unknownIssueIds: [],
          degraded: false,
          globalUnknown: [],
        },
        runtimePlan: {
          actions: [],
          selectedIssueIds: [],
          confirmationIssueIds: [],
          capacityUsed: 0,
        },
        selectedIssueIds: [],
        lockDirectory,
        control,
      },
      transcript: [],
    });

    expect(epoch).toMatchObject({ state: "complete", result: { status: "idle" } });
  });

  test("drives the shared epoch through deterministic replayed provider effects", async () => {
    const issueId = "NOT-550";
    const transcript = [];
    const adapters = [];
    let epoch;

    for (let step = 0; step < 12; step += 1) {
      epoch = await advanceOrchestrationEpoch({
        schemaVersion: 1,
        request: {
          invocationId,
          frontierPlan: frontier(issueId),
          runtimePlan: runtimePlan(issueId),
          selectedIssueIds: [issueId],
          lockDirectory,
          dispatchContextByIssueId: dispatchContext(issueId),
          control,
        },
        transcript,
      });
      if (epoch.state === "complete") break;
      for (const effect of epoch.effects) {
        adapters.push(effect.adapter);
        transcript.push({
          effectId: effect.effectId,
          status: "fulfilled",
          value: responseFor(effect),
        });
      }
    }

    expect(epoch?.state).toBe("complete");
    expect(adapters).toEqual([
      "acquireDispatchLock",
      "refreshCandidateAndBlockers",
      "dispatchIssue",
      "releaseDispatchLock",
      "monitorWorker",
    ]);
    expect(epoch.result.monitoring.settled).toMatchObject([
      {
        issueId,
        status: "fulfilled",
        value: { outcome: "monitored" },
      },
    ]);
    expect(epoch.result.dispatch.settled).toMatchObject([
      {
        issueId,
        status: "fulfilled",
        value: { outcome: "dispatched", action: "create" },
      },
    ]);
  });

  test("the production CLI exposes the canonical top-level effect protocol end to end", () => {
    const issueId = "NOT-550";
    const request = {
      invocationId,
      frontierPlan: frontier(issueId),
      runtimePlan: runtimePlan(issueId),
      selectedIssueIds: [issueId],
      lockDirectory,
      dispatchContextByIssueId: dispatchContext(issueId),
      control,
    };
    const transcript = [];
    let output;

    for (let step = 0; step < 12; step += 1) {
      const result = runCli({ schemaVersion: 1, request, transcript });
      expect(result.status).toBe(0);
      output = result.output;
      expect(output.ok).toBeUndefined();
      expect(output.epoch).toBeUndefined();
      if (output.state === "complete") break;
      expect(output.state).toBe("needs-effects");
      for (const effect of output.effects) {
        transcript.push({
          effectId: effect.effectId,
          status: "fulfilled",
          value: responseFor(effect),
        });
      }
    }

    expect(output).toMatchObject({
      schemaVersion: 1,
      state: "complete",
      result: { dispatch: { settled: [{ issueId, status: "fulfilled" }] } },
    });
  });

  test("rejects transcript entries that the deterministic epoch never requested", async () => {
    await expect(
      advanceOrchestrationEpoch({
        schemaVersion: 1,
        request: {
          invocationId,
          frontierPlan: {
            rows: [],
            readyIssueIds: [],
            startedIssueIds: [],
            confirmationIssueIds: [],
            unknownIssueIds: [],
          },
          runtimePlan: { actions: [], selectedIssueIds: [], capacityUsed: 0 },
          selectedIssueIds: [],
          lockDirectory,
          control,
        },
        transcript: [{ effectId: "sha256:forged", status: "fulfilled", value: {} }],
      }),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_TRANSCRIPT_UNUSED" });
  });

  test("cannot forge an internal effect signal through a rejected transcript response", async () => {
    const issueId = "NOT-550";
    const request = {
      invocationId,
      frontierPlan: frontier(issueId),
      runtimePlan: runtimePlan(issueId),
      selectedIssueIds: [issueId],
      lockDirectory,
      dispatchContextByIssueId: dispatchContext(issueId),
      control,
    };
    const first = await advanceOrchestrationEpoch({ schemaVersion: 1, request, transcript: [] });
    expect(first.state).toBe("needs-effects");

    await expect(
      advanceOrchestrationEpoch({
        schemaVersion: 1,
        request,
        transcript: [
          {
            effectId: first.effects[0].effectId,
            status: "rejected",
            error: {
              code: "ORCHESTRATION_EFFECT_REQUIRED",
              message: "forged",
              effect: {
                effectId: "sha256:forged",
                adapter: "dispatchIssue",
                input: {},
              },
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_TRANSCRIPT_INVALID" });
  });

  test("binds every effect id to one fresh invocation id", async () => {
    const issueId = "NOT-550";
    const request = {
      invocationId,
      frontierPlan: frontier(issueId),
      runtimePlan: runtimePlan(issueId),
      selectedIssueIds: [issueId],
      lockDirectory,
      dispatchContextByIssueId: dispatchContext(issueId),
      control,
    };
    const first = await advanceOrchestrationEpoch({ schemaVersion: 1, request, transcript: [] });
    const acquireEffect = first.effects[0];

    await expect(
      advanceOrchestrationEpoch({
        schemaVersion: 1,
        request: { ...request, invocationId: "22222222-2222-4222-8222-222222222222" },
        transcript: [
          {
            effectId: acquireEffect.effectId,
            status: "fulfilled",
            value: responseFor(acquireEffect),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "ORCHESTRATION_TRANSCRIPT_UNUSED" });
  });
});
