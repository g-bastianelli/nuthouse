---
name: orchestrate
description: Supervise an authorized Linear project through issue delivery, native review, and protected merge. Uses one Superset workspace per issue and refills capacity from fresh Linear state when workers notify the loaded supervisor session.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Read, Write, Edit, Bash(node:*), Bash(sleep:*), Bash(git rev-parse:*), Bash(git check-ignore:*), Bash(superset tasks get:*), Bash(superset tasks list:*), Bash(superset workspaces list:*), Bash(superset workspaces get:*), Bash(superset workspaces create:*), Bash(superset workspaces update:*), Bash(superset agents create:*), Bash(superset agents read:*), Bash(superset terminals list:*), Bash(superset terminals read:*), Bash(superset terminals send:*), Agent, mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__list_issue_statuses, mcp__claude_ai_Linear__save_issue
---

# orchestrate

> Agent resolution: before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`
> and select the active runtime name for `monkey-maestro:linear-reader`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Linear alone decides
capacity and readiness. Superset receives selected work but never changes the plan.
Apply **Supervisor role** on every turn, including feedback after compaction. Before
acting on user feedback, read **User feedback** in
[`references/supervision.md`](references/supervision.md); repository fixes always go to a worker.

## Workflow

1. Require one exact Linear project id and establish **Supervisor ownership** from the
   shared contract. An active control alone does not prove this session owns supervision.
   Unknown ownership allows read-only inspection, not a second supervisor. When recovering after
   compaction or considering a local checkpoint, read the **Checkpoint locally** section of
   [`references/supervision.md`](references/supervision.md) before writing any ledger.
   Refresh recorded observations before acting. For a received event, first read
   [`references/notifications.md`](references/notifications.md) and reject known duplicates
   or mismatched captured identities before additional reads. Dispatch
   `monkey-maestro:linear-reader` in `MODE: control` for an actionable event, or
   `MODE: project` for entry, explicit resume, or a capacity decision. Consume only its
   exact project identity, complete marker set, requested minimal rows, and scoped unknowns.
2. Pass the comments through `scripts/records.mjs resolve-controls`. Require one usable
   active control for the exact project with `deliveryScope: issue-through-merge` and its
   valid stored `workspaceGroup`. Reuse that exact group throughout this run. Inactive,
   absent, unsupported, or unusable authority allows observation only; create no workspace,
   reserve no issue, change no tags, and send no new work. Explain when explicit `start` is needed.
3. Before dispatch or accepting a resumed notification destination, read
   [`references/notifications.md`](references/notifications.md). Capture and prove the
   actual master destination. Prove each selected host's route before issue reservation;
   when it has no existing source workspace, use the first selected workspace after setup,
   as the dispatch reference specifies. On a received event,
   apply its identity, deduplication, and receipt boundaries before any mutation. Read the
   current control and only the affected issue/PR/session facts first. Read
   [`references/supervision.md`](references/supervision.md) to handle the event and establish
   actual delivery evidence. A question, wait, or resource handoff goes directly to step 9
   after its scoped action unless fresh facts call for a capacity decision. Verify an owned
   worker's claimed completion before using it to advance to the full project read.
4. At entry, explicit resume, or before a capacity decision, dispatch `MODE: project` if
   the current observation has not already supplied it and require a complete live Linear
   project issue set. Revalidate its current control. A failed project, page, or issue read
   creates no workspace. Classify only from current status types and `blockedBy`
   identifiers:
   - count every known `started` issue;
   - candidates are known `backlog`, `triage`, and `unstarted` issues;
   - a candidate is ready only when every blocker is present and terminal;
   - terminal issues are `completed` or `canceled`.
     If no nonterminal or unknown issue remains, report `complete` from the observed Linear
     facts. Report owned issue delivery evidence separately; never invent a PR for externally
     completed or canceled work.
5. Compute `slots = max(0, maxConcurrency - startedCount)`. Sort ready issues by Linear
   identifier and select the first `slots`. Started issues consume capacity but are never
   redispatched. No free slot means await existing workers' notifications. If no owned worker or ready
   issue can progress, report the blocking Linear facts and checkpoint; do not spin.
6. For a non-empty selection, dispatch the reader in `MODE: selected` with exactly those ids. It
   refreshes those candidates plus their direct blockers. Reclassify every selected issue
   from this bounded result and require it to remain ready. In parallel, fetch each exact
   Superset task using the shared contract's exact tracker binding. A changed, unknown,
   terminal, or non-ready issue, or a failed detail/task read, fails only that selected issue;
   do not backfill from this snapshot.
7. Before creating any workspace, read
   [`references/dispatch.md`](references/dispatch.md). Apply its placement,
   create-or-reuse with binding readback, setup readiness, started reservation, current-control recheck, worker-prompt, and launch
   contract. This writes only an authorized issue's started state; `deliver` owns completion.
8. On explicit resume, when a prior launch needs inspection, or when a proven owned
   workspace needs group verification/repair, read
   [`references/supervision.md`](references/supervision.md). Inspect the affected owned worker,
   verify run groups on explicit resume, and relay only actionable scoped follow-ups to
   an existing session that is awaiting that input.
   A tag update is limited to restoring this run's missing group on a proven owned
   workspace, preserving every other tag. Observe actual delivery evidence;
   collect actionable questions while independent issues continue. A user stop or inactive
   control ends new dispatch and recovery, leaving existing jobs intact.
9. Once authorized dispatches and event actions settle, end the turn with `waiting` and
   the pending notifications or exact manual resumption steps. A loaded master is awakened
   by its native message route. Do not schedule a sleep, periodic terminal read, Linear
   refresh, acknowledgment event, or routine worker follow-up. Before any refill, return
   to the complete fresh project/control read in step 4. An inactive control ends new
   actions even when an event arrived before stop. Report `complete` only from observed
   terminal Linear facts and keep owned delivery evidence separate.

This skill creates no daemon, scheduler, or durable queue. Native runtime messaging does
not reopen a closed session, discover an unreported worker failure, or wake on external
Linear edits. Explicit inspection or resumption handles those cases.

## Report

```text
monkey-maestro:orchestrate report
  Project/run: <project id> / <run id>
  Linear:      started <n> · ready <n> · slots <n> (current capacity read or last observation)
  Work:        <per-issue running / waiting / blocked / done, with evidence>
  Group:       <exact workspaceGroup from control; placement verified or unresolved>
  Superset:    <per-issue dispatched / already-existing / create-failed / launch-failed / launch-unknown>
  Questions:   <issue id, decision needed, and affected scope or none>
  Recovery:    <same workspace/session and next missing step or none>
  Notifications: <verified destination and route | unavailable; receipt is not delivery>
  Supervisor:  awaiting notifications | handling event | checkpointed | ended
  Exit:        complete | waiting | degraded | stopped
```
