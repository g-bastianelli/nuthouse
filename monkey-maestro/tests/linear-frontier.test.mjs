import { describe, expect, test } from "bun:test";
import path from "node:path";

import { planLinearFrontier } from "../lib/linear-frontier.mjs";
import {
  hydrateLinearSnapshotCache,
  markLinearSnapshotCacheUnknown,
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

function snapshot(issues, overrides = {}) {
  return {
    schemaVersion: 1,
    projectId: "project-1",
    scope: { mode: "full", requestedIssueIds: [] },
    issues,
    unknown: [],
    ...overrides,
  };
}

function row(plan, issueId) {
  return plan.rows.find((candidate) => candidate.issueId === issueId);
}

describe("Linear-only frontier", () => {
  test("is deterministic and ignores every non-Linear scheduling artifact", () => {
    const facts = [
      issue("NEXT-10", { blockerIssueIds: ["DONE-2", "DONE-1"] }),
      issue("DONE-2", { statusType: "canceled" }),
      issue("DONE-1", { statusType: "completed" }),
      issue("FREE-3", { statusType: "backlog" }),
    ];
    const historicalNoise = {
      baseline: { issueIds: ["NEXT-10"], edges: [] },
      decisionHash: "sha256:stale",
      executionRecords: [{ issueId: "DONE-1", active: true }],
      github: { available: false },
      workspaces: [{ issueId: "DONE-1", residual: true }],
    };

    const left = planLinearFrontier(snapshot(facts, historicalNoise));
    const right = planLinearFrontier(snapshot([...facts].reverse(), { anotherIgnoredKey: true }));

    expect(left).toEqual(right);
    expect(left.readyIssueIds).toEqual(["FREE-3", "NEXT-10"]);
    expect(left.rows.map(({ issueId }) => issueId)).toEqual([
      "DONE-1",
      "DONE-2",
      "FREE-3",
      "NEXT-10",
    ]);
  });

  test("terminal status wins and canceled blockers satisfy readiness", () => {
    const plan = planLinearFrontier(
      snapshot([
        issue("DONE", { statusType: "completed", blockerIssueIds: ["DONE"] }),
        issue("CANCELED", { statusType: "canceled", blockerIssueIds: ["MISSING"] }),
        issue("AFTER", { blockerIssueIds: ["DONE", "CANCELED"] }),
      ]),
    );

    expect(row(plan, "DONE")).toMatchObject({ classification: "terminal", forced: false });
    expect(row(plan, "CANCELED")).toMatchObject({ classification: "terminal", forced: false });
    expect(row(plan, "AFTER")).toMatchObject({ classification: "ready", forced: false });
    expect(plan.unknownIssueIds).toEqual([]);
  });

  test("uses only current blockedBy links on the next calculation", () => {
    const first = planLinearFrontier(
      snapshot([
        issue("OPEN", { statusType: "started" }),
        issue("DONE", { statusType: "completed" }),
        issue("NEXT", { blockerIssueIds: ["OPEN"] }),
      ]),
    );
    const second = planLinearFrontier(
      snapshot([
        issue("OPEN", { statusType: "started" }),
        issue("DONE", { statusType: "completed" }),
        issue("NEXT", { blockerIssueIds: ["DONE"] }),
      ]),
    );

    expect(row(first, "NEXT").classification).toBe("blocked");
    expect(row(second, "NEXT").classification).toBe("ready");
  });

  test("classifies started work for targeted runtime inspection and confirmation", () => {
    const plan = planLinearFrontier(
      snapshot([
        issue("STARTED-B", { statusType: "started" }),
        issue("STARTED-A", { statusType: "started" }),
      ]),
    );

    expect(plan.startedIssueIds).toEqual(["STARTED-A", "STARTED-B"]);
    expect(plan.confirmationIssueIds).toEqual(["STARTED-A", "STARTED-B"]);
    expect(plan.readyIssueIds).toEqual([]);
  });
});

describe("component-scoped invalid graph data", () => {
  test("a retry-exhausted row cannot retain stale terminal or force eligibility", () => {
    const cache = hydrateLinearSnapshotCache(
      snapshot([
        issue("STALE-DONE", { statusType: "completed" }),
        issue("AFTER", { blockerIssueIds: ["STALE-DONE"] }),
        issue("STALE-CANDIDATE"),
      ]),
    );
    const degraded = markLinearSnapshotCacheUnknown(cache, {
      issueIds: ["STALE-CANDIDATE", "STALE-DONE"],
      code: "TARGETED_REFRESH_FAILED",
      detail: "retry exhausted",
    });

    const plan = planLinearFrontier(degraded, { forcedIssueIds: ["STALE-CANDIDATE"] });

    expect(row(plan, "STALE-DONE").classification).toBe("unknown");
    expect(row(plan, "AFTER").classification).toBe("unknown");
    expect(row(plan, "STALE-CANDIDATE")).toMatchObject({
      classification: "unknown",
      forced: false,
    });
    expect(plan.readyIssueIds).toEqual([]);
  });

  test("isolates unknown facts and only their downstream dependents", () => {
    const plan = planLinearFrontier(
      snapshot(
        [
          issue("UNKNOWN", { dataState: "unknown", statusType: "unknown" }),
          issue("AFTER-UNKNOWN", { blockerIssueIds: ["UNKNOWN"] }),
          issue("INDEPENDENT"),
          issue("INDEPENDENT-CHILD", { blockerIssueIds: ["INDEPENDENT"] }),
        ],
        {
          unknown: [{ issueId: "UNKNOWN", code: "STATUS_UNAVAILABLE", detail: "read failed" }],
        },
      ),
    );

    expect(plan.unknownIssueIds).toEqual(["AFTER-UNKNOWN", "UNKNOWN"]);
    expect(row(plan, "INDEPENDENT").classification).toBe("ready");
    expect(row(plan, "INDEPENDENT-CHILD").classification).toBe("blocked");
  });

  test("isolates cycles, self-relations, missing blockers, and cross-project relations", () => {
    const plan = planLinearFrontier(
      snapshot([
        issue("CYCLE-A", { blockerIssueIds: ["CYCLE-B"] }),
        issue("CYCLE-B", { blockerIssueIds: ["CYCLE-A"] }),
        issue("AFTER-CYCLE", { blockerIssueIds: ["CYCLE-A"] }),
        issue("SELF", { blockerIssueIds: ["SELF"] }),
        issue("MISSING", { blockerIssueIds: ["DOES-NOT-EXIST"] }),
        issue("EXTERNAL", { projectId: "project-2", statusType: "completed" }),
        issue("CROSS-PROJECT", { blockerIssueIds: ["EXTERNAL"] }),
        issue("SAFE"),
      ]),
    );

    expect(plan.unknownIssueIds).toEqual([
      "AFTER-CYCLE",
      "CROSS-PROJECT",
      "CYCLE-A",
      "CYCLE-B",
      "EXTERNAL",
      "MISSING",
      "SELF",
    ]);
    expect(row(plan, "SAFE").classification).toBe("ready");
  });

  test("keeps known started work observable despite relation-only defects", () => {
    const plan = planLinearFrontier(
      snapshot([
        issue("CYCLE-A", { statusType: "started", blockerIssueIds: ["CYCLE-B"] }),
        issue("CYCLE-B", { statusType: "started", blockerIssueIds: ["CYCLE-A"] }),
        issue("SELF", { statusType: "started", blockerIssueIds: ["SELF"] }),
        issue("MISSING", { statusType: "started", blockerIssueIds: ["ABSENT"] }),
        issue("UNKNOWN-BLOCKER", { dataState: "unknown", statusType: "unknown" }),
        issue("AFTER-UNKNOWN", {
          statusType: "started",
          blockerIssueIds: ["UNKNOWN-BLOCKER"],
        }),
        issue("DATA-UNKNOWN", { statusType: "started", dataState: "unknown" }),
        issue("EXTERNAL", { statusType: "started", projectId: "project-2" }),
      ]),
    );

    expect(plan.startedIssueIds).toEqual([
      "AFTER-UNKNOWN",
      "CYCLE-A",
      "CYCLE-B",
      "MISSING",
      "SELF",
    ]);
    expect(plan.confirmationIssueIds).toEqual(plan.startedIssueIds);
    expect(row(plan, "MISSING")).toMatchObject({
      classification: "started",
      reason: "BLOCKER_UNKNOWN:ABSENT",
    });
    expect(row(plan, "SELF")).toMatchObject({
      classification: "started",
      reason: "SELF_RELATION",
    });
    expect(row(plan, "AFTER-UNKNOWN")).toMatchObject({
      classification: "started",
      reason: "DEPENDS_ON_INVALID:UNKNOWN-BLOCKER",
    });
    expect(row(plan, "DATA-UNKNOWN").classification).toBe("unknown");
    expect(row(plan, "EXTERNAL").classification).toBe("unknown");
    expect(row(plan, "UNKNOWN-BLOCKER").classification).toBe("unknown");
  });

  test("a global read failure degrades the whole supplied scope", () => {
    const plan = planLinearFrontier(
      snapshot([issue("A"), issue("B")], {
        unknown: [{ code: "LINEAR_UNAVAILABLE", detail: "provider offline" }],
      }),
    );

    expect(plan.readyIssueIds).toEqual([]);
    expect(plan.unknownIssueIds).toEqual(["A", "B"]);
    expect(plan.degraded).toBe(true);
    expect(plan.globalUnknown).toHaveLength(1);
  });

  test("distinguishes a globally unavailable empty project from a healthy empty project", () => {
    const healthy = planLinearFrontier(snapshot([]));
    const unavailable = planLinearFrontier(
      snapshot([], {
        unknown: [{ code: "LINEAR_UNAVAILABLE", detail: "membership could not be read" }],
      }),
    );

    expect(healthy).toMatchObject({ degraded: false, globalUnknown: [] });
    expect(unavailable).toMatchObject({ degraded: true });
    expect(unavailable.globalUnknown).toEqual([
      { code: "LINEAR_UNAVAILABLE", detail: "membership could not be read" },
    ]);
  });
});

describe("ephemeral force overlay", () => {
  test("bypasses blockers and relation defects only for named nonterminal issues", () => {
    const source = snapshot([
      issue("OPEN", { statusType: "started" }),
      issue("BLOCKED", { blockerIssueIds: ["OPEN"] }),
      issue("SELF", { blockerIssueIds: ["SELF"] }),
      issue("DONE", { statusType: "completed" }),
    ]);

    const forced = planLinearFrontier(source, {
      forcedIssueIds: ["SELF", "BLOCKED", "DONE"],
    });
    const normal = planLinearFrontier(source);

    expect(row(forced, "BLOCKED")).toMatchObject({
      classification: "ready",
      forced: true,
      forceBypassedBlockerIssueIds: ["OPEN"],
      forceBypassedUncertainties: [],
    });
    expect(row(forced, "SELF")).toMatchObject({
      classification: "ready",
      forced: true,
      forceBypassedBlockerIssueIds: ["SELF"],
      forceBypassedUncertainties: [{ issueId: "SELF", code: "SELF_RELATION" }],
    });
    expect(row(forced, "DONE")).toMatchObject({ classification: "terminal", forced: false });
    expect(row(normal, "BLOCKED").classification).toBe("blocked");
    expect(row(normal, "SELF").classification).toBe("unknown");
  });

  test("cannot force unknown status, unknown identity, or cross-project membership", () => {
    const plan = planLinearFrontier(
      snapshot([
        issue("UNKNOWN", { statusType: "unknown", dataState: "unknown" }),
        issue("EXTERNAL", { projectId: "project-2" }),
      ]),
      { forcedIssueIds: ["UNKNOWN", "EXTERNAL", "MISSING"] },
    );

    expect(plan.readyIssueIds).toEqual([]);
    expect(plan.unknownIssueIds).toEqual(["EXTERNAL", "UNKNOWN"]);
  });

  test("preserves the live Linear status underneath a force overlay", () => {
    const plan = planLinearFrontier(
      snapshot([issue("STARTED", { statusType: "started" }), issue("BACKLOG")]),
      { forcedIssueIds: ["STARTED", "BACKLOG"] },
    );

    expect(row(plan, "STARTED")).toMatchObject({
      classification: "ready",
      forced: true,
      linearStatusType: "started",
    });
    expect(row(plan, "BACKLOG")).toMatchObject({
      classification: "ready",
      forced: true,
      linearStatusType: "unstarted",
    });
  });

  test("emits a canonical structured uncertainty preview for forced relations", () => {
    const plan = planLinearFrontier(
      snapshot(
        [
          issue("BLOCKER", { dataState: "unknown" }),
          issue("CANDIDATE", { blockerIssueIds: ["BLOCKER"] }),
        ],
        {
          unknown: [{ issueId: "BLOCKER", code: "RELATIONS_PARTIAL", detail: "provider partial" }],
        },
      ),
      { forcedIssueIds: ["CANDIDATE"] },
    );

    expect(row(plan, "CANDIDATE")).toMatchObject({
      forced: true,
      forceBypassedBlockerIssueIds: ["BLOCKER"],
      forceBypassedUncertainties: [
        { issueId: "BLOCKER", code: "DATA_UNKNOWN" },
        { issueId: "BLOCKER", code: "UNKNOWN:RELATIONS_PARTIAL" },
        { issueId: "CANDIDATE", code: "DEPENDS_ON_INVALID:BLOCKER" },
      ],
    });
  });

  test("previews an absent blocker as a bypass uncertainty without aborting planning", () => {
    const plan = planLinearFrontier(
      snapshot([issue("FORCED", { blockerIssueIds: ["ABSENT"] }), issue("INDEPENDENT")]),
      { forcedIssueIds: ["FORCED"] },
    );

    expect(row(plan, "FORCED")).toMatchObject({
      classification: "ready",
      forced: true,
      forceBypassedBlockerIssueIds: ["ABSENT"],
      forceBypassedUncertainties: [{ issueId: "FORCED", code: "BLOCKER_UNKNOWN:ABSENT" }],
    });
    expect(row(plan, "INDEPENDENT")).toMatchObject({
      classification: "ready",
      forced: false,
    });
  });
});

describe("NOT-550 master regression", () => {
  test("authorizes NOT-550 despite completed residue, unrelated unknown, and absent GitHub", () => {
    const github = {
      get calls() {
        throw new Error("GitHub must not enter Linear planning");
      },
    };
    const plan = planLinearFrontier(
      snapshot(
        [
          issue("NOT-547", { statusType: "completed" }),
          issue("NOT-548", { statusType: "completed", blockerIssueIds: ["NOT-547"] }),
          issue("NOT-549", {
            statusType: "completed",
            blockerIssueIds: ["NOT-547"],
            residualWorkspaceId: "workspace-residual-549",
          }),
          issue("NOT-550", {
            statusType: "backlog",
            blockerIssueIds: ["NOT-547", "NOT-548", "NOT-549"],
          }),
          issue("NOT-554", { statusType: "unknown", dataState: "unknown" }),
        ],
        {
          github,
          historicalDecisionBaseline: {
            edges: [{ dependentIssueId: "NOT-549", blockerIssueId: "NOT-548" }],
          },
          unknown: [{ issueId: "NOT-554", code: "STATUS_UNKNOWN", detail: "unrelated issue" }],
        },
      ),
    );

    expect(row(plan, "NOT-549").classification).toBe("terminal");
    expect(row(plan, "NOT-550")).toMatchObject({ classification: "ready", forced: false });
    expect(plan.readyIssueIds).toContain("NOT-550");
    expect(plan.unknownIssueIds).toEqual(["NOT-554"]);
  });

  test("the JSON CLI plans stdin and reports schema failures without stack output", () => {
    const script = path.resolve(import.meta.dir, "..", "scripts", "linear-frontier.mjs");
    const valid = Bun.spawnSync({
      cmd: [process.execPath, script],
      stdin: new Blob([JSON.stringify({ snapshot: snapshot([issue("READY")]) })]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const invalid = Bun.spawnSync({
      cmd: [process.execPath, script],
      stdin: new Blob(["not-json"]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const wrongProject = Bun.spawnSync({
      cmd: [process.execPath, script],
      stdin: new Blob([
        JSON.stringify({
          snapshot: snapshot([issue("READY")]),
          expectedProjectId: "another-project",
          expectedScope: { mode: "full", requestedIssueIds: [] },
        }),
      ]),
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(valid.exitCode).toBe(0);
    expect(JSON.parse(valid.stdout.toString()).readyIssueIds).toEqual(["READY"]);
    expect(invalid.exitCode).toBe(1);
    expect(JSON.parse(invalid.stdout.toString())).toMatchObject({
      ok: false,
      error: { code: "INVALID_JSON" },
    });
    expect(invalid.stderr.toString()).toBe("");
    expect(wrongProject.exitCode).toBe(1);
    expect(JSON.parse(wrongProject.stdout.toString())).toMatchObject({
      ok: false,
      error: { code: "SNAPSHOT_PROJECT_MISMATCH" },
    });
  });
});
