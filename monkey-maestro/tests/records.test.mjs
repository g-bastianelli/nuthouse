import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  RecordValidationError,
  buildControlRecord,
  buildExecutionRecord,
  buildWaiverRecord,
  buildWorkerResultRecord,
  parseControlRecord,
  parseExecutionRecord,
  parseWorkerResultRecord,
  parseWaiverRecord,
  resolveControlAuthority,
  serializeRecord,
  validateControlSnapshot,
} from "../lib/records.mjs";

const controlInput = {
  projectId: "project-1",
  runId: "run-1",
  active: true,
  targetHostId: "host-1",
  supersetProjectId: "superset-project",
  defaultAgent: "codex",
  updatedAt: "2026-08-27T10:00:00.000Z",
};

function legacyControlBody(overrides = {}) {
  const record = {
    marker: "nuthouse:maestro-control",
    schemaVersion: 1,
    projectId: "project-1",
    runId: "run-legacy",
    active: true,
    repository: "org/repo",
    targetHostId: "host-1",
    supersetProjectId: "superset-project",
    defaultAgent: "codex",
    maxConcurrency: 3,
    revision: 7,
    updatedAt: "2026-08-27T09:00:00.000Z",
    decisionBaseline: "malformed and deliberately ignored",
    decisionHash: 42,
    graphHash: null,
    executionIssueIds: { malformed: true },
    exitedExecutionIssueIds: [null],
    ...overrides,
  };
  return `<!-- nuthouse:maestro-control schema_version=1 -->\n\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n`;
}

describe("Maestro control records", () => {
  test("validates the exact paginated control-loader boundary before resolution", () => {
    const body = serializeRecord(buildControlRecord(controlInput));
    const snapshot = {
      schemaVersion: 1,
      provider: "ready",
      project: { id: "project-1", name: "Project One" },
      comments: [
        {
          id: "comment-1",
          body,
          createdAt: "2026-08-27T10:00:00.000Z",
          updatedAt: "2026-08-27T10:00:00.000Z",
        },
      ],
      unknown: [],
    };

    expect(validateControlSnapshot(snapshot, { expectedProjectId: "project-1" })).toEqual(snapshot);
    expect(() =>
      validateControlSnapshot(snapshot, { expectedProjectId: "another-project" }),
    ).toThrowError(expect.objectContaining({ code: "CONTROL_PROJECT_MISMATCH" }));
    expect(() => validateControlSnapshot({ ...snapshot, schemaVersion: 2 })).toThrowError(
      expect.objectContaining({ code: "CONTROL_SNAPSHOT_INVALID" }),
    );
  });

  test("rejects unavailable or contradictory control-loader evidence", () => {
    const unavailable = {
      schemaVersion: 1,
      provider: "unavailable",
      project: { id: "project-1", name: "Project One" },
      comments: [],
      unknown: [{ code: "LINEAR_UNAVAILABLE", detail: "comment pagination failed" }],
    };

    expect(() => validateControlSnapshot(unavailable)).toThrowError(
      expect.objectContaining({ code: "CONTROL_PROVIDER_UNAVAILABLE" }),
    );
    expect(() => validateControlSnapshot({ ...unavailable, provider: "ready" })).toThrowError(
      expect.objectContaining({ code: "CONTROL_SNAPSHOT_CONTRADICTION" }),
    );
  });

  test("the resolve-controls CLI requires the full loader envelope and exact project", () => {
    const script = path.resolve(import.meta.dir, "..", "scripts", "records.mjs");
    const snapshot = {
      schemaVersion: 1,
      provider: "ready",
      project: { id: "project-1", name: "Project One" },
      comments: [
        {
          id: "comment-1",
          body: serializeRecord(buildControlRecord(controlInput)),
          createdAt: "2026-08-27T10:00:00.000Z",
          updatedAt: "2026-08-27T10:00:00.000Z",
        },
      ],
      unknown: [],
    };
    const result = Bun.spawnSync({
      cmd: [process.execPath, script, "resolve-controls"],
      stdin: new Blob([JSON.stringify({ snapshot, expectedProjectId: "project-1" })]),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toMatchObject({
      ok: true,
      authority: {
        status: "valid",
        sourceSchemaVersion: 2,
        control: { schemaVersion: 2, projectId: "project-1" },
      },
    });
    expect(result.stderr.toString()).toBe("");
  });

  test("writes exactly the minimal v2 control fields", () => {
    expect(buildControlRecord(controlInput)).toEqual({
      schemaVersion: 2,
      projectId: "project-1",
      runId: "run-1",
      active: true,
      targetHostId: "host-1",
      supersetProjectId: "superset-project",
      defaultAgent: "codex",
      maxConcurrency: 4,
      revision: 1,
      updatedAt: "2026-08-27T10:00:00.000Z",
    });
  });

  test("inherits operational policy and increments revision for stop", () => {
    const existing = buildControlRecord({ ...controlInput, maxConcurrency: 10 });
    const next = buildControlRecord(
      { active: false, updatedAt: "2026-08-27T10:05:00.000Z" },
      existing,
    );
    expect(next).toEqual({
      ...existing,
      active: false,
      revision: 2,
      updatedAt: "2026-08-27T10:05:00.000Z",
    });
  });

  test.each([0, 11, 1.5])("rejects invalid concurrency %s", (maxConcurrency) => {
    expect(() => buildControlRecord({ ...controlInput, maxConcurrency })).toThrow(
      RecordValidationError,
    );
  });

  test("round trips through a Linear markdown comment", () => {
    const record = buildControlRecord(controlInput);
    const body = serializeRecord(record);
    expect(body).toContain("schema_version=2");
    expect(parseControlRecord(body)).toEqual(record);
  });

  test("projects a usable v1 control while ignoring every malformed obsolete field", () => {
    expect(parseControlRecord(legacyControlBody())).toEqual({
      schemaVersion: 2,
      projectId: "project-1",
      runId: "run-legacy",
      active: true,
      targetHostId: "host-1",
      supersetProjectId: "superset-project",
      defaultAgent: "codex",
      maxConcurrency: 3,
      revision: 7,
      updatedAt: "2026-08-27T09:00:00.000Z",
    });
  });

  test("retains the source schema version beside a projected active control", () => {
    expect(
      resolveControlAuthority([{ id: "control-v1", body: legacyControlBody() }]),
    ).toMatchObject({
      status: "valid",
      sourceSchemaVersion: 1,
      control: {
        schemaVersion: 2,
        active: true,
        revision: 7,
      },
    });
  });

  test("migrates v1 operational fields on the next explicit write", () => {
    const legacy = parseControlRecord(legacyControlBody());
    const next = buildControlRecord(
      { active: false, updatedAt: "2026-08-27T11:00:00.000Z" },
      legacy,
    );
    expect(next).toEqual({
      ...legacy,
      schemaVersion: 2,
      active: false,
      revision: 8,
      updatedAt: "2026-08-27T11:00:00.000Z",
    });
  });

  test("rejects missing operational v1 fields and obsolete v2 fields", () => {
    expect(() => parseControlRecord(legacyControlBody({ targetHostId: null }))).toThrow(
      "targetHostId",
    );
    expect(() =>
      serializeRecord({ ...buildControlRecord(controlInput), decisionHash: "obsolete" }),
    ).toThrow("unsupported fields: decisionHash");
  });

  test("fails closed on unknown or mismatched schema versions", () => {
    const record = { ...buildControlRecord(controlInput), schemaVersion: 3 };
    const body = `<!-- nuthouse:maestro-control schema_version=3 -->\n\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n`;
    expect(() => parseControlRecord(body)).toThrow("unsupported schemaVersion");

    const mismatch = `<!-- nuthouse:maestro-control schema_version=1 -->\n\n\`\`\`json\n${JSON.stringify(buildControlRecord(controlInput))}\n\`\`\`\n`;
    expect(() => parseControlRecord(mismatch)).toThrow("schema versions differ");
  });

  test("does not hide a newer invalid control behind an older valid revision", () => {
    const older = buildControlRecord(controlInput);
    const newer = { ...buildControlRecord(controlInput, older), maxConcurrency: 99 };
    const newerBody = `<!-- nuthouse:maestro-control schema_version=2 -->\n\n\`\`\`json\n${JSON.stringify(newer)}\n\`\`\`\n`;

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
