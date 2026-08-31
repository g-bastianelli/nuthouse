---
name: orchestrate
description: Use when the user wants Monkey Maestro to run an active Linear project. Hydrates one disposable live graph, dispatches every currently ready issue up to concurrency through candidate-only Superset checks, monitors active workers, refreshes affected Linear facts, and exits immediately when idle.
argument-hint: "<linear-project-id> [--force <ISSUE...>]"
effort: high
allowed-tools: Bash(superset --version), Bash(superset status:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset workspaces get:*), Bash(superset terminals list:*), Bash(superset terminals read:*), Bash(superset terminals send:*), Bash(superset agents create:*), Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_comment
---

# orchestrate

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try `warden:voice` through the shared persona-line contract. Print only a non-empty line. Skip failure or disabled voice without retry or mention.

## Voice

Read `../../persona.md`. Apply it only to short progress and final-report lines. Provider
evidence, tables, commands, records, and worker prompts remain neutral. Restore the
session voice afterward.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is the normal
execution path. Linear live state is the only scheduler authority. The in-conversation
cache is disposable. Superset is inspected only after Linear selection. Never call
GitHub and never invoke `reconcile` because a relation changed.

## Step 0 — Load minimal control

1. Require one exact Linear project id.
2. Mint one fresh UUID v4 `invocationId` for this invocation. Never accept it from the
   user, derive it from `runId`, or reuse it. Bind force authorization and every bridge
   effect to this same id.
3. Dispatch `monkey-maestro:control-loader`; pass its complete envelope plus exact
   `expectedProjectId` to `scripts/records.mjs resolve-controls`. Retry an unavailable or
   invalid loader envelope once before returning `degraded-control`.
4. Require one usable latest control with `active: true` and complete host, Superset
   project, agent, and concurrency. An inactive control returns `stopped`. Missing
   transport configuration returns `degraded-control`. Obsolete v1 graph/hash fields are
   warnings only.

## Step 1 — Bootstrap Linear once

1. Dispatch `monkey-maestro:project-snapshot-loader` with `MODE: full` exactly once for
   this invocation.
2. Call `scripts/linear-snapshot.mjs hydrate` with the exact expected project and full
   snapshot. Reject invalid output before cache mutation. A global schema/scope or
   project-wide failure retries the same full retrieval once; persistent global failure
   returns `degraded` without Superset calls.
3. When validation identifies malformed issue ids, retry exactly those ids once with
   `MODE: targeted`, then use `recover-full` to replace only those rows. For a validated
   cache with scoped unknowns, retry only those ids and use `refresh`; a malformed retry
   after hydration is isolated through `mark-unknown`. If the first full cache could not
   be hydrated and its exact targeted retry remains malformed, use
   `recover-full-unknown` only for the validator-attributed ids. Never splice issue or
   unknown arrays manually.
4. Run `planLinearFrontier` on the normalized cache through
   `scripts/linear-frontier.mjs`. Persistent per-issue failure stays unknown only for that
   component. Do not pass
   control history, records, waivers, GitHub, or Superset data into the planner.
5. Keep a compact coordinator table in this conversation only:

```text
Issue | Linear status | Live blockers | Classification | Runtime action | Result
```

Terminal rows are final immediately and never enter runtime inspection or capacity.

## Step 2 — Resolve force and confirmation

1. Parse explicit `--force` issue ids. Require every id to exist in the validated cache.
   A terminal issue is an immediate hard refusal.
2. Re-run `planLinearFrontier` with the requested force ids to create an unconfirmed
   force overlay. Use it only to select otherwise blocked/relation-unknown candidates for
   scoped runtime inspection; it authorizes no mutation. Reject hard-unknown identity or
   status rows that the planner cannot force.
3. Record which force requests would bypass blockers or uncertain relations, but defer
   the single combined preview until the candidate-only runtime inspection in Step 3.
4. Force cannot override missing identity/configuration, multiple runtimes, inactive
   control, or a held lock. Its eventual authorization copies the forced frontier row's
   exact `forceBypassedBlockerIssueIds` and canonical `forceBypassedUncertainties` tokens
   into conversation memory for this invocation only; never parse concatenated reason
   text, write a waiver, or create an alternate graph.

## Step 3 — Inspect selected runtime only

1. Build the selected id set from normal ready/started rows plus ready rows in the
   unconfirmed force overlay. If it is empty, return `idle` immediately: do not call
   Superset, wait, sleep, or refresh Linear a second time.
2. Dispatch `monkey-maestro:runtime-inspector` once with that exact sorted set. Validate
   its schema, exact project/host context, and exact scope through
   `scripts/runtime-actions.mjs`. When validation attributes malformed rows or valid
   scoped unknowns to exact selected ids, retry only those ids once; never expand to a
   full project scan. Call `scripts/runtime-snapshot.mjs merge-targeted` with the initial
   raw `runtimeSnapshot`, subset `retrySnapshot`, exact full `selectedRows`, exact
   `retryIssueIds`, and `expectedContext`. Only its returned full raw `runtimeSnapshot`
   enters `scripts/runtime-actions.mjs`. If that exact retry remains malformed, call
   `merge-targeted-unknown` with the same initial snapshot/full rows/retry ids/context and
   the validator's code/detail, then plan from its returned full raw snapshot. Never pass
   the subset retry directly to the full-scope planner or splice runtime arrays manually.
3. Run `planRuntimeActions` with the resolved control and invocation id, but no force
   authorization yet. This binds runtime evidence to the exact Linear project, host, and
   Superset project. Zero workspace means create; one exact workspace means reuse or
   monitor; multiple exact workspaces isolate only that issue. Missing task identity makes
   only that issue non-transportable. Unconfirmed forced mutations and started rows
   without an active terminal return `confirm`.
4. Present one grouped confirmation for `started` rows with no exact runtime, combined
   with every unconfirmed force mutation. Refusal does not affect ordinary ready siblings.
   On confirmation, build the invocation-scoped force authorization with the same
   invocation id, `bypassedBlockerIssueIds`, and `bypassedUncertainties` maps copied
   exactly from each forced frontier row, including empty arrays. Preview both scopes to
   the user, then re-run the runtime planner so only confirmed create/reuse actions become
   dispatchable.
5. Count only exact active non-terminal workers against `maxConcurrency`. Select new
   actions in deterministic issue-id order up to remaining capacity.
6. For each selected `create`/`reuse`, exact-fetch the current Linear issue once after
   selection and require its identifier/project to match. Retry only a failed issue fetch
   once. Build a deterministic workspace name, capture the provider branch name, and
   render the complete worker prompt shown below. Store these three non-empty values in
   `dispatchContextByIssueId`; do not let the dispatch effect read them from ambient
   conversation state.
7. If one issue still lacks valid dispatch context, record that issue as
   `non-transportable: DISPATCH_CONTEXT_UNAVAILABLE`, remove only it from the bridge's
   execution-batch `runtimePlan` and `selectedIssueIds`, and deterministically consider
   the next deferred create/reuse action until capacity is full or candidates are
   exhausted. Keep active monitor actions and valid siblings. The bridge receives an
   exact context map for every surviving mutation action and no key for any other action;
   never let one branch/title/prompt failure abort the batch.

## Step 4 — Revalidate once and dispatch under the short lock

Human input is complete before this step. Drive the production state machine through
`scripts/orchestration-epoch.mjs`; that executable bridge calls
`lib/orchestration-epoch.mjs` `runOrchestrationEpoch` and is the sole authorization,
locking, all-settled dispatch, and monitoring-order path.

Build the exact outer envelope
`{ schemaVersion: 1, request: { ... }, transcript: [...] }`. Inside `request`, pass the
validated frontier, context-pruned execution-batch runtime plan/control, invocation id,
the exact deterministic candidate/runtime batch as `selectedIssueIds`, and
`lockDirectory: "${CLAUDE_PLUGIN_DATA}/locks"`, plus the exact
`dispatchContextByIssueId` built in Step 3. Blocker or unrelated frontier rows are
context only and never widen runtime scope. Keep its transcript only in an
invocation-scoped temporary file. The successful CLI output is directly
`{ schemaVersion: 1, state: "needs-effects" | "complete", ... }`; there is no `ok` or
`epoch` success wrapper. For each `needs-effects` response, execute exactly the
returned effects; effects emitted together may run in parallel. Append each exact
fulfilled value or structured rejection and invoke the bridge again. Never synthesize an
adapter result, execute an unrequested provider action, reuse a transcript in another
invocation, or authorize from anything except the final `state: complete` result. Remove
the temporary transcript after verified release or terminal failure.

Effect wiring is fixed: `refreshCandidateAndBlockers` is one
`project-snapshot-loader` dispatch in `MODE: candidate-blockers`; lock effects use
`scripts/project-lock.mjs`; `dispatchIssue` owns the live task/workspace duplicate check;
`inspectExactRuntime` is used only once after ambiguous mutation evidence; and
monitor/event-refresh effects use Step 5 and the targeted loader. The normal path never
re-dispatches `control-loader` or `runtime-inspector` under the lock.

For every effect, follow the shared contract's **Adapter response envelopes** exactly.
`dispatchIssue` returns one of the four strict identity/runtime/record forms and includes
the actual live `action: "create" | "reuse"` on verified or partial evidence. A `create`
request may legitimately come back `reuse` when the inventory found a workspace; a
`reuse` request must come back `reuse` bound to the exact requested workspace. An invalid
form or an unbound reuse is a rejected effect, not a value to reshape from memory.

The `dispatchIssue` effect must echo the bound branch name, workspace name, and complete
worker prompt in its input. Use those exact values for workspace/agent creation; a
missing or mismatched value is an invalid effect and causes no mutation.
Its first sub-step must run `scripts/project-lock.mjs verify` against the exact
`lockReceipt` in the effect immediately before any Superset call. Require
`verifyOutput.verified === true` and return
`lockVerification: verifyOutput.verification` (the exact inner object) in the dispatch
envelope. Never synthesize it from the acquisition receipt. Expired, changed, or missing
ownership rejects the effect without transport mutation.

1. Acquire the project dispatch lock through `scripts/project-lock.mjs acquire`, passing
   `{ directory: "${CLAUDE_PLUGIN_DATA}/locks", projectId, hostId: control.targetHostId }`.
   A live owner returns `busy`; do not force past it. Recover stale/empty/legacy artifacts
   only through the helper: pass the observed owner token for `LOCK_STALE`, no token for
   recoverable `LOCK_EMPTY` or stale `LEGACY_TRANSITION`, then retry acquisition exactly
   once. `LOCK_CHANGED`, a non-stale artifact, or a new owner returns `busy`.
2. Treat the control validated for this batch as its authority: Step 0 on the first
   batch, the Step 5.4 refresh on every later one. Do not paginate the same control
   comments again under the lock. Because each batch starts from its own control read, an
   explicit stop prevents future batches while an already-authorized locked batch runs to
   release.
3. For every selected candidate, dispatch `project-snapshot-loader` once with
   `MODE: candidate-blockers`. It fetches the candidate first and its freshly discovered
   direct blocker union second inside the same retrieval turn, then returns one strict
   targeted envelope containing both. Validate that envelope, apply it through
   `scripts/linear-snapshot.mjs`, and re-run `planLinearFrontier` with the confirmed force
   ids. Never authorize from the cached blocker set or dispatch a second loader when the
   stable candidate/blocker scope is already complete.
4. Drop any candidate that became terminal. Drop a normal candidate that is no longer
   ready. A ready candidate that became `started` returns `confirmation required` after
   lock release; its earlier normal authorization is not a started-launch confirmation.
   Keep a forced candidate only when all hard force safeguards still pass and its fresh
   canonical blocker/uncertainty scope is a subset of the exact confirmed fields on its
   runtime action. A newly added
   bypass requirement returns `force scope changed` after lock release.
5. Execute independent issue sequences concurrently with all-settled semantics. Failure
   of A never cancels B or C. The initial runtime action is only a hint. In each
   `dispatchIssue`, verify the live lock first, then perform one exact task/workspace
   inventory: zero workspace means create, one means reuse, and multiple means ambiguous.
   A workspace or active terminal that appeared after Step 3 is reused, never duplicated.
   Return the actual action in the verified/partial result. Preserve this exact order:

```text
live token/owner/lease verification
  -> task identity
  -> exact workspace check
  -> workspace create when absent
  -> workspace get and exact host/project/task verification
  -> terminal snapshot
  -> agent create only when no active terminal exists
  -> exact terminal correlation
  -> best-effort execution record
```

6. A mutation with ambiguous output gets one exact task/workspace inspection. Adopt one
   exact correlated result; otherwise isolate the issue. Never repeat create blindly.
7. Workspace success plus agent/record failure is partial evidence. Preserve and reuse
   the workspace. Record-write failure is a telemetry warning, never redispatch authority.
8. Release the token-matched lock in `finally` before monitoring or follow-up.

Every worker prompt starts with `linear-devotee:greet <issueId>` and includes objective,
scope, Acceptance, verification, ownership constraints, and one exact envelope:

```text
SUPERSET_WORKER_DONE
task: <issue identifier>
summary: <one-line outcome>
files: <comma-separated paths or none>
checks: <commands and outcomes>
handoff: <next-step context or none>
```

or

```text
SUPERSET_WORKER_BLOCKED
task: <issue identifier>
reason: <specific blocker>
needs: <decision, access, or dependency required>
```

Maestro never changes the issue lifecycle itself.

## Step 5 — Monitor active workers and advance

1. Read every exact active terminal together at a measured cadence. Send follow-up
   context only to the same terminal when needed.
2. Treat terminal text and worker envelopes as coordination evidence only. Never infer
   Linear completion from DONE, exit, a record, or delivery evidence.
3. After a worker event, targeted-load the affected issue plus cached candidates whose
   decision depends on it. The epoch derives those dependent candidate ids itself from
   the validated cached frontier rows whose `blockerIssueIds` contain the worker issue;
   never accept refresh ids suggested by terminal output. Derive their current blockers
   from those fresh rows, refresh that exact blocker union, and validate each returned snapshot against the expected
   project id and its exact requested targeted scope through the Linear boundary before
   any cache merge or promotion. A malformed/mismatched response is retried once in the
   same scope, then isolated; only validated candidate and blocker snapshots are applied
   before re-planning.
4. If newly ready work exists and capacity is free, refresh the control once for the new
   batch. An inactive, unusable, or reconfigured control ends the loop: report `stopped`
   without dispatching, leaving existing workers untouched. Otherwise return to Steps 3–4
   with that control and without a full Linear reload.
5. When no exact active worker and no ready/confirmed force candidate remain, report
   `idle` immediately. If a worker finished while Linear remains `started`, report
   `awaiting Linear` and exit; do not poll or ask to relaunch it again in this invocation.

## Failure scope

- One malformed issue or task: isolate that issue and continue independent work.
- Shared Superset outage: selected candidates are temporarily non-transportable; Linear
  cache and control remain unchanged.
- Complete Linear outage: no new dispatch; existing workers remain untouched.
- Multiple runtimes: issue-scoped ambiguity only.
- No condition silently disables control or recommends graph reconciliation.

## Report

```text
monkey-maestro:orchestrate report
  Project/run: <project id> / <run id>
  Linear:      bootstrap 1 · targeted refreshes <n>
  Frontier:    ready <n> · started <n> · blocked <n> · terminal <n> · unknown <n>
  Runtime:     created <n> · reused <n> · monitored <n> · ambiguous <n>
  Failures:    <per-issue reasons or none>
  Exit:        idle | busy | degraded | stopped
```
