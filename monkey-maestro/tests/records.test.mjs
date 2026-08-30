import { describe, expect, test } from "bun:test";

import {
  buildExecutionRecord,
  buildDispatchAuthorization,
  buildWorkerResultRecord,
  buildWaiverRecord,
  RecordValidationError,
  buildControlRecord,
  hashDecisionBaseline,
  parseControlRecord,
  parseExecutionRecord,
  parseWorkerResultRecord,
  parseWaiverRecord,
  resolveControlAuthority,
  serializeRecord,
  validateDispatchAuthorization,
} from "../lib/records.mjs";

const decisionBaseline = {
  issueIds: ["issue-b", "issue-a"],
  edges: [{ dependentIssueId: "issue-b", blockerIssueId: "issue-a" }],
};

const controlInput = {
  projectId: "project-1",
  runId: "run-1",
  active: true,
  repository: "org/repo",
  supersetProjectId: "superset-project",
  targetHostId: "host-1",
  defaultAgent: "codex",
  decisionBaseline,
  graphHash: `sha256:${"b".repeat(64)}`,
  updatedAt: "2026-08-27T10:00:00.000Z",
};

describe("Maestro control records", () => {
  test("defaults concurrency to four and starts at revision one", () => {
    expect(buildControlRecord(controlInput)).toEqual({
      marker: "nuthouse:maestro-control",
      schemaVersion: 1,
      projectId: "project-1",
      runId: "run-1",
      active: true,
      repository: "org/repo",
      supersetProjectId: "superset-project",
      targetHostId: "host-1",
      defaultAgent: "codex",
      maxConcurrency: 4,
      executionIssueIds: [],
      exitedExecutionIssueIds: [],
      decisionBaseline: {
        issueIds: ["issue-a", "issue-b"],
        edges: [{ dependentIssueId: "issue-b", blockerIssueId: "issue-a" }],
      },
      decisionHash: hashDecisionBaseline(decisionBaseline),
      graphHash: `sha256:${"b".repeat(64)}`,
      revision: 1,
      updatedAt: "2026-08-27T10:00:00.000Z",
    });
  });

  test("increments an existing revision and preserves an explicit limit", () => {
    const existing = buildControlRecord({
      ...controlInput,
      executionIssueIds: ["issue-b", "issue-a"],
    });
    const next = buildControlRecord({ ...controlInput, maxConcurrency: 10 }, existing);
    expect(next.maxConcurrency).toBe(10);
    expect(next.revision).toBe(2);
    expect(next.executionIssueIds).toEqual(["issue-a", "issue-b"]);
    expect(next.exitedExecutionIssueIds).toEqual([]);
  });

  test("preserves explicit exited execution tombstones without overlap", () => {
    const existing = buildControlRecord({
      ...controlInput,
      exitedExecutionIssueIds: ["issue-old"],
    });
    expect(buildControlRecord(controlInput, existing).exitedExecutionIssueIds).toEqual([
      "issue-old",
    ]);
    expect(() =>
      buildControlRecord({
        ...controlInput,
        executionIssueIds: ["issue-old"],
        exitedExecutionIssueIds: ["issue-old"],
      }),
    ).toThrow("both active and confirmed exited");
  });

  test.each([0, 11, 1.5])("rejects invalid concurrency %s", (maxConcurrency) => {
    expect(() => buildControlRecord({ ...controlInput, maxConcurrency })).toThrow(
      RecordValidationError,
    );
  });

  test("round trips through a Linear markdown comment", () => {
    const record = buildControlRecord(controlInput);
    expect(parseControlRecord(serializeRecord(record))).toEqual(record);
  });

  test("binds the decision hash to the exact normalized baseline", () => {
    expect(() =>
      buildControlRecord({ ...controlInput, decisionHash: `sha256:${"a".repeat(64)}` }),
    ).toThrow("decisionHash does not match");
  });

  test("fails closed on unknown schema versions", () => {
    const record = { ...buildControlRecord(controlInput), schemaVersion: 2 };
    const body = `<!-- nuthouse:maestro-control schema_version=2 -->\n\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n`;
    expect(() => parseControlRecord(body)).toThrow("unsupported schemaVersion");
    expect(() => serializeRecord(record)).toThrow("unsupported schemaVersion");
  });

  test("does not hide a newer invalid control behind an older valid revision", () => {
    const older = buildControlRecord(controlInput);
    const newer = { ...buildControlRecord(controlInput, older), maxConcurrency: 99 };
    const newerBody = `<!-- nuthouse:maestro-control schema_version=1 -->\n\n\`\`\`json\n${JSON.stringify(newer)}\n\`\`\`\n`;

    expect(
      resolveControlAuthority([
        { id: "control-old", body: serializeRecord(older) },
        { id: "control-new-invalid", body: newerBody },
      ]),
    ).toMatchObject({
      status: "invalid",
      code: "CONTROL_INVALID",
      control: null,
      controlCommentId: "control-new-invalid",
      revision: 2,
    });
  });

  test("treats duplicate highest claimed revisions as ambiguous", () => {
    const control = buildControlRecord(controlInput);
    expect(
      resolveControlAuthority([
        { id: "control-a", body: serializeRecord(control) },
        { id: "control-b", body: serializeRecord({ ...control, runId: "run-2" }) },
      ]),
    ).toEqual({
      status: "ambiguous",
      code: "CONTROL_AMBIGUOUS",
      control: null,
      controlCommentId: null,
      controlCommentIds: ["control-a", "control-b"],
      revision: 1,
    });
  });
});

describe("execution and waiver records", () => {
  test("requires a terminal for a verified execution", () => {
    expect(() =>
      buildExecutionRecord({
        issueId: "issue-1",
        runId: "run-1",
        outcome: "verified",
        workspaceId: "workspace-1",
        taskId: "issue-1",
        branch: "user/issue-1",
        agent: "codex",
        hostId: "host-1",
        recordedAt: "2026-08-27T10:00:00.000Z",
      }),
    ).toThrow("terminalId");
  });

  test("accepts a partial execution without a terminal", () => {
    const record = buildExecutionRecord({
      issueId: "OPS-7",
      runId: "run-1",
      outcome: "partial",
      workspaceId: "workspace-1",
      taskId: "b62203f2-ed5c-4fea-870a-78ae217fc388",
      branch: "user/issue-1",
      agent: "codex",
      hostId: "host-1",
      recordedAt: "2026-08-27T10:00:00.000Z",
      detail: "agent launch failed",
    });
    expect(parseExecutionRecord(serializeRecord(record))).toEqual(record);
  });

  test("requires a non-empty Superset task id without conflating it with the Linear identifier", () => {
    expect(() =>
      buildExecutionRecord({
        issueId: "OPS-7",
        runId: "run-1",
        outcome: "partial",
        workspaceId: "workspace-1",
        taskId: "",
        branch: "user/issue-1",
        agent: "codex",
        hostId: "host-1",
        recordedAt: "2026-08-27T10:00:00.000Z",
      }),
    ).toThrow("taskId must be a non-empty string");
  });

  test("parses an exact non-revoked blocker waiver", () => {
    const record = buildWaiverRecord({
      dependentIssueId: "issue-2",
      blockerIssueId: "issue-1",
      reason: "work intentionally abandoned",
      approver: "human@example.com",
      approvedAt: "2026-08-27T10:00:00.000Z",
    });
    expect(parseWaiverRecord(serializeRecord(record))).toEqual(record);
  });

  test("rejects revoked or incomplete waivers", () => {
    const record = {
      marker: "nuthouse:maestro-waiver",
      schemaVersion: 1,
      dependentIssueId: "issue-2",
      blockerIssueId: "issue-1",
      reason: "work intentionally abandoned",
      approver: "human@example.com",
      approvedAt: "2026-08-27T10:00:00.000Z",
      revokedAt: "2026-08-27T11:00:00.000Z",
    };
    expect(() => serializeRecord(record)).toThrow("revoked");
  });

  test("rejects a waiver for a self-edge", () => {
    expect(() =>
      buildWaiverRecord({
        dependentIssueId: "issue-1",
        blockerIssueId: "issue-1",
        reason: "invalid",
        approver: "human@example.com",
        approvedAt: "2026-08-27T10:00:00.000Z",
      }),
    ).toThrow("self-edge");
  });
});

describe("worker result records", () => {
  test("round trips a completed Superset worker envelope", () => {
    const record = buildWorkerResultRecord({
      issueId: "OPS-7",
      runId: "run-1",
      workspaceId: "workspace-1",
      terminalId: "terminal-1",
      outcome: "completed",
      summary: "Implemented the issue and opened its pull request",
      files: ["src/example.ts", "src/example.test.ts"],
      checks: "bun test: passed",
      handoff: "PR #42",
      recordedAt: "2026-08-27T12:00:00.000Z",
    });

    expect(parseWorkerResultRecord(serializeRecord(record))).toEqual(record);
  });

  test("requires actionable evidence for blocked results", () => {
    expect(() =>
      buildWorkerResultRecord({
        issueId: "OPS-7",
        runId: "run-1",
        workspaceId: "workspace-1",
        terminalId: "terminal-1",
        outcome: "blocked",
        reason: "",
        needs: "API credentials",
        recordedAt: "2026-08-27T12:00:00.000Z",
      }),
    ).toThrow("reason");
  });
});

describe("dispatch authorization", () => {
  const authorizationInput = {
    projectId: "project-1",
    runId: "run-1",
    revision: 3,
    decisionHash: `sha256:${"c".repeat(64)}`,
    lockToken: "lock-1",
    issueId: "issue-2",
    taskId: "task-2",
    eligibility: {
      issueId: "issue-2",
      projectId: "project-1",
      statusType: "unstarted",
      blockers: [{ issueId: "issue-1", statusType: "completed", waiverApproved: false }],
    },
  };

  test("hash-binds one eligible issue to control, lock, and fresh blocker facts", () => {
    const authorization = buildDispatchAuthorization(authorizationInput);
    expect(authorization.authorizationHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(validateDispatchAuthorization(authorization)).toEqual(authorization);

    for (const mutate of [
      (value) => (value.issueId = "wrong-issue"),
      (value) => (value.projectId = "other-project"),
      (value) => (value.revision = 4),
      (value) => (value.lockToken = "lock-2"),
      (value) => (value.taskId = "task-other"),
      (value) => (value.eligibility.statusType = "canceled"),
      (value) => (value.eligibility.blockers[0].statusType = "started"),
    ]) {
      const changed = structuredClone(authorization);
      mutate(changed);
      expect(() => validateDispatchAuthorization(changed)).toThrow();
    }
  });

  test("refuses to mint authorization for an unsatisfied blocker", () => {
    const input = structuredClone(authorizationInput);
    input.eligibility.blockers[0].statusType = "started";
    expect(() => buildDispatchAuthorization(input)).toThrow("unsatisfied blocker");
  });

  test("accepts an exact approved waiver as blocker evidence", () => {
    const input = structuredClone(authorizationInput);
    input.eligibility.blockers[0] = {
      issueId: "issue-1",
      statusType: "canceled",
      waiverApproved: true,
    };
    expect(buildDispatchAuthorization(input).authorizationHash).toMatch(/^sha256:/);
  });
});
