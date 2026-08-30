import { describe, expect, test } from "bun:test";

import {
  LinearSnapshotValidationError,
  hydrateLinearSnapshotCache,
  linearSnapshotFromCache,
  markLinearSnapshotCacheUnknown,
  refreshLinearSnapshotCache,
  validateLinearSnapshot,
} from "../lib/linear-snapshot.mjs";

function issue(issueId, overrides = {}) {
  return {
    issueId,
    projectId: "project-1",
    statusType: "unstarted",
    blockerIssueIds: [],
    dataState: "known",
    ...overrides,
  };
}

function fullSnapshot(issues, overrides = {}) {
  return {
    schemaVersion: 1,
    projectId: "project-1",
    scope: { mode: "full", requestedIssueIds: [] },
    issues,
    unknown: [],
    ...overrides,
  };
}

function targetedSnapshot(requestedIssueIds, issues, overrides = {}) {
  return {
    schemaVersion: 1,
    projectId: "project-1",
    scope: { mode: "targeted", requestedIssueIds },
    issues,
    unknown: [],
    ...overrides,
  };
}

describe("Linear snapshot validation", () => {
  test("normalizes statuses, issue ordering, blocker ordering, and unknown ordering", () => {
    const input = fullSnapshot(
      [
        issue("ISSUE-20", {
          statusType: "COMPLETED",
          blockerIssueIds: ["ISSUE-10", "ISSUE-2", "ISSUE-10"],
          ignoredHistoricalBaseline: ["invented-edge"],
        }),
        issue("ISSUE-2", { statusType: "Backlog" }),
        issue("ISSUE-10", { statusType: "a-provider-status-we-do-not-know-yet" }),
      ],
      {
        decisionHash: "ignored",
        githubPullRequests: [{ state: "merged" }],
        unknown: [
          { issueId: "ISSUE-20", code: "Z_CODE", detail: "later" },
          { issueId: "ISSUE-10", code: "A_CODE", detail: "first" },
        ],
      },
    );

    const normalized = validateLinearSnapshot(input);

    expect(normalized).toEqual({
      schemaVersion: 1,
      projectId: "project-1",
      scope: { mode: "full", requestedIssueIds: [] },
      issues: [
        issue("ISSUE-10", { statusType: "unknown" }),
        issue("ISSUE-2", { statusType: "backlog" }),
        issue("ISSUE-20", {
          statusType: "completed",
          blockerIssueIds: ["ISSUE-10", "ISSUE-2"],
        }),
      ],
      unknown: [
        { issueId: "ISSUE-10", code: "A_CODE", detail: "first" },
        { issueId: "ISSUE-20", code: "Z_CODE", detail: "later" },
      ],
    });
    expect(input.issues[0].blockerIssueIds).toEqual(["ISSUE-10", "ISSUE-2", "ISSUE-10"]);
  });

  test("enforces the exact declared targeted scope", () => {
    const valid = targetedSnapshot(
      ["ISSUE-2", "ISSUE-1", "ISSUE-2"],
      [issue("ISSUE-1"), issue("ISSUE-2")],
    );

    expect(
      validateLinearSnapshot(valid, {
        expectedProjectId: "project-1",
        expectedScope: {
          mode: "targeted",
          requestedIssueIds: ["ISSUE-1", "ISSUE-2"],
        },
      }).scope,
    ).toEqual({ mode: "targeted", requestedIssueIds: ["ISSUE-1", "ISSUE-2"] });

    expect(() =>
      validateLinearSnapshot(targetedSnapshot(["ISSUE-1"], [issue("ISSUE-1"), issue("EXTRA")]), {
        expectedScope: { mode: "targeted", requestedIssueIds: ["ISSUE-1"] },
      }),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_SCOPE_EXPANDED" }));

    expect(() =>
      validateLinearSnapshot(targetedSnapshot(["ISSUE-1", "ISSUE-2"], [issue("ISSUE-1")]), {
        expectedScope: {
          mode: "targeted",
          requestedIssueIds: ["ISSUE-1", "ISSUE-2"],
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_INCOMPLETE", issueIds: ["ISSUE-2"] }));
  });

  test("rejects malformed and contradictory subagent output before deriving facts", () => {
    const malformedInputs = [
      { ...fullSnapshot([]), schemaVersion: 2 },
      { ...fullSnapshot([]), projectId: "" },
      { ...fullSnapshot([]), issues: "not-an-array" },
      fullSnapshot([issue("DUPLICATE"), issue("DUPLICATE")]),
      fullSnapshot([issue("BAD", { blockerIssueIds: [42] })]),
      fullSnapshot([issue("BAD", { dataState: "maybe" })]),
      fullSnapshot([issue("BAD")], {
        unknown: [{ issueId: "BAD", code: "MISSING_DETAIL" }],
      }),
    ];

    for (const input of malformedInputs) {
      expect(() => validateLinearSnapshot(input)).toThrow(LinearSnapshotValidationError);
    }

    expect(() =>
      validateLinearSnapshot(fullSnapshot([]), { expectedProjectId: "another-project" }),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_PROJECT_MISMATCH" }));
  });

  test("attributes an identifiable malformed row without invalidating a valid sibling", () => {
    const input = fullSnapshot([
      issue("ISSUE-A"),
      issue("ISSUE-B", { blockerIssueIds: "not-an-array" }),
    ]);

    expect(() => validateLinearSnapshot(input)).toThrowError(
      expect.objectContaining({
        code: "SNAPSHOT_INVALID_SCHEMA",
        issueIds: ["ISSUE-B"],
      }),
    );
  });
});

describe("disposable Linear snapshot cache", () => {
  test("hydrates from one full view and replaces only the exact targeted issues", () => {
    const cache = hydrateLinearSnapshotCache(
      fullSnapshot([
        issue("BLOCKER", { statusType: "completed" }),
        issue("CANDIDATE", { blockerIssueIds: ["BLOCKER"] }),
        issue("UNRELATED"),
      ]),
    );

    const refreshed = refreshLinearSnapshotCache(
      cache,
      targetedSnapshot(
        ["CANDIDATE", "BLOCKER"],
        [issue("BLOCKER", { statusType: "started" }), issue("CANDIDATE", { blockerIssueIds: [] })],
        {
          unknown: [
            {
              issueId: "BLOCKER",
              code: "RELATIONS_PARTIAL",
              detail: "targeted relation read failed",
            },
          ],
        },
      ),
    );

    expect(refreshed.scope).toEqual({ mode: "full", requestedIssueIds: [] });
    expect(refreshed.issues).toEqual([
      issue("BLOCKER", { statusType: "started" }),
      issue("CANDIDATE", { blockerIssueIds: [] }),
      issue("UNRELATED"),
    ]);
    expect(refreshed.unknown).toEqual([
      {
        issueId: "BLOCKER",
        code: "RELATIONS_PARTIAL",
        detail: "targeted relation read failed",
      },
    ]);
    expect(linearSnapshotFromCache(cache).issues[0].statusType).toBe("completed");
  });

  test("a rejected targeted response leaves the previous cache usable", () => {
    const cache = hydrateLinearSnapshotCache(fullSnapshot([issue("KEEP")]));

    expect(() =>
      refreshLinearSnapshotCache(
        cache,
        targetedSnapshot(["KEEP"], [issue("KEEP"), issue("EXPANDED")]),
      ),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_SCOPE_EXPANDED" }));
    expect(linearSnapshotFromCache(cache).issues).toEqual([issue("KEEP")]);
  });

  test("rejects a self-consistent but wrong targeted scope before cache mutation", () => {
    const cache = hydrateLinearSnapshotCache(fullSnapshot([issue("KEEP"), issue("WRONG")]));

    expect(() =>
      refreshLinearSnapshotCache(cache, targetedSnapshot(["WRONG"], [issue("WRONG")]), {
        expectedScope: { mode: "targeted", requestedIssueIds: ["KEEP"] },
      }),
    ).toThrowError(expect.objectContaining({ code: "SNAPSHOT_SCOPE_MISMATCH" }));
    expect(linearSnapshotFromCache(cache).issues).toEqual([issue("KEEP"), issue("WRONG")]);
  });

  test("marks only a failed targeted scope unknown after provider retries are exhausted", () => {
    const cache = hydrateLinearSnapshotCache(
      fullSnapshot([issue("A"), issue("B", { statusType: "completed" })]),
    );
    const degraded = markLinearSnapshotCacheUnknown(cache, {
      issueIds: ["B"],
      code: "SNAPSHOT_INCOMPLETE",
      detail: "targeted retry failed",
    });

    expect(degraded.unknown).toEqual([
      {
        issueId: "B",
        code: "SNAPSHOT_INCOMPLETE",
        detail: "targeted retry failed",
      },
    ]);
    expect(degraded.issues).toEqual([
      issue("A"),
      issue("B", {
        statusType: "unknown",
        dataState: "unknown",
      }),
    ]);
    expect(cache.unknown).toEqual([]);
  });
});
