---
name: orchestrate
description: Use when the user wants Monkey Maestro to conduct an active Linear project continuously — hydrate its durable graph once, launch every ready issue into isolated Superset workspaces up to concurrency, monitor workers, and promote dependents through targeted Linear reads. Use for "continue Maestro", "run the project", or "launch everything parallelizable"; use reconcile only for explicit full recovery.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Bash(superset --version), Bash(superset auth whoami:*), Bash(superset status:*), Bash(superset terminals --help), Bash(superset terminals list:*), Bash(superset terminals read:*), Bash(superset terminals send:*), Bash(superset hosts list:*), Bash(superset hosts wake:*), Bash(superset agents list:*), Bash(superset agents create:*), Bash(superset projects list:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset workspaces get:*), Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__save_comment
---

# orchestrate

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned line only when non-empty. Skip on failure or disabled voice; never retry or mention it.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Voice

Read `../../persona.md` at the start. Apply it only around concise progress and decision
messages; coordinator data, commands, records, and worker prompts stay neutral.

**Scope:** this skill only. Restore the session voice after the final report.

This skill is **rigid** — preserve the authority, dispatch, and monitoring invariants.

## Language

Match the user's language. Preserve ids, record fields, CLI flags, tool names, and worker
envelopes exactly.

## When you're invoked

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is Maestro's
normal execution path. Linear is durable graph and lifecycle memory, Superset is the
workspace/terminal transport, and this conversation owns the live Coordinator table.
Keep coordinating while workers run. Do not replace that table with a local queue, relay
file, or repeated full reconciliation.

## Step 0 — Establish the control surface

1. Require one exact Linear project id. Dispatch
   `monkey-maestro:project-snapshot-loader` with `MODE: control-only`; require one active,
   hash-valid control and capture its exact `runId`, `revision`, `decisionHash`, host,
   Superset project, agent, and concurrency.
2. Run `superset auth whoami --json`, `superset terminals --help`, and require terminal
   `list`, `read`, `send`, and `close`. Then run `superset status --json`,
   `superset hosts list --json`, `superset agents list --local --json`, and
   `superset workspaces list --host <host> --project <project> --json`. Never log in or
   change configuration. Require the current host to equal `control.targetHostId`; wake
   that exact host only when the user has already authorized project execution and it is
   known offline.
3. Look for a Coordinator table already present in the active conversation. Treat it as
   a reuse candidate only when its project, run, revision, decision hash, host, and
   Superset project match the freshly loaded control and every running row still has an
   exact execution record or terminal identity.
4. Before any reuse, dispatch `project-snapshot-loader` with `MODE: targeted` for the
   sorted, deduplicated union of every Coordinator task and its approved baseline
   blockers, using the candidate table's expected run, revision, and decision hash. Do
   this even when no row is running or ready. Require the exact requested scope, the same
   active control, known baseline-equal relations, and fresh normalized status and waiver
   facts. Merge lifecycle and waiver changes into the table; relation drift produces
   `reconcile_required`. A partial, unavailable, or ambiguous refresh stops dispatch
   without falling back to stale data or automatic full reconciliation. Never derive
   readiness from the pre-refresh table.
5. Reuse the table only after that targeted lifecycle refresh succeeds. When there is no
   matching candidate table, or its runtime identities do not correlate, perform the one
   hydration in Step 1 instead.

## Step 1 — Hydrate once and build the Coordinator table

When Step 0 finds no matching reusable table, perform this full hydration exactly once
per orchestration invocation. Across one uninterrupted conversation session, hydrate at
most once. Hydration is outside the project lock:

```text
Agent({
  subagent_type: 'monkey-maestro:project-snapshot-loader',
  description: 'hydrate durable Linear orchestration state',
  prompt: `PROJECT_ID: <project id>
MODE: full`,
})
```

Then dispatch `monkey-maestro:runtime-inspector` once for the same control and complete
managed/owned issue set. Compose the untouched snapshots through
`scripts/reconcile-state.mjs`; never pass a targeted snapshot to that full-project
resolver. Require the reloaded control to match Step 0, the observed graph to be
representable against its `decisionBaseline`, and required provider data to be known.
Any removal, reversal, new runnable issue, ambiguous execution identity, or required
unknown that cannot be safely represented yields `reconcile_required` for the affected
component. Do not run reconciliation automatically.

Build and keep this compact Coordinator table in conversation context:

| Field        | Value                                                              |
| ------------ | ------------------------------------------------------------------ |
| Task         | exact Linear issue identifier                                      |
| Dependencies | exact blocker identifiers from the approved baseline               |
| Workspace    | exact Superset workspace id or `_none_`                            |
| Host         | configured host id                                                 |
| Terminal     | exact agent terminal id or `_none_`                                |
| Status       | `pending`, `ready`, `running`, `completed`, `blocked`, or `failed` |
| Result       | latest durable result/evidence or `_none_`                         |

Reconstruct rows from Linear issues, control, waivers, execution records, worker-result
records, and the one runtime inventory. Existing exact runtimes become `running`; never
launch duplicates. For one runtime, select the latest active-run result by `recordedAt`;
different canonical results tied at the latest timestamp are ambiguous and produce
`reconcile_required`. A `SUPERSET_WORKER_DONE` result marks worker execution completed, but
only fresh Linear `status.type === completed` or one exact human waiver satisfies a
dependency edge.

## Step 2 — Prepare every ready issue

1. Derive `ready` rows from the approved baseline. An issue is ready only when its own
   normalized Linear status is startable, every blocker is Linear-completed or exactly
   waived, required fields are known, and it has no owned runtime. Respect
   `maxConcurrency` after counting all exact active/guarded executions.
2. Select one full batch up to available capacity in stable Linear order. Launch every
   ready independent issue before monitoring any newly launched worker.
3. Acquire the exact target-host project lock through `scripts/project-lock.mjs acquire`.
   Under the lock, dispatch one targeted Linear read for the union of batch candidates,
   their baseline blockers, and their direct dependents:

   ```text
   Agent({
     subagent_type: 'monkey-maestro:project-snapshot-loader',
     description: 'validate one orchestration transition',
     prompt: `PROJECT_ID: <project id>
   MODE: targeted
   ISSUE_IDS: <sorted exact identifiers>
   EXPECTED_RUN_ID: <run id>
   EXPECTED_REVISION: <revision>
   EXPECTED_DECISION_HASH: <decision hash>`,
   })
   ```

   Require the same active control, exact requested scope, known status/relations, and
   blocker facts equal to the approved baseline. A new, missing, reversed, ambiguous, or
   partial relation yields `reconcile_required`; quarantine only its affected component.

4. Resolve `superset tasks get <issueId> --json` for all remaining candidates and require
   exact Linear task bindings. Re-list the project's complete workspace inventory once,
   group by exact task id, and reject one/multiple existing matches as existing/ambiguous.
   Build a hash-bound authorization for every surviving candidate with
   `records.mjs build-authorization` using the same lock token and targeted eligibility.

## Step 3 — Dispatch the batch directly

For each authorized issue, run the shared Superset primitive directly. Independent issue
sequences may run concurrently, but the order inside each sequence is fixed:

1. `superset workspaces create --host <host> --project <project> --name <name> --task
<taskId> --json`, with no agent flag.
2. `superset workspaces get <workspaceId> --host <host> --json`; require the exact host,
   project, task id, worktree, and branch.
3. Snapshot terminals, then run `superset agents create --workspace <workspaceId> --host
<host> --agent <agent> --prompt <prompt> --json`.
4. Re-list terminals and require the exact returned/new terminal id.
5. Build `nuthouse:maestro-execution` through `records.mjs build-execution` and persist it
   as a Linear issue comment. Preserve partial/degraded runtimes and never retry an
   ambiguous mutation.

The worker prompt is bounded by issue scope and contains the objective, dependencies,
acceptance criteria, verification, and this instruction:

```text
Work on Linear issue <identifier> in this isolated workspace. First run
linear-devotee:greet <identifier>; greet alone owns the In Progress transition. Then use
the normal planning, implementation, verification, and PR skills. Do not broaden scope,
overwrite unrelated work, invoke a project dispatcher, or mark the issue completed.
End your final response with exactly one envelope:

SUPERSET_WORKER_DONE
task: <identifier>
summary: <one-line outcome>
files: <comma-separated paths or none>
checks: <commands and outcomes>
handoff: <next-step context or none>

or

SUPERSET_WORKER_BLOCKED
task: <identifier>
reason: <specific blocker>
needs: <decision, access, or dependency required>
```

Update all successfully launched rows to `running`. Release the exact lock token in
`finally` after the whole dispatch batch and its Linear receipts. Always release the
project lock before monitoring, terminal follow-ups, user questions, or any wait.

## Step 4 — Monitor every worker

1. In each measured pass, read all running workers before acting on one:

   ```text
   superset terminals read --workspace <workspace> --host <host> \
     --terminal <terminal> --max-lines 240 --json
   ```

   Keep progress visible. Do not infer completion from terminal presence, title,
   attachment, or silence.

2. For malformed/missing envelopes, inspect the surrounding output. Send clarification
   or a requested handoff into the same session with `superset terminals send`; never
   launch a replacement merely because output is incomplete.
3. On `SUPERSET_WORKER_DONE`, verify the surrounding evidence, build a
   `nuthouse:maestro-result` with `records.mjs build-result`, and persist its summary,
   files, checks, and handoff to Linear. Normalize `files: none` to `[]`; otherwise split
   the comma-separated paths, trim, deduplicate, and pass an array to the record helper.
   Mark the worker row `completed` only after the envelope evidence is credible. A failed
   result write is degraded traceability, not permission to redispatch. Until a targeted
   read also proves native Linear completion or exact terminal exit, its live execution
   remains capacity-guarding even though the worker result is completed.
4. On `SUPERSET_WORKER_BLOCKED`, persist a blocked result with its reason/needs and mark
   the row `blocked`. Send a follow-up only when the missing input is already available
   and in scope; otherwise surface the exact need to the user.
5. If surrounding output proves an unrecoverable worker failure, send one diagnostic
   follow-up when useful, then persist a `failed` result with its reason/needs. Never
   launch a replacement until the failure inputs, prompt, or worker choice have changed.
6. In the same measured pass, batch one targeted Linear reread for the union of every
   `Linear waiting` issue, its direct dependents from the approved baseline, and their
   known blockers. Deduplicate the issue ids and use one loader call, not one call per
   row. This keeps polling cheap when a DONE envelope arrives before Linear completion.
   A waiting row stays in the coordinator and prevents session exit until the targeted
   read observes a lifecycle transition, the control stops, or reconciliation becomes
   required.

## Step 5 — Advance incrementally

After each accepted envelope or observed Linear lifecycle transition:

1. Compute the finished issue's direct dependents from the approved baseline. Run one
   targeted Linear read for only that issue, those direct dependents, and their known
   blockers. Never run a full project reload between issue transitions.
2. Require the latest control still active with the same run/revision/decision hash.
   `active: false` stops future dispatch immediately while existing workers continue.
3. Compare every refreshed relation with the approved baseline. Any new, removed,
   reversed, unknown, or cross-project edge produces `reconcile_required` for that
   component. Preserve unrelated running work and continue known independent components.
4. Promote a dependent only when every blocker is freshly Linear-completed or has one
   valid human waiver. A worker envelope, terminal exit, GitHub merge, or PR state never
   substitutes for Linear completion.
5. When a worker-DONE issue becomes freshly Linear-completed, release its logical slot
   only after its current-run execution/result/workspace/terminal identities correlate
   exactly; classify a still-live runtime as residual. Missing or mismatched identity
   remains capacity-guarding.
6. When capacity opens, return immediately to Step 2 and dispatch the complete newly
   ready batch before the next monitoring pass. Keep the same Coordinator table; do not
   rehydrate the project.

Keep monitoring while running workers or `Linear waiting` rows remain and the user has
not interrupted or stopped the project. Exit when all known work is terminal, remaining
work is blocked with neither a running worker nor a Linear-waiting row, authority
requires reconciliation, or the user asks to stop. On later context loss, Linear
control/execution/result records plus one fresh runtime inventory rebuild the table; no
private queue is needed.

## Subagent dispatch

```text
Agent({
  subagent_type: 'monkey-maestro:project-snapshot-loader',
  description: '<hydrate durable state | validate one transition>',
  prompt: `PROJECT_ID: <project id>
MODE: <control-only | full | targeted>
ISSUE_IDS: <required only for targeted>
EXPECTED_RUN_ID: <required only for targeted>
EXPECTED_REVISION: <required only for targeted>
EXPECTED_DECISION_HASH: <required only for targeted>`,
})
```

## Final Report

```text
monkey-maestro:orchestrate report
  Project/run:     <project id> / <run id>
  Revision/hash:   <revision> / <decision hash>
  Hydration:       reused | one full load | failed
  Capacity:        <running>/<max> · <available> available
  Coordinator:     <task/status/workspace/terminal rows>
  Dispatched:      <issue → workspace/terminal, ... | none>
  Completed:       <issue → result, ... | none>
  Blocked/failed:  <issue → reason, ... | none>
  Linear waiting:  <worker-done issues not yet Linear-completed | none>
  Reconcile:       not-needed | reconcile_required (<scope/reason>)
  Next:            monitoring | dispatching ready batch | explicit monkey-maestro:reconcile <project-id> | finished
```

## Never

- Never invoke `monkey-maestro:spawn`; project orchestration executes the same verified
  workspace-first primitive directly in one locked batch.
- Never run a full project reload between issue transitions or invoke reconciliation
  automatically after drift.
- Never hold the project lock while monitoring, sending terminal follow-ups, waiting for
  a worker, or asking the user.
- Never treat a DONE envelope, merged PR, terminal exit, or canceled issue as Linear
  blocker completion.
- Never create a duplicate task workspace, retry an ambiguous mutation, or delete a
  partial/degraded workspace.
- Never keep project execution state in a local queue, relay, baton, daemon, or automation.
- Never mutate Linear issue status; `linear-devotee:greet` owns In Progress and Linear's
  normal human/delivery workflow owns completion.
- Never run `git commit`, `git push`, `git rebase`, or destructive Superset commands.
