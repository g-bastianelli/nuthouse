import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  mergeTargetedRuntimeSnapshot,
  mergeTargetedRuntimeSnapshotUnknown,
  RuntimeSnapshotValidationError,
  validateRuntimeAuditSnapshot,
  validateRuntimeMatch,
  validateRuntimeSnapshot,
} from "../lib/runtime-snapshot.mjs";

const selectedIssues = [
  {
    issueId: "NOT-2",
    classification: "started",
    blockerIssueIds: ["NOT-1"],
    forced: false,
  },
  {
    issueId: "NOT-3",
    classification: "ready",
    blockerIssueIds: [],
    forced: false,
  },
];

const rawContext = {
  targetHostId: "host-1",
  supersetProjectId: "superset-project",
  linearProjectId: "linear-project",
};

function rawTask(issueId, taskId = `task-${issueId}`) {
  return {
    id: taskId,
    externalProvider: "linear",
    externalKey: issueId,
    externalProjectId: rawContext.linearProjectId,
    deletedAt: null,
    syncError: null,
  };
}

function rawWorkspace(workspaceId, taskId) {
  return {
    workspaceId,
    taskId,
    hostId: rawContext.targetHostId,
    projectId: rawContext.supersetProjectId,
  };
}

function rawIssue(issueId, { taskId = `task-${issueId}`, workspaceIds = [], terminals = [] } = {}) {
  return {
    issueId,
    task: rawTask(issueId, taskId),
    workspaces: workspaceIds.map((workspaceId) => rawWorkspace(workspaceId, taskId)),
    terminals,
    dataState: "known",
  };
}

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    scope: { mode: "targeted", requestedIssueIds: ["NOT-3", "NOT-2"] },
    matches: [
      {
        issueId: "NOT-3",
        taskId: "task-3",
        workspaceIds: [],
        terminalIds: [],
        dataState: "known",
      },
      {
        issueId: "NOT-2",
        taskId: "task-2",
        workspaceIds: ["workspace-2"],
        terminalIds: ["terminal-old", "terminal-live"],
        activeTerminalIds: ["terminal-live"],
        exitedTerminalIds: ["terminal-old"],
        dataState: "known",
      },
    ],
    unknown: [],
    ...overrides,
  };
}

function rawSnapshot(issueIds, overrides = {}) {
  return {
    schemaVersion: 1,
    provider: "ready",
    context: rawContext,
    scope: { selectedIssueIds: issueIds },
    issues: issueIds.map((issueId) => rawIssue(issueId)),
    unknown: [],
    ...overrides,
  };
}

describe("targeted runtime snapshot validation", () => {
  test("adapts the canonical raw runtime agent envelope into planner matches", () => {
    const value = validateRuntimeSnapshot(
      {
        schemaVersion: 1,
        provider: "partial",
        context: rawContext,
        scope: { selectedIssueIds: ["NOT-3", "NOT-2"] },
        issues: [
          rawIssue("NOT-2", {
            taskId: "task-2",
            workspaceIds: ["workspace-2"],
            terminals: [
              {
                workspaceId: "workspace-2",
                terminalId: "terminal-live",
                active: true,
              },
              {
                workspaceId: "workspace-2",
                terminalId: "terminal-old",
                active: false,
              },
            ],
          }),
        ],
        unknown: [{ issueId: "NOT-3", code: "TASK_UNAVAILABLE", detail: "timeout" }],
      },
      selectedIssues,
      {
        expectedContext: rawContext,
      },
    );

    expect(value.scope).toEqual({
      mode: "targeted",
      requestedIssueIds: ["NOT-2", "NOT-3"],
    });
    expect(value.context).toEqual({
      targetHostId: "host-1",
      supersetProjectId: "superset-project",
      linearProjectId: "linear-project",
    });
    expect(value.matches).toEqual([
      {
        issueId: "NOT-2",
        taskId: "task-2",
        workspaceIds: ["workspace-2"],
        terminalIds: ["terminal-live", "terminal-old"],
        activeTerminalIds: ["terminal-live"],
        exitedTerminalIds: ["terminal-old"],
        dataState: "known",
      },
      {
        issueId: "NOT-3",
        workspaceIds: [],
        terminalIds: [],
        activeTerminalIds: [],
        exitedTerminalIds: [],
        dataState: "unknown",
      },
    ]);
  });

  test("normalizes only the exact selected scope and terminal states", () => {
    const value = validateRuntimeSnapshot(snapshot(), selectedIssues);

    expect(value.scope.requestedIssueIds).toEqual(["NOT-2", "NOT-3"]);
    expect(value.matches.map((match) => match.issueId)).toEqual(["NOT-2", "NOT-3"]);
    expect(value.matches[0]).toMatchObject({
      workspaceIds: ["workspace-2"],
      terminalIds: ["terminal-live", "terminal-old"],
      activeTerminalIds: ["terminal-live"],
      exitedTerminalIds: ["terminal-old"],
    });
  });

  test("rejects expanded and incomplete agent scopes", () => {
    expect(() =>
      validateRuntimeSnapshot(
        snapshot({
          scope: {
            mode: "targeted",
            requestedIssueIds: ["NOT-2", "NOT-3", "NOT-999"],
          },
        }),
        selectedIssues,
      ),
    ).toThrow("RUNTIME_SCOPE_MISMATCH");

    expect(() =>
      validateRuntimeSnapshot(
        snapshot({ matches: snapshot().matches.filter((match) => match.issueId !== "NOT-3") }),
        selectedIssues,
      ),
    ).toThrow("RUNTIME_MATCH_SCOPE_MISMATCH");

    expect(() =>
      validateRuntimeSnapshot(
        {
          schemaVersion: 1,
          provider: "partial",
          context: rawContext,
          scope: { selectedIssueIds: ["NOT-2", "NOT-3"] },
          issues: [rawIssue("NOT-2", { taskId: "task-2" })],
          unknown: [],
        },
        selectedIssues,
      ),
    ).toThrow("RUNTIME_MATCH_SCOPE_MISMATCH");
  });

  test("requires caller-owned scope evidence", () => {
    expect(() => validateRuntimeSnapshot(snapshot())).toThrow("RUNTIME_EXPECTED_SCOPE_REQUIRED");
  });

  test("binds raw runtime evidence to the requested host and projects", () => {
    const raw = {
      schemaVersion: 1,
      provider: "ready",
      scope: { selectedIssueIds: ["NOT-2", "NOT-3"] },
      issues: [rawIssue("NOT-2", { taskId: "task-2" }), rawIssue("NOT-3", { taskId: "task-3" })],
      unknown: [],
    };
    const expectedContext = rawContext;

    expect(() => validateRuntimeSnapshot(raw, selectedIssues, { expectedContext })).toThrow(
      "RUNTIME_CONTEXT_MISSING",
    );
    expect(() =>
      validateRuntimeSnapshot(
        { ...raw, context: { ...expectedContext, targetHostId: "host-other" } },
        selectedIssues,
        { expectedContext },
      ),
    ).toThrow("RUNTIME_CONTEXT_MISMATCH");
  });

  test("requires canonical provider evidence at the agent boundary", () => {
    const raw = {
      schemaVersion: 1,
      context: rawContext,
      scope: { selectedIssueIds: ["NOT-2", "NOT-3"] },
      issues: [rawIssue("NOT-2", { taskId: "task-2" }), rawIssue("NOT-3", { taskId: "task-3" })],
      unknown: [],
    };

    expect(() => validateRuntimeSnapshot(raw, selectedIssues)).toThrow(
      "RUNTIME_PROVIDER_STATE_REQUIRED",
    );
    expect(() => validateRuntimeSnapshot(snapshot(), selectedIssues, { requireRaw: true })).toThrow(
      "RUNTIME_RAW_ENVELOPE_REQUIRED",
    );
    expect(() =>
      validateRuntimeSnapshot(
        {
          ...raw,
          provider: "ready",
          scope: { mode: "targeted", requestedIssueIds: ["NOT-2", "NOT-3"] },
        },
        selectedIssues,
      ),
    ).toThrow("RUNTIME_RAW_SCOPE_INVALID");
  });

  test("rejects task and workspace binding facts that do not match exact context", () => {
    const canonical = (issueRow) => ({
      schemaVersion: 1,
      provider: "ready",
      context: rawContext,
      scope: { selectedIssueIds: ["NOT-3"] },
      issues: [issueRow],
      unknown: [],
    });
    const selected = [selectedIssues[1]];

    expect(() =>
      validateRuntimeSnapshot(
        canonical({
          ...rawIssue("NOT-3"),
          task: { ...rawTask("NOT-3"), externalKey: "NOT-OTHER" },
        }),
        selected,
      ),
    ).toThrow("RUNTIME_TASK_BINDING_MISMATCH");
    expect(() =>
      validateRuntimeSnapshot(
        canonical({
          ...rawIssue("NOT-3"),
          task: { ...rawTask("NOT-3"), deletedAt: "2026-08-30T10:00:00Z" },
        }),
        selected,
      ),
    ).toThrow("RUNTIME_TASK_UNUSABLE");
    expect(() =>
      validateRuntimeSnapshot(
        canonical({
          ...rawIssue("NOT-3", { workspaceIds: ["workspace-3"] }),
          workspaces: [
            {
              ...rawWorkspace("workspace-3", "task-NOT-3"),
              hostId: "host-other",
            },
          ],
        }),
        selected,
      ),
    ).toThrow("RUNTIME_WORKSPACE_BINDING_MISMATCH");
  });

  test("binds project-less task evidence to the exact manual issue scope", () => {
    const context = { ...rawContext, linearProjectId: "manual:NOT-3" };
    const manualTask = { ...rawTask("NOT-3"), externalProjectId: null };
    const envelope = {
      schemaVersion: 1,
      provider: "ready",
      context,
      scope: { selectedIssueIds: ["NOT-3"] },
      issues: [
        {
          issueId: "NOT-3",
          task: manualTask,
          workspaces: [],
          terminals: [],
          dataState: "known",
        },
      ],
      unknown: [],
    };

    expect(
      validateRuntimeSnapshot(envelope, [selectedIssues[1]], { expectedContext: context })
        .matches[0].taskId,
    ).toBe("task-NOT-3");
    const { externalProjectId: _externalProjectId, ...taskWithoutProject } = manualTask;
    expect(
      validateRuntimeSnapshot(
        { ...envelope, issues: [{ ...envelope.issues[0], task: taskWithoutProject }] },
        [selectedIssues[1]],
        { expectedContext: context },
      ).matches[0].taskId,
    ).toBe("task-NOT-3");
    expect(() =>
      validateRuntimeSnapshot(
        {
          ...envelope,
          issues: [{ ...envelope.issues[0], task: { ...manualTask, externalProjectId: "p" } }],
        },
        [selectedIssues[1]],
        { expectedContext: context },
      ),
    ).toThrow("RUNTIME_TASK_PROJECT_MISMATCH");
    expect(() =>
      validateRuntimeSnapshot(
        {
          ...envelope,
          context: { ...context, linearProjectId: "manual:NOT-OTHER" },
          issues: [{ ...envelope.issues[0], task: taskWithoutProject }],
        },
        [selectedIssues[1]],
      ),
    ).toThrow("RUNTIME_TASK_PROJECT_MISMATCH");
  });

  test("never accepts terminal or blocked issues into runtime planning", () => {
    for (const classification of ["terminal", "blocked", "unknown"]) {
      expect(() =>
        validateRuntimeSnapshot(snapshot(), [
          { issueId: "NOT-2", classification, blockerIssueIds: [] },
          selectedIssues[1],
        ]),
      ).toThrow(
        classification === "terminal"
          ? "RUNTIME_TERMINAL_SELECTION_FORBIDDEN"
          : "RUNTIME_NON_CANDIDATE_SELECTION_FORBIDDEN",
      );
    }
  });

  test("validates blocked and unknown rows only through the separate forensic audit boundary", () => {
    const auditRows = [
      { issueId: "NOT-BLOCKED", classification: "blocked", blockerIssueIds: ["NOT-BLOCKER"] },
      { issueId: "NOT-UNKNOWN", classification: "unknown", blockerIssueIds: [] },
    ];
    const raw = rawSnapshot(["NOT-UNKNOWN", "NOT-BLOCKED"]);

    const audited = validateRuntimeAuditSnapshot(raw, auditRows, {
      expectedContext: rawContext,
    });

    expect(audited.matches.map((match) => match.issueId)).toEqual(["NOT-BLOCKED", "NOT-UNKNOWN"]);
    expect(() =>
      validateRuntimeSnapshot(raw, auditRows, {
        expectedContext: rawContext,
        requireRaw: true,
      }),
    ).toThrow("RUNTIME_NON_CANDIDATE_SELECTION_FORBIDDEN");
  });

  test("the forensic audit boundary rejects terminal, normalized, mismatched, and inexact evidence", () => {
    const selectedRows = [{ issueId: "NOT-AUDIT", classification: "blocked", blockerIssueIds: [] }];
    const raw = rawSnapshot(["NOT-AUDIT"]);

    expect(() =>
      validateRuntimeAuditSnapshot(
        raw,
        [{ issueId: "NOT-AUDIT", classification: "terminal", blockerIssueIds: [] }],
        {
          expectedContext: rawContext,
        },
      ),
    ).toThrow("RUNTIME_TERMINAL_SELECTION_FORBIDDEN");
    expect(() =>
      validateRuntimeAuditSnapshot(snapshot(), selectedRows, { expectedContext: rawContext }),
    ).toThrow("RUNTIME_RAW_ENVELOPE_REQUIRED");
    expect(() =>
      validateRuntimeAuditSnapshot(
        { ...raw, scope: { selectedIssueIds: ["NOT-AUDIT", "NOT-EXTRA"] } },
        selectedRows,
        { expectedContext: rawContext },
      ),
    ).toThrow("RUNTIME_SCOPE_MISMATCH");
    expect(() =>
      validateRuntimeAuditSnapshot({ ...raw, issues: [] }, selectedRows, {
        expectedContext: rawContext,
      }),
    ).toThrow("RUNTIME_MATCH_SCOPE_MISMATCH");
    expect(() =>
      validateRuntimeAuditSnapshot(raw, selectedRows, {
        expectedContext: { ...rawContext, targetHostId: "host-other" },
      }),
    ).toThrow("RUNTIME_CONTEXT_MISMATCH");
    expect(() => validateRuntimeAuditSnapshot(raw, selectedRows)).toThrow(
      "RUNTIME_EXPECTED_CONTEXT_REQUIRED",
    );
  });

  test("isolates a malformed raw row with its exact issue id", () => {
    const selectedRows = [
      { issueId: "NOT-A", classification: "blocked", blockerIssueIds: [] },
      { issueId: "NOT-B", classification: "unknown", blockerIssueIds: [] },
    ];
    const raw = rawSnapshot(["NOT-A", "NOT-B"], {
      issues: [
        rawIssue("NOT-A"),
        {
          ...rawIssue("NOT-B", { workspaceIds: ["workspace-b"] }),
          workspaces: [
            {
              ...rawWorkspace("workspace-b", "task-NOT-B"),
              hostId: "host-other",
            },
          ],
        },
      ],
    });

    try {
      validateRuntimeAuditSnapshot(raw, selectedRows, { expectedContext: rawContext });
      throw new Error("expected malformed row");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeSnapshotValidationError);
      expect(error.code).toBe("RUNTIME_WORKSPACE_BINDING_MISMATCH");
      expect(error.issueIds).toEqual(["NOT-B"]);
    }

    const cli = Bun.spawnSync({
      cmd: [
        process.execPath,
        path.resolve(import.meta.dir, "..", "scripts", "runtime-snapshot.mjs"),
        "validate-audit",
      ],
      stdin: new Blob([
        JSON.stringify({ runtimeSnapshot: raw, selectedRows, expectedContext: rawContext }),
      ]),
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(cli.exitCode).toBe(1);
    expect(JSON.parse(cli.stdout.toString())).toMatchObject({
      error: { code: "RUNTIME_WORKSPACE_BINDING_MISMATCH", issueIds: ["NOT-B"] },
    });
  });

  test("merges one exact retry before validating the complete raw runtime envelope", () => {
    const selectedRows = [
      { issueId: "NOT-A", classification: "blocked", blockerIssueIds: [] },
      { issueId: "NOT-B", classification: "unknown", blockerIssueIds: [] },
    ];
    const malformedInitial = rawSnapshot(["NOT-A", "NOT-B"], {
      issues: [
        rawIssue("NOT-A"),
        {
          ...rawIssue("NOT-B", { workspaceIds: ["workspace-b"] }),
          workspaces: [
            {
              ...rawWorkspace("workspace-b", "task-NOT-B"),
              hostId: "host-other",
            },
          ],
        },
      ],
    });
    const retry = rawSnapshot(["NOT-B"], {
      provider: "unavailable",
      issues: [],
      unknown: [{ issueId: "NOT-B", code: "SUPERSET_UNAVAILABLE", detail: "retry exhausted" }],
    });

    const merged = mergeTargetedRuntimeSnapshot(malformedInitial, retry, {
      selectedRows,
      retryIssueIds: ["NOT-B"],
      expectedContext: rawContext,
    });

    expect(merged).toMatchObject({
      provider: "partial",
      scope: { selectedIssueIds: ["NOT-A", "NOT-B"] },
      issues: [{ issueId: "NOT-A" }],
      unknown: [{ issueId: "NOT-B", code: "SUPERSET_UNAVAILABLE" }],
    });
    expect(
      validateRuntimeAuditSnapshot(merged, selectedRows, { expectedContext: rawContext }).matches,
    ).toMatchObject([
      { issueId: "NOT-A", dataState: "known" },
      { issueId: "NOT-B", dataState: "unknown" },
    ]);
  });

  test("isolates an exact persistently malformed retry as scoped unknown", () => {
    const selectedRows = [
      { issueId: "NOT-A", classification: "blocked", blockerIssueIds: [] },
      { issueId: "NOT-B", classification: "unknown", blockerIssueIds: [] },
    ];
    const malformedInitial = rawSnapshot(["NOT-A", "NOT-B"], {
      issues: [
        rawIssue("NOT-A"),
        {
          ...rawIssue("NOT-B"),
          task: { ...rawTask("NOT-B"), externalKey: "NOT-WRONG" },
        },
      ],
    });

    const merged = mergeTargetedRuntimeSnapshotUnknown(malformedInitial, {
      selectedRows,
      retryIssueIds: ["NOT-B"],
      expectedContext: rawContext,
      code: "RUNTIME_RETRY_INVALID",
      detail: "the exact retry remained malformed",
    });

    expect(merged).toMatchObject({
      provider: "partial",
      issues: [{ issueId: "NOT-A" }],
      unknown: [{ issueId: "NOT-B", code: "RUNTIME_RETRY_INVALID" }],
    });
    expect(
      validateRuntimeAuditSnapshot(merged, selectedRows, { expectedContext: rawContext }).matches,
    ).toMatchObject([
      { issueId: "NOT-A", dataState: "known" },
      { issueId: "NOT-B", dataState: "unknown" },
    ]);
  });

  test("rejects expanded, mismatched-context, and omitted targeted runtime retries", () => {
    const selectedRows = [
      { issueId: "NOT-A", classification: "blocked", blockerIssueIds: [] },
      { issueId: "NOT-B", classification: "unknown", blockerIssueIds: [] },
    ];
    const initial = rawSnapshot(["NOT-A", "NOT-B"]);
    const options = {
      selectedRows,
      retryIssueIds: ["NOT-B"],
      expectedContext: rawContext,
    };

    expect(() =>
      mergeTargetedRuntimeSnapshot(initial, rawSnapshot(["NOT-B", "NOT-EXTRA"]), options),
    ).toThrow("RUNTIME_SCOPE_MISMATCH");
    expect(() =>
      mergeTargetedRuntimeSnapshot(
        initial,
        rawSnapshot(["NOT-B"], {
          context: { ...rawContext, targetHostId: "host-other" },
        }),
        options,
      ),
    ).toThrow("RUNTIME_CONTEXT_MISMATCH");
    expect(() =>
      mergeTargetedRuntimeSnapshot(
        initial,
        rawSnapshot(["NOT-B"], { issues: [], unknown: [] }),
        options,
      ),
    ).toThrow("RUNTIME_MATCH_SCOPE_MISMATCH");
  });

  test("the audit CLI exposes only strict forensic validation", () => {
    const script = path.resolve(import.meta.dir, "..", "scripts", "runtime-snapshot.mjs");
    const payload = {
      runtimeSnapshot: rawSnapshot(["NOT-AUDIT"]),
      selectedRows: [{ issueId: "NOT-AUDIT", classification: "blocked", blockerIssueIds: [] }],
      expectedContext: rawContext,
    };
    const valid = Bun.spawnSync({
      cmd: [process.execPath, script, "validate-audit"],
      stdin: new Blob([JSON.stringify(payload)]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const normalizedBypass = Bun.spawnSync({
      cmd: [process.execPath, script, "validate-audit"],
      stdin: new Blob([
        JSON.stringify({
          ...payload,
          runtimeSnapshot: {
            schemaVersion: 1,
            scope: { mode: "targeted", requestedIssueIds: ["NOT-AUDIT"] },
            matches: [
              {
                issueId: "NOT-AUDIT",
                workspaceIds: [],
                terminalIds: [],
                dataState: "known",
              },
            ],
            unknown: [],
          },
        }),
      ]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const merge = Bun.spawnSync({
      cmd: [process.execPath, script, "merge-targeted"],
      stdin: new Blob([
        JSON.stringify({
          runtimeSnapshot: rawSnapshot(["NOT-AUDIT"], {
            provider: "unavailable",
            issues: [],
            unknown: [
              {
                issueId: "NOT-AUDIT",
                code: "SUPERSET_UNAVAILABLE",
                detail: "initial attempt failed",
              },
            ],
          }),
          retrySnapshot: rawSnapshot(["NOT-AUDIT"]),
          selectedRows: payload.selectedRows,
          retryIssueIds: ["NOT-AUDIT"],
          expectedContext: rawContext,
        }),
      ]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const mergeUnknown = Bun.spawnSync({
      cmd: [process.execPath, script, "merge-targeted-unknown"],
      stdin: new Blob([
        JSON.stringify({
          runtimeSnapshot: {
            ...rawSnapshot(["NOT-AUDIT"]),
            issues: [
              {
                ...rawIssue("NOT-AUDIT"),
                task: { ...rawTask("NOT-AUDIT"), externalKey: "NOT-WRONG" },
              },
            ],
          },
          selectedRows: payload.selectedRows,
          retryIssueIds: ["NOT-AUDIT"],
          expectedContext: rawContext,
          code: "RUNTIME_RETRY_INVALID",
          detail: "retry remained malformed",
        }),
      ]),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(valid.exitCode).toBe(0);
    expect(JSON.parse(valid.stdout.toString())).toMatchObject({
      ok: true,
      snapshot: { matches: [{ issueId: "NOT-AUDIT", taskId: "task-NOT-AUDIT" }] },
    });
    expect(normalizedBypass.exitCode).toBe(1);
    expect(JSON.parse(normalizedBypass.stdout.toString())).toMatchObject({
      ok: false,
      error: { code: "RUNTIME_RAW_ENVELOPE_REQUIRED" },
    });
    expect(merge.exitCode).toBe(0);
    expect(JSON.parse(merge.stdout.toString())).toMatchObject({
      ok: true,
      runtimeSnapshot: {
        provider: "ready",
        issues: [{ issueId: "NOT-AUDIT" }],
        unknown: [],
      },
    });
    expect(mergeUnknown.exitCode).toBe(0);
    expect(JSON.parse(mergeUnknown.stdout.toString())).toMatchObject({
      ok: true,
      runtimeSnapshot: {
        provider: "unavailable",
        issues: [],
        unknown: [{ issueId: "NOT-AUDIT", code: "RUNTIME_RETRY_INVALID" }],
      },
    });
  });

  test("rejects contradictory terminal identity without inventing runtime state", () => {
    expect(() =>
      validateRuntimeMatch({
        issueId: "NOT-2",
        taskId: "task-2",
        workspaceIds: ["workspace-2"],
        terminalIds: ["terminal-old"],
        activeTerminalIds: ["terminal-other"],
        dataState: "known",
      }),
    ).toThrow("RUNTIME_TERMINAL_SCOPE_MISMATCH");

    expect(() =>
      validateRuntimeMatch({
        issueId: "NOT-2",
        taskId: "task-2",
        workspaceIds: [],
        terminalIds: ["terminal-orphan"],
        dataState: "known",
      }),
    ).toThrow("RUNTIME_TERMINAL_WITHOUT_WORKSPACE");

    expect(() =>
      validateRuntimeMatch({
        issueId: "NOT-2",
        taskId: "task-2",
        workspaceIds: ["workspace-untrusted"],
        terminalIds: [],
        dataState: "unknown",
      }),
    ).toThrow("RUNTIME_UNKNOWN_FACT_CONTRADICTION");

    expect(() =>
      validateRuntimeSnapshot(
        {
          schemaVersion: 1,
          provider: "ready",
          context: rawContext,
          scope: { selectedIssueIds: ["NOT-2", "NOT-3"] },
          issues: [
            {
              issueId: "NOT-2",
              task: rawTask("NOT-2", "task-2"),
              workspaces: [rawWorkspace("workspace-2", "task-2")],
              terminals: [
                {
                  workspaceId: "workspace-other",
                  terminalId: "terminal-2",
                  active: true,
                },
              ],
              dataState: "known",
            },
            rawIssue("NOT-3", { taskId: "task-3" }),
          ],
          unknown: [],
        },
        selectedIssues,
      ),
    ).toThrow("RUNTIME_TERMINAL_WORKSPACE_MISMATCH");
  });

  test("rejects provider uncertainty that contradicts known match data", () => {
    expect(() =>
      validateRuntimeSnapshot(
        snapshot({
          unknown: [{ code: "SUPERSET_UNAVAILABLE", detail: "provider timed out" }],
        }),
        selectedIssues,
      ),
    ).toThrow("RUNTIME_UNKNOWN_STATE_CONTRADICTION");
  });

  test("exposes stable validation codes", () => {
    try {
      validateRuntimeSnapshot({ ...snapshot(), schemaVersion: 2 }, selectedIssues);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeSnapshotValidationError);
      expect(error.code).toBe("RUNTIME_SNAPSHOT_SCHEMA_INVALID");
    }
  });
});
