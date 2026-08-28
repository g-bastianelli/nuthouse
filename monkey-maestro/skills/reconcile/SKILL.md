---
name: reconcile
description: Use when the user or a configured Superset automation wants Monkey Maestro to reconcile an active Linear project — reloads Linear, GitHub, and Superset, reconstructs executions by taskId, safely adopts project changes, and dispatches eligible issues up to concurrency. Runs once and exits; never polls.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Bash(superset status:*), Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__save_comment
---

# reconcile

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned line only when non-empty. Skip on failure or disabled voice; never retry or mention it.

## Voice

Read `../../persona.md` at the start. Apply it only around plain reports and decision
gates; provider data and commands stay neutral.

**Scope:** this skill only. Restore the session voice after the final report.

This skill is **rigid** — execute steps in order and release the lock on every exit.

## Language

Match the user's language. Preserve technical identifiers.

## When you're invoked

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is the LLM
reconciler: it performs one fresh observation/decision/mutation pass and exits. The pure
resolver is evidence for its decision, not a scheduler deciding whether to wake the LLM.

## Step 0 — Resolve control, host, and lock

1. Require one exact Linear project id. Dispatch
   `monkey-maestro:project-snapshot-loader` with `MODE: control-only`. Require one valid
   latest control. Missing/invalid/inactive control produces a no-dispatch report.
2. Run `superset status --json` and require `hostId === control.targetHostId`. If not,
   stop without mutation and instruct invocation on the configured host; do not create a
   coordinator workspace implicitly.
3. Acquire `${CLAUDE_PLUGIN_DATA}/locks` through
   `scripts/project-lock.mjs acquire` with project/run/current terminal metadata. If
   `LOCK_HELD`, report its owner and exit without external mutation. A stale candidate is
   never auto-recovered; explicit recovery needs runtime proof that its owner terminal no
   longer exists and the exact token.
4. Keep the returned `lockToken` only while actively reading or mutating. Every held
   interval is a `try/finally` whose `finally` calls `project-lock.mjs release` with that
   exact token. Never hold the lock while waiting for human input.

## Step 1 — Reload all authority under lock

Dispatch the Linear loader first, because its fresh managed/owned identifier sets are the
authority for Superset task resolution:

```text
Agent({
  subagent_type: 'monkey-maestro:project-snapshot-loader',
  description: 'reload Linear project execution truth',
  prompt: `PROJECT_ID: <project id>
MODE: full`,
})
```

Build `MANAGED_ISSUE_IDS` from the returned `issues[].id`. Build
`OWNED_ISSUE_IDS` as the sorted union of those ids, control baseline ids,
`executionIssueIds`, and every valid execution record `issueId`. Then dispatch:

```text
Agent({
  subagent_type: 'monkey-maestro:runtime-inspector',
  description: 'reload Superset and GitHub execution truth',
  prompt: `TARGET_HOST_ID: <control.targetHostId>
SUPERSET_PROJECT_ID: <control.supersetProjectId>
LINEAR_PROJECT_ID: <control.projectId>
REPOSITORY: <control.repository>
RUN_ID: <control.runId>
MANAGED_ISSUE_IDS: <fresh comma-separated exact Linear identifiers>
OWNED_ISSUE_IDS: <fresh comma-separated exact Linear identifiers>`,
})
```

Require the reloaded control to match the pre-lock run/revision/decision hash and remain
active. Linear unavailable, GitHub/Superset unavailable, unknown control/host/project,
or changed authority permits no dispatch. A provider `partial` result must carry stable
`unknown` entries: issue-scoped required unknowns block only those issues, optional
unknowns do not poison known decisions, and an unscoped required unknown blocks mutation.

## Step 2 — Reconstruct and resolve

1. Merge the snapshots into the resolver input. Preserve every valid execution record so
   a retained execution from an earlier run can identify its exact agent terminal; mark
   which records belong to the active run. Pass the control baseline so runtime ownership survives an issue leaving the
   project. Set workspace `claimed` from fresh Linear normalized status: started or
   terminal status types mean claimed; unstarted means unclaimed; unknown stays unknown.
   Preserve every terminal's normalized `exited` state. Capacity counts only owned,
   task-linked executions whose recorded agent terminal is live (or whose partial state
   cannot prove it exited); main workspaces, foreign task ids, and confirmed exited agent
   terminals do not consume Maestro concurrency. A missing workspace confirms exit only
   when Superset returned a complete `ready` workspace inventory for the control's exact
   host/project, its declared `workspaceIds` equal the full unfiltered workspace array,
   the issue remains managed with a known terminal Linear status, and every durable
   record belongs to the active run with the exact task, host, and an absent recorded
   `workspaceId`. Partial/filtered provider state, scope or task uncertainty, earlier-run
   records, and moved issues stay guarded and capacity-consuming.
   Join every managed Linear `issue.id` to exactly one runtime `taskBindings[].issueId`
   and copy its validated Superset UUID to `issue.taskId`. The Linear side remains the
   exact opaque, team-dependent identifier (`TEAM-123`); the runtime side remains
   `task.id`. Never hard-code a team prefix. A missing,
   mismatched, or duplicate binding is required unknown for that issue and cannot fall
   back to a Linear UUID, branch, or title.
   Pass the full `taskBindings` array, `workspaceInventory`, and the full unfiltered
   `workspaces` array plus `linearUnknown: linearSnapshot.unknown` and
   `runtimeUnknown: runtimeSnapshot.unknown` to the resolver. Never reconstruct the
   completeness marker, filter the workspace array, merge the two unknown namespaces,
   or drop optional/required flags.
2. Write one ephemeral JSON packet and run
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/reconcile-state.mjs <packet>`. The resolver:
   - counts owned live task executions against capacity and never duplicates a `taskId`;
   - orders issues by fresh Linear order;
   - accepts only Linear completion or one exact human waiver;
   - ignores a merged PR as blocker completion;
   - classifies zero/one/multiple runtime matches as dispatch/repair/ambiguity;
   - quarantines invalid components and descendants while preserving independent work;
   - returns a representable `nextBaseline` that retains prior edges for unknown or
     quarantined components while adopting only known valid graph fields;
   - adopts constraining dependencies and requests confirmation for runnable expansion.
3. Print active, dispatch, repair, inspect, blocked, quarantine, and confirmation lists.
   Full capacity is a successful no-op.
4. If `confirmations` is non-empty, release the project lock before showing the exact
   added issue/removal/reversal and asking: `Authorize these newly runnable dispatches?
(y / no)`. On `no`, withhold them, do not advance the decision baseline, and exit. On
   `y`, remember only the approved issue ids, reacquire the project lock, reload both
   providers and the control again, and rerun the resolver with those ids in
   `confirmedRunnableExpansions`. An authority change or a new/different expansion
   invalidates the stale decision: release before asking again or exit. Never dispatch
   from the pre-confirmation snapshots.

## Step 3 — Persist the decision before dispatch

When all expansion confirmations are resolved, compare the resolver's `nextBaseline`
and the sorted ids from its fresh `active` entries (including `runtimeMissing: true`)
with the control's baseline and `executionIssueIds`. Build `exitedExecutionIssueIds` as
the prior tombstones plus the resolver's `confirmedExitedIssueIds`, minus active ids and
this decision's dispatch ids. If any set or baseline differs, build the next control revision through
`records.mjs build-control`, preserving policy, replacing the changed baseline/decision
hash, replacing `executionIssueIds`, and updating the timestamp. Moved issues remain in
that execution index only while their runtime still consumes capacity. An old execution
record stops guarding only when its id has this explicit confirmed-exited tombstone,
including the narrowly proven terminal-issue workspace-deletion case from Step 2.
Update the
existing project comment and reload it. A failed or ambiguous
write stops every new dispatch; otherwise subsequent runs can classify future Linear
changes without local memory.

Never persist the loader's raw `currentBaseline`: partial blocker fields and invalid
self/unknown/cyclic edges are observations, not a representable decision baseline. Only
the resolver's `nextBaseline` may advance control state.

For every `repair` entry, build an `outcome: repaired` issue execution record from the
exact runtime workspace/terminal/branch and write it to Linear. If Linear recording
fails, report degraded traceability and stop new dispatch for this pass. Ambiguous or
partial entries are reported, never guessed or relaunched.

## Step 4 — Fill slots through spawn

For each resolver `dispatch` in order, first run `records.mjs build-authorization` with
the persisted control's project/run/revision/decision hash, the held lock token, the
dispatch issue id, its validated Superset task id, and that dispatch entry's fresh
`eligibility` evidence. The helper must accept the issue as startable with every blocker
completed or exactly waived. Then
invoke `monkey-maestro:spawn` with its complete output:

```json
{
  "issueId": "TEAM-123",
  "authorization": {
    "kind": "project",
    "projectId": "<project id>",
    "runId": "<run id>",
    "revision": "<persisted revision>",
    "decisionHash": "<persisted hash>",
    "lockToken": "<held token>",
    "issueId": "TEAM-123",
    "taskId": "<Superset task UUID>",
    "eligibility": {
      "issueId": "TEAM-123",
      "projectId": "<project id>",
      "statusType": "<fresh startable type>",
      "blockers": []
    },
    "authorizationHash": "sha256:<hash>"
  }
}
```

Use the installed skill workflow directly. If the runtime cannot nest a skill call, read
`${CLAUDE_PLUGIN_ROOT}/skills/spawn/SKILL.md` and execute that exact project-authorized
sub-workflow in this context; do not improvise a parallel implementation. It requires no
per-issue gate. Capture every structured spawn result. Partial/degraded results preserve
their runtime and consume capacity; never retry them in this pass.

## Step 5 — Release and report

Release the token-matched lock in `finally`, delete only this invocation's ephemeral
packet, print the report, and exit. Do not sleep, wait for agents, poll, recurse, or
schedule the next reconciliation. A known workflow transition or user-configured
Superset automation may invoke this same skill later.

## Final Report

```text
monkey-maestro:reconcile report
  Project/run:    <project id> / <run id>
  Revision/hash:  <revision> / <decision hash>
  Lock:           acquired then released | held by <owner> | failed
  Providers:      Linear <state> · GitHub <state> · Superset <state>
  Capacity:       <active>/<max> · <available> available
  Active:         <issue → workspace/terminal, ... | none>
  Repaired:       <issue → Linear record, ... | none>
  Dispatched:     <issue → workspace/terminal/outcome, ... | none>
  Blocked:        <issue + reason, ... | none>
  Quarantined:    <issue + reason, ... | none>
  Ambiguous:      <issue + resource ids, ... | none>
  Next run:       explicit invocation only
```

## Never

- Dispatch without an active hash-valid control, held exact lock, fresh provider reads,
  and a per-issue hash-bound authorization from the final resolver decision.
- Treat GitHub merge, canceled Linear status, title matching, or local state as blocker completion.
- Auto-confirm a runnable expansion, auto-recover a stale lock, or guess an unknown field.
- Maintain a queue, baton, relay flag, daemon, polling loop, sleep, or default automation.
- Delete/terminate runtime resources, mark issues complete, or invoke `superset-orchestrate`.
- Leave the lock held after any success, refusal, error, interruption, or partial spawn.
- Hold the project lock while waiting for user confirmation.
- Run `git commit`, `git push`, or `git rebase`.
