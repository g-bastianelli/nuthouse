import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const spawn = fs.readFileSync(path.join(ROOT, "monkey-maestro/skills/spawn/SKILL.md"), "utf8");

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
    expect(
      index,
      `missing or out-of-order one-issue invariant: ${fragment}`,
    ).toBeGreaterThanOrEqual(cursor);
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

const normalized = normalize(spawn);

test("spawn plans one exact live Linear issue before control or Superset access", () => {
  expectInOrder(normalized, [
    "fetch it with get_issue(includeRelations: true)",
    "a terminal issue returns already-terminal immediately",
    "fetch every blocker detail in parallel",
    "validate/plan it through scripts/linear-frontier.mjs",
    "for a project-bound issue, dispatch monkey-maestro:control-loader",
    "dispatch monkey-maestro:runtime-inspector for this one exact issue",
  ]);
  expect(normalized).toMatch(/require one exact linear issue identifier/);
  expect(normalized).not.toContain("mode: full");
  expect(normalized).toMatch(
    /terminal issue returns already-terminal immediately, before blocker, superset, or control lookup/,
  );
  expect(normalized).toMatch(/retry this exact issue read once on failure/);
  expect(normalized).toMatch(/retrying only failed blocker ids once/);
});

test("AC-025: an active control supplies transport instead of redirecting spawn", () => {
  expect(normalized).toMatch(/same linear\/runtime planners and dispatch primitive as orchestrate/);
  expect(normalized).toMatch(
    /usable active control supplies host, superset project, agent, and run id.*does not redirect to orchestrate/,
  );
  expect(normalized).toMatch(/never redirect merely because an active control exists/);
  expect(normalized).toMatch(/inactive project control is a hard refusal/);
  expect(normalized).toMatch(/conflicting or unusable project control is also a hard refusal/);
  expect(normalized).toMatch(
    /when control is provably absent, exact explicit host\/project\/agent arguments may build an invocation-only control/,
  );
  expect(normalized).toMatch(
    /project-less issue, use invocation-local synthetic scope manual:<issueid>.*never persist that scope/,
  );
  expect(normalized).toMatch(
    /project-less invocation, refreshcandidateandblockers does not dispatch the project-bound snapshot loader/,
  );
  expect(normalized).toMatch(
    /fetch the candidate first with relations, derive its exact fresh blocker ids, fetch those blockers in parallel/,
  );
  expect(normalized).toMatch(
    /validate its exact project\/provider\/schema envelope, and resolve its comments/,
  );
});

test("force is explicit, invocation-scoped, and cannot bypass hard safety boundaries", () => {
  expect(normalized).toMatch(
    /started issue proceeds to runtime inspection and uses ordinary started-without-runtime confirmation, never force/,
  );
  expect(normalized).toMatch(
    /blocked or relation-unknown issue requires an explicit force request; build the unconfirmed force overlay before runtime inspection/,
  );
  expect(normalized).toMatch(/force remains invocation-only/);
  expect(normalized).toMatch(
    /preserve the forced frontier row's canonical forcebypassedblockerissueids and forcebypasseduncertainties preview fields; never parse its reason string/,
  );
  expect(normalized).toMatch(
    /bypassedblockerissueids and bypasseduncertainties maps copied exactly from the forced frontier row, including empty arrays/,
  );
  expect(normalized).toMatch(/missing task identity refuses mutation/);
  expect(normalized).toMatch(/multiple exact workspaces or active terminals are ambiguous/);
  expect(normalized).toMatch(/inactive project control is a hard refusal/);
  expect(normalized).toMatch(/live ownership returns busy; never bypass it/);
  expect(normalized).toMatch(
    /ask once:.*launch this issue with the displayed normal\/forced authorization/,
  );
});

test("one-issue runtime planning applies exact zero/one/many idempotence", () => {
  expect(normalized).toMatch(/runtime-inspector for this one exact issue/);
  expect(normalized).toMatch(
    /validate the exact project\/host context and scope with scripts\/runtime-actions\.mjs/,
  );
  expect(normalized).toMatch(/retry invalid or scoped-unknown evidence once for this same issue/);
  expect(normalized).toMatch(/one exact active terminal is monitored without a launch/);
  expect(normalized).toMatch(
    /with no active terminal, one workspace means reuse and zero means create/,
  );
  expect(normalized).toMatch(
    /started create\/reuse and an unconfirmed forced create\/reuse are both confirm actions/,
  );
});

test("confirmation precedes the lock, live refresh, duplicate check, and mutation", () => {
  expectInOrder(normalized, [
    "ask once",
    "acquire the project/manual lock only after confirmation",
    "re-resolve the project control once immediately after confirmation and before acquiring the lock",
    "an inactive, newly written, or conflicting control refuses the launch without mutation",
    "make one project-snapshot-loader dispatch with",
    "MODE: candidate-blockers",
    "re-plan with the confirmed force overlay",
    "performs the exact task/workspace/terminal duplicate check itself",
    "task -> exact workspace check -> create if absent -> verify workspace",
    "release the token-matched lock in finally",
  ]);
  expect(normalized).toMatch(/project\/manual scope as projectid.*selected host as hostid/);
  expect(normalized).toMatch(/reject a newly terminal candidate/);
  expect(normalized).toMatch(
    /zero exact workspaces selects create; one selects reuse; multiplicity is ambiguous.*if an active terminal appeared during confirmation, reuse and monitor it without launching a second agent/,
  );
});

test("the shared dispatch primitive preserves order and partial evidence", () => {
  expect(normalized).toMatch(
    /one-candidate production bridge scripts\/orchestration-epoch\.mjs; it invokes the same lib\/orchestration-epoch\.mjs state machine as orchestration/,
  );
  expect(normalized).toMatch(
    /exact outer envelope \{ schemaversion: 1, request: \{\s*\.\.\.\s*\}, transcript: \[\.\.\.\] \}/,
  );
  expect(normalized).toMatch(
    /successful cli output is directly \{ schemaversion: 1, state: "needs-effects"\s+"complete",\s*\.\.\.\s*\}; it has no ok or epoch success wrapper/,
  );
  expect(normalized).toMatch(
    /selectedissueids: \[candidateissueid\] exactly, even when blocker rows are present/,
  );
  expect(normalized).toMatch(
    /never execute an effect that the bridge did not request or treat a partial transcript as authorization/,
  );
  expect(normalized).toMatch(
    /dispatchissue returns one of the four strict identity\/runtime\/record forms and includes the actual live action, create or reuse/,
  );
  expect(normalized).toMatch(
    /a create request may come back reuse; a reuse request must come back reuse bound to the exact requested workspace/,
  );
  expectInOrder(normalized, [
    "live token/owner/lease verification",
    "task",
    "exact workspace check",
    "create if absent",
    "verify workspace",
    "terminal snapshot",
    "create agent",
    "correlate terminal",
    "best-effort record",
  ]);
  expect(normalized).toMatch(
    /inspect one time only after ambiguous or invalid mutation evidence and never retry create blindly/,
  );
  expect(normalized).toMatch(/preserve partial workspace success/);
  expect(normalized).toMatch(
    /persistent missing\/invalid context returns non-transportable: dispatch_context_unavailable without entering the bridge or mutating transport/,
  );
  expect(normalized).toMatch(
    /scripts\/project-lock\.mjs verify.*first sub-step, immediately before any superset call/,
  );
  expect(normalized).toMatch(/lockverification: verifyoutput\.verification/);
  expect(normalized).toMatch(/worker prompt starts with linear-devotee:greet <issueid>/);
  expect(normalized).toMatch(/only greet may claim the issue/);
});

test("spawn has no legacy redirect, reconciliation, or GitHub authority", () => {
  const declaredTools = allowedTools(spawn);
  expect(declaredTools).toMatch(/Bash\(superset terminals read:\*\)/);
  expect(declaredTools).not.toMatch(/bash\(gh(?::|\))/i);
  expect(declaredTools).not.toMatch(/github/i);

  for (const forbidden of [
    "reconcile_required",
    "decisionBaseline",
    "decisionHash",
    "graphHash",
    "authorizationHash",
    "confirmedRunnableExpansions",
    "scripts/reconcile-state.mjs",
    "nuthouse:project-graph-receipt",
  ]) {
    expect(spawn, `legacy spawn authority must stay absent: ${forbidden}`).not.toContain(forbidden);
  }
});
