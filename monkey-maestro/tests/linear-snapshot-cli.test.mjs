import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const CLI = path.resolve(import.meta.dir, "..", "scripts", "linear-snapshot.mjs");
const projectId = "project-1";

function issue(issueId, statusType, blockerIssueIds = [], dataState = "known") {
  return { issueId, projectId, statusType, blockerIssueIds, dataState };
}

function fullSnapshot() {
  return {
    schemaVersion: 1,
    projectId,
    scope: { mode: "full", requestedIssueIds: [] },
    issues: [issue("NOT-1", "unstarted"), issue("NOT-2", "unknown", [], "unknown")],
    unknown: [{ issueId: "NOT-2", code: "STATUS_UNAVAILABLE", detail: "initial read failed" }],
  };
}

function run(operation, payload) {
  const result = spawnSync(process.execPath, [CLI, operation], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
  });
  return { ...result, output: JSON.parse(result.stdout) };
}

test("hydrates one exact full Linear cache without persisting authority", () => {
  const result = run("hydrate", { expectedProjectId: projectId, snapshot: fullSnapshot() });

  expect(result.status).toBe(0);
  expect(result.output).toMatchObject({
    ok: true,
    cache: { projectId, scope: { mode: "full", requestedIssueIds: [] } },
  });

  const wrongProject = run("hydrate", {
    expectedProjectId: "project-other",
    snapshot: fullSnapshot(),
  });
  expect(wrongProject.status).toBe(1);
  expect(wrongProject.output.error.code).toBe("SNAPSHOT_PROJECT_MISMATCH");
});

test("refreshes only the exact targeted rows and preserves unrelated unknown evidence", () => {
  const targetedSnapshot = {
    schemaVersion: 1,
    projectId,
    scope: { mode: "targeted", requestedIssueIds: ["NOT-1"] },
    issues: [issue("NOT-1", "started")],
    unknown: [],
  };
  const result = run("refresh", {
    cache: fullSnapshot(),
    expectedScope: { mode: "targeted", requestedIssueIds: ["NOT-1"] },
    targetedSnapshot,
  });

  expect(result.status).toBe(0);
  expect(result.output.cache.issues).toEqual([
    issue("NOT-1", "started"),
    issue("NOT-2", "unknown", [], "unknown"),
  ]);
  expect(result.output.cache.unknown).toEqual([
    { issueId: "NOT-2", code: "STATUS_UNAVAILABLE", detail: "initial read failed" },
  ]);

  const expanded = run("refresh", {
    cache: fullSnapshot(),
    expectedScope: { mode: "targeted", requestedIssueIds: ["NOT-2"] },
    targetedSnapshot,
  });
  expect(expanded.status).toBe(1);
  expect(expanded.output.error.code).toBe("SNAPSHOT_SCOPE_MISMATCH");
});

test("recovers an identifiable malformed full row through one exact targeted replacement", () => {
  const malformed = fullSnapshot();
  malformed.issues[1] = {
    ...malformed.issues[1],
    blockerIssueIds: "not-an-array",
  };
  const initial = run("hydrate", { expectedProjectId: projectId, snapshot: malformed });
  expect(initial.status).toBe(1);
  expect(initial.output.error).toMatchObject({
    code: "SNAPSHOT_INVALID_SCHEMA",
    issueIds: ["NOT-2"],
  });

  const targetedSnapshot = {
    schemaVersion: 1,
    projectId,
    scope: { mode: "targeted", requestedIssueIds: ["NOT-2"] },
    issues: [issue("NOT-2", "unstarted")],
    unknown: [],
  };
  const recovered = run("recover-full", {
    expectedProjectId: projectId,
    expectedScope: { mode: "targeted", requestedIssueIds: ["NOT-2"] },
    snapshot: malformed,
    targetedSnapshot,
  });
  expect(recovered.status).toBe(0);
  expect(recovered.output.cache.issues).toEqual([
    issue("NOT-1", "unstarted"),
    issue("NOT-2", "unstarted"),
  ]);
  expect(recovered.output.cache.unknown).toEqual([]);
});

test("full recovery refuses ambiguous identity and a replacement outside the failed scope", () => {
  const duplicate = fullSnapshot();
  duplicate.issues[1] = { ...duplicate.issues[1], issueId: "NOT-1" };
  const targetedSnapshot = {
    schemaVersion: 1,
    projectId,
    scope: { mode: "targeted", requestedIssueIds: ["NOT-1"] },
    issues: [issue("NOT-1", "unstarted")],
    unknown: [],
  };
  expect(
    run("recover-full", {
      expectedProjectId: projectId,
      expectedScope: { mode: "targeted", requestedIssueIds: ["NOT-1"] },
      snapshot: duplicate,
      targetedSnapshot,
    }).output.error.code,
  ).toBe("CACHE_RECOVERY_IDENTITY_INVALID");

  const missing = fullSnapshot();
  const outside = { ...targetedSnapshot };
  outside.scope = { mode: "targeted", requestedIssueIds: ["NOT-3"] };
  outside.issues = [issue("NOT-3", "unstarted")];
  expect(
    run("recover-full", {
      expectedProjectId: projectId,
      expectedScope: { mode: "targeted", requestedIssueIds: ["NOT-3"] },
      snapshot: missing,
      targetedSnapshot: outside,
    }).output.error.code,
  ).toBe("CACHE_RECOVERY_SCOPE_INVALID");
});

test("isolates a persistently malformed identifiable full row without a prior valid cache", () => {
  const malformed = fullSnapshot();
  malformed.issues[1] = { ...malformed.issues[1], blockerIssueIds: "still malformed" };

  const recovered = run("recover-full-unknown", {
    expectedProjectId: projectId,
    snapshot: malformed,
    issueIds: ["NOT-2"],
    code: "TARGETED_SCHEMA_INVALID",
    detail: "exact targeted retry remained malformed",
  });
  expect(recovered.status).toBe(0);
  expect(recovered.output.cache.issues).toEqual([
    issue("NOT-1", "unstarted"),
    issue("NOT-2", "unknown", [], "unknown"),
  ]);
  expect(recovered.output.cache.unknown).toEqual([
    {
      issueId: "NOT-2",
      code: "TARGETED_SCHEMA_INVALID",
      detail: "exact targeted retry remained malformed",
    },
  ]);

  const outside = run("recover-full-unknown", {
    expectedProjectId: projectId,
    snapshot: malformed,
    issueIds: ["NOT-404"],
    code: "TARGETED_SCHEMA_INVALID",
    detail: "not a member",
  });
  expect(outside.status).toBe(1);
  expect(outside.output.error.code).toBe("CACHE_RECOVERY_SCOPE_INVALID");
});

test("marks only known cache members unknown and rejects non-contract payload keys", () => {
  const result = run("mark-unknown", {
    cache: fullSnapshot(),
    issueIds: ["NOT-1"],
    code: "TARGETED_REFRESH_FAILED",
    detail: "retry exhausted",
  });
  expect(result.status).toBe(0);
  expect(result.output.cache.unknown).toContainEqual({
    issueId: "NOT-1",
    code: "TARGETED_REFRESH_FAILED",
    detail: "retry exhausted",
  });

  const extra = run("hydrate", {
    expectedProjectId: projectId,
    snapshot: fullSnapshot(),
    rememberedGraph: true,
  });
  expect(extra.status).toBe(1);
  expect(extra.output.error.code).toBe("CACHE_PAYLOAD_INVALID");
});

test("returns stable machine-readable errors for malformed input and operations", () => {
  expect(run("hydrate", "not json").output.error.code).toBe("INVALID_JSON");
  expect(run("adopt-graph", {}).output.error.code).toBe("COMMAND_INVALID");
});
