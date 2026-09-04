import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  RecordValidationError,
  buildControlRecord,
  parseControlRecord,
  resolveControlAuthority,
  serializeRecord,
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
  test("the resolve-controls CLI selects comments for the exact project", () => {
    const script = path.resolve(import.meta.dir, "..", "scripts", "records.mjs");
    const comments = [{ id: "comment-1", body: serializeRecord(buildControlRecord(controlInput)) }];
    const result = Bun.spawnSync({
      cmd: [process.execPath, script, "resolve-controls"],
      stdin: new Blob([JSON.stringify({ projectId: "project-1", comments })]),
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
    expect(
      resolveControlAuthority(comments, { expectedProjectId: "another-project" }),
    ).toMatchObject({ status: "invalid", reason: "CONTROL_PROJECT_MISMATCH" });
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

  test.each([undefined, null, "", "   "])(
    "requires a resolved non-empty default agent: %p",
    (defaultAgent) => {
      const input = { ...controlInput };
      if (defaultAgent === undefined) delete input.defaultAgent;
      else input.defaultAgent = defaultAgent;
      expect(() => buildControlRecord(input)).toThrow("defaultAgent");
    },
  );

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
