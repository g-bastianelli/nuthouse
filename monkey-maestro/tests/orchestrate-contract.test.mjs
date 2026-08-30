import { expect, mock, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { runOrchestrationEpoch } from "../lib/orchestration-epoch.mjs";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const orchestrate = fs.readFileSync(
  path.join(ROOT, "monkey-maestro/skills/orchestrate/SKILL.md"),
  "utf8",
);

function normalize(document) {
  return document
    .replace(/[`*#|]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim()
    .toLowerCase();
}

function expectInOrder(document, fragments) {
  let cursor = 0;

  for (const fragment of fragments) {
    const normalizedFragment = normalize(fragment);
    const index = document.indexOf(normalizedFragment, cursor);
    expect(index, `missing or out-of-order workflow invariant: ${fragment}`).toBeGreaterThanOrEqual(
      cursor,
    );
    cursor = index + normalizedFragment.length;
  }
}

function frontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  expect(match).not.toBeNull();
  return match[1];
}

function allowedTools(document) {
  const match = frontmatter(document).match(/^allowed-tools:\s*(.+)$/m);
  expect(match).not.toBeNull();
  return match[1];
}

const normalized = normalize(orchestrate);

function eventSnapshot({ includeDiscoveredBlocker }) {
  const requestedIssueIds = includeDiscoveredBlocker ? ["NOT-B", "NOT-C"] : ["NOT-B"];
  return {
    schemaVersion: 1,
    projectId: "linear-project",
    scope: { mode: "targeted", requestedIssueIds },
    issues: [
      {
        issueId: "NOT-B",
        projectId: "linear-project",
        statusType: "backlog",
        blockerIssueIds: ["NOT-C"],
        dataState: "known",
      },
      ...(includeDiscoveredBlocker
        ? [
            {
              issueId: "NOT-C",
              projectId: "linear-project",
              statusType: "completed",
              blockerIssueIds: [],
              dataState: "known",
            },
          ]
        : []),
    ],
    unknown: [],
  };
}

function monitorEvent(snapshot) {
  const refreshAfterWorkerEvent = mock(async () => snapshot);
  const promoteAfterRefresh = mock(async () => ({ applied: true }));
  const result = runOrchestrationEpoch({
    frontierPlan: {
      rows: [
        {
          issueId: "NOT-B",
          blockerIssueIds: [],
          classification: "started",
          linearStatusType: "started",
          forced: false,
        },
      ],
      readyIssueIds: [],
      startedIssueIds: ["NOT-B"],
      confirmationIssueIds: [],
      unknownIssueIds: [],
    },
    runtimePlan: {
      actions: [
        {
          issueId: "NOT-B",
          action: "monitor",
          taskId: "task-NOT-B",
          workspaceId: "workspace-NOT-B",
          terminalId: "terminal-NOT-B",
          forced: false,
          linearClassification: "started",
          linearStatusType: "started",
        },
      ],
      selectedIssueIds: ["NOT-B"],
      capacityUsed: 1,
    },
    selectedIssueIds: ["NOT-B"],
    lockDirectory: "/tmp/maestro-test-locks",
    control: {
      projectId: "linear-project",
      runId: "run-1",
      active: true,
      targetHostId: "host-1",
      supersetProjectId: "superset-project",
      defaultAgent: "codex",
      maxConcurrency: 1,
      revision: 1,
    },
    adapters: {
      monitorWorker: mock(async () => ({
        event: { type: "worker-finished", refreshIssueIds: [] },
      })),
      refreshAfterWorkerEvent,
      promoteAfterRefresh,
    },
  });
  return { promoteAfterRefresh, refreshAfterWorkerEvent, result };
}

test("AC-001/002/003: one full bootstrap feeds only targeted Linear refreshes", () => {
  expect(orchestrate.match(/MODE:\s*full/g) ?? []).toHaveLength(1);
  expect(normalized).toMatch(/mode: full exactly once for this invocation/);
  expect(normalized).toMatch(
    /scripts\/linear-snapshot\.mjs hydrate.*run planlinearfrontier on the normalized cache through scripts\/linear-frontier\.mjs.*do not pass control history, records, waivers, github, or superset data into the planner/,
  );
  expect(normalized).toMatch(
    /targeted-load every batch candidate first.*derive blocker ids only from those fresh relations.*targeted-load the deduplicated exact live blocker set.*apply them to the cache, and re-run planlinearfrontier/,
  );
  expect(normalized).toMatch(
    /after a worker event, targeted-load the affected issue plus cached candidates whose decision depends on it.*derive their current blockers from those fresh rows.*refresh that exact blocker union.*validate each returned snapshot against the expected project id and its exact requested targeted scope.*only validated candidate and blocker snapshots are applied before re-planning/,
  );
  expect(normalized).toMatch(/never invoke reconcile because a relation changed/);
  expect(normalized).not.toContain("reconcile_required");
});

test("AC-013: Linear selects candidates before candidate-only Superset inspection", () => {
  expectInOrder(normalized, [
    "call scripts/linear-snapshot.mjs hydrate",
    "run planLinearFrontier on the normalized cache through scripts/linear-frontier.mjs",
    "re-run planLinearFrontier with the requested force ids to create an unconfirmed force overlay",
    "build the selected id set from normal ready/started rows plus ready rows in the unconfirmed force overlay",
    "dispatch monkey-maestro:runtime-inspector once with that exact sorted set",
    "run planRuntimeActions",
  ]);

  expect(normalized).toMatch(
    /terminal rows are final immediately and never enter runtime inspection or capacity/,
  );
  expect(normalized).toMatch(/persistent global failure returns degraded without superset calls/);
  expect(normalized).toMatch(
    /if it is empty, return idle immediately: do not call superset, wait, sleep, or refresh linear a second time/,
  );
});

test("AC-008/009/010: started and forced launches share one invocation-scoped gate", () => {
  expect(normalized).toMatch(
    /unconfirmed force overlay.*only to select otherwise blocked\/relation-unknown candidates for scoped runtime inspection; it authorizes no mutation/,
  );
  expect(normalized).toMatch(
    /record which force requests would bypass blockers or uncertain relations, but defer the single combined preview/,
  );
  expect(normalized).toMatch(
    /present one grouped confirmation for started rows with no exact runtime, combined with every unconfirmed force mutation/,
  );
  expect(normalized).toMatch(
    /run planruntimeactions with .*but no force authorization yet.*unconfirmed forced mutations and started rows without an active terminal return confirm/,
  );
  expect(normalized).toMatch(
    /on confirmation, build the invocation-scoped force authorization.*then re-run the runtime planner/,
  );
  expect(normalized).toMatch(
    /authorization copies the forced frontier row's exact forcebypassedblockerissueids and canonical forcebypasseduncertainties tokens.*never parse concatenated reason text/,
  );
  expect(normalized).toMatch(
    /bypassedblockerissueids, and bypasseduncertainties maps copied exactly from each forced frontier row, including empty arrays.*preview both scopes to the user/,
  );
  expect(normalized).toMatch(/refusal does not affect ordinary ready siblings/);
  expect(normalized).toMatch(
    /force cannot override missing identity\/configuration, multiple runtimes, inactive control, or a held lock/,
  );
});

test("AC-012: the short lock contains live refresh and duplicate checking, not monitoring", () => {
  expectInOrder(normalized, [
    "human input is complete before this step",
    "acquire the project dispatch lock",
    "in try/finally, re-run control-loader plus deterministic resolution",
    "require the same project/run/transport configuration and active: true",
    "targeted-load every batch candidate first",
    "derive blocker ids only from those fresh relations",
    "targeted-load the deduplicated exact live blocker set",
    "re-run candidate-only runtime inspection for surviving ids and repeat the exact workspace duplicate check",
    "execute independent issue sequences concurrently with all-settled semantics",
    "release the token-matched lock in finally before monitoring or follow-up",
    "read every exact active terminal together",
  ]);

  expect(normalized).toMatch(/projectid, hostid: control\.targethostid/);
  expect(normalized).toMatch(/drop any candidate that became terminal/);
  expect(normalized).toMatch(/never reuse the pre-lock absence as creation authority/);
});

test("dispatch is deterministic, per-issue idempotent, and all-settled", () => {
  expect(normalized).toMatch(
    /scripts\/orchestration-epoch\.mjs.*calls lib\/orchestration-epoch\.mjs runorchestrationepoch and is the sole authorization, locking, all-settled dispatch, and monitoring-order path/,
  );
  expect(normalized).toMatch(
    /exact outer envelope \{ schemaversion: 1, request: \{\s*\.\.\.\s*\}, transcript: \[\.\.\.\] \}.*inside request/,
  );
  expect(normalized).toMatch(
    /successful cli output is directly \{ schemaversion: 1, state: "needs-effects"\s+"complete",\s*\.\.\.\s*\}; there is no ok or epoch success wrapper/,
  );
  expect(normalized).toMatch(
    /exact deterministic candidate\/runtime batch as selectedissueids.*blocker or unrelated frontier rows are context only and never widen (?:the )?runtime (?:action )?scope/,
  );
  expect(normalized).toMatch(
    /effect wiring is fixed: refreshcontrol is control-loader.*refreshcandidateandblockers is the two-phase targeted linear read.*inspectexactruntime is the candidate-only inspector.*dispatchissue is the exact superset sequence.*monitor\/event-refresh effects use step 5 and the targeted loader/,
  );
  expect(normalized).toMatch(
    /for each needs-effects response, execute exactly the returned effects.*never synthesize an adapter result, execute an unrequested provider action.*authorize from anything except the final state: complete result/,
  );
  expect(normalized).toMatch(
    /follow the shared contract's adapter response envelopes exactly.*refreshcontrol returns resolveoutput\.authority\.control, never the cli wrapper.*dispatchissue returns one of the four strict identity\/runtime\/record forms/,
  );
  expect(normalized).toMatch(
    /select new actions in deterministic issue-id order up to remaining capacity/,
  );
  expect(normalized).toMatch(
    /if one issue still lacks valid dispatch context, record that issue as non-transportable: dispatch_context_unavailable, remove only it from the bridge's execution-batch runtimeplan and selectedissueids.*consider the next deferred create\/reuse action.*keep active monitor actions and valid siblings/,
  );
  expect(normalized).toMatch(/never let one branch\/title\/prompt failure abort the batch/);
  expect(normalized).toMatch(/failure of a never cancels b or c/);
  expectInOrder(normalized, [
    "task identity",
    "exact workspace check",
    "workspace create when absent",
    "workspace get and exact host/project/task verification",
    "terminal snapshot",
    "agent create",
    "exact terminal correlation",
    "best-effort execution record",
  ]);
  expect(normalized).toMatch(/ambiguous output gets one exact task\/workspace inspection/);
  expect(normalized).toMatch(/never repeat create blindly/);
  expect(normalized).toMatch(
    /record-write failure is a telemetry warning, never redispatch authority/,
  );
});

test("AC-017/018/019: monitoring is exact, event-driven, and exits idle without polling", () => {
  expect(normalized).toMatch(/read every exact active terminal together/);
  expect(normalized).toMatch(
    /terminal text and worker envelopes as coordination evidence only.*never infer linear completion/,
  );
  expect(normalized).toMatch(
    /after a worker event, targeted-load the affected issue plus cached candidates whose decision depends on it.*refresh that exact blocker union.*validate each returned snapshot against the expected project id and its exact requested targeted scope.*before any cache merge or promotion/,
  );
  expect(normalized).toMatch(/return to steps 3-4 without a full linear reload/);
  expect(normalized).toMatch(
    /when no exact active worker and no ready\/confirmed force candidate remain, report idle immediately/,
  );
  expect(normalized).toMatch(/report awaiting linear and exit; do not poll/);
});

test("AC-002/003/018: event refresh validates a newly discovered blocker before promotion", async () => {
  const { promoteAfterRefresh, refreshAfterWorkerEvent, result } = monitorEvent(
    eventSnapshot({ includeDiscoveredBlocker: true }),
  );

  expect((await result).monitoring.settled[0]).toMatchObject({
    status: "fulfilled",
    value: { outcome: "event", issueIds: ["NOT-B", "NOT-C"] },
  });
  expect(refreshAfterWorkerEvent.mock.calls[0][0]).toMatchObject({
    issueIds: ["NOT-B"],
    refreshMode: "candidates-then-live-blockers",
  });
  expect(promoteAfterRefresh.mock.calls[0][0]).toMatchObject({
    issueIds: ["NOT-B", "NOT-C"],
    refreshed: {
      scope: { mode: "targeted", requestedIssueIds: ["NOT-B", "NOT-C"] },
    },
  });
});

test("AC-018/026: event refresh never promotes an unvalidated blocker scope", async () => {
  const { promoteAfterRefresh, result } = monitorEvent(
    eventSnapshot({ includeDiscoveredBlocker: false }),
  );

  expect((await result).monitoring.settled[0]).toMatchObject({ status: "rejected" });
  expect(promoteAfterRefresh).toHaveBeenCalledTimes(0);
});

test("AC-020: authorization exposes no GitHub or legacy reconciliation capability", () => {
  const declaredTools = allowedTools(orchestrate);
  expect(declaredTools).not.toMatch(/bash\(gh(?::|\))/i);
  expect(declaredTools).not.toMatch(/github/i);
  expect(normalized).toMatch(/never call github/);

  for (const forbidden of [
    "reconcile_required",
    "decisionBaseline",
    "decisionHash",
    "graphHash",
    "EXPECTED_DECISION_HASH",
    "confirmedRunnableExpansions",
    "executionIssueIds",
    "exitedExecutionIssueIds",
    "scripts/reconcile-state.mjs",
    "nuthouse:project-graph-receipt",
  ]) {
    expect(orchestrate, `legacy scheduler authority must stay absent: ${forbidden}`).not.toContain(
      forbidden,
    );
  }
});
