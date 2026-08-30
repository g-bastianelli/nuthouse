---
name: reconcile
description: Use when the user explicitly asks Monkey Maestro to recover or audit an active Linear project after drift, ambiguous runtime identity, provider uncertainty, or lost coordinator context. Performs one complete Linear, GitHub, and Superset reconstruction, repairs durable authority, prepares an orchestration handoff, and exits without dispatching work.
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

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is the explicit
full recovery/audit path, not Maestro's normal issue-transition loop. It rebuilds
authoritative state once, repairs representable durable records, prepares a Coordinator
table handoff for `orchestrate`, and exits. Never dispatch work from this skill.

## Step 0 — Resolve control, host, and lock

1. Require one exact Linear project id. Dispatch
   `monkey-maestro:project-snapshot-loader` with `MODE: control-only`. Require one valid
   latest active control. Missing, invalid, or inactive control produces a no-mutation
   report.
2. Run `superset status --json` and require `hostId === control.targetHostId`. If not,
   stop and instruct invocation on the configured host; never create a coordinator
   workspace implicitly.
3. Acquire `${CLAUDE_PLUGIN_DATA}/locks` through
   `scripts/project-lock.mjs acquire` with project/run/current-terminal metadata. If
   `LOCK_HELD`, report its owner and exit without external mutation. Stale-lock recovery
   requires exact runtime proof and explicit recovery; never guess.
4. Every held interval is a `try/finally` whose `finally` calls
   `scripts/project-lock.mjs release` with the exact token. Always release the lock on
   every exit, including provider failure, ambiguity, interruption, and declined graph
   confirmation. Never hold it while waiting for human input.

## Step 1 — Reload all authority

Dispatch the Linear loader first:

```text
Agent({
  subagent_type: 'monkey-maestro:project-snapshot-loader',
  description: 'reload complete Linear recovery truth',
  prompt: `PROJECT_ID: <project id>
MODE: full`,
})
```

Build `MANAGED_ISSUE_IDS` from its exact `issues[].id`. Build `OWNED_ISSUE_IDS` as the
sorted union of those ids, control baseline ids, `executionIssueIds`, and every valid
execution-record issue id. Then dispatch:

```text
Agent({
  subagent_type: 'monkey-maestro:runtime-inspector',
  description: 'reload complete Superset and GitHub recovery truth',
  prompt: `TARGET_HOST_ID: <control.targetHostId>
SUPERSET_PROJECT_ID: <control.supersetProjectId>
LINEAR_PROJECT_ID: <control.projectId>
REPOSITORY: <control.repository>
RUN_ID: <control.runId>
MANAGED_ISSUE_IDS: <fresh exact identifiers>
OWNED_ISSUE_IDS: <fresh exact identifiers>`,
})
```

Require the reloaded control to match the pre-lock run, revision, and decision hash and
remain active. Linear, GitHub, or Superset unavailability; unknown host/project; changed
authority; or an unscoped required unknown blocks recovery mutation. Preserve and report
trustworthy scoped observations.

## Step 2 — Reconstruct through the pure resolver

1. Write one ephemeral raw snapshot envelope containing the exact `expectedControl`,
   untouched `linearSnapshot`, untouched `runtimeSnapshot`, and
   `confirmedRunnableExpansions`. Run
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/reconcile-state.mjs <packet>`. Do not manually
   reconstruct, filter, or rewrite provider arrays.
2. The pure composer joins exact Superset task bindings, annotates active-run records,
   preserves the complete `ready` workspace inventory as `workspaceInventory`, and
   passes the full unfiltered workspaces plus separate Linear/runtime unknowns.
3. The resolver:
   - counts owned live non-terminal task executions against capacity and never duplicates
     a task id;
   - reports a correlated live runtime for a known terminal managed issue as `residual`
     only when one active-run issue/task/workspace/terminal/host execution record matches;
   - keeps a mismatched record occupying capacity conservatively;
   - accepts only Linear completion or one exact human waiver for dependency satisfaction;
   - returns active, residual, repair, inspect, blocked, quarantine, confirmation,
     `confirmedExitedIssueIds`, and an orchestration-ready candidate set;
   - returns a representable `nextBaseline` that retains prior edges for unknown or
     quarantined components.
4. A known terminal managed issue may use a complete `ready` workspace inventory to
   prove an exact recorded workspace absent; missing, partial, filtered, different-host,
   or different-project inventory cannot prove exit.

## Step 3 — Confirm expansions and persist the recovery decision

1. If the resolver reports a newly runnable expansion caused by a new issue, removal, or
   reversed edge, release the lock before showing the exact change and ask:

   ```text
   Adopt this recovered graph expansion? (y / no)
   ```

   On `no`, preserve the prior decision baseline and exit. On `y`, retain only those
   confirmed issue ids, reacquire the lock, reload both providers and control, and rerun
   the resolver with `confirmedRunnableExpansions`. Changed evidence invalidates the
   approval; never reuse stale snapshots.

2. Compare the resolver's `nextBaseline`, fresh active ownership ids, and
   `confirmedExitedIssueIds` with the control. Build the next revision through
   `records.mjs build-control`, preserving policy and replacing only the representable
   baseline, decision hash, `executionIssueIds`, `exitedExecutionIssueIds`, and timestamp.
   Never persist the loader's raw `currentBaseline`; partial and invalid graph
   observations are not authority.
3. Update the existing project comment and reload it. A failed or ambiguous write leaves
   the previous authority in force and reports recovery failure.
4. For every exact `repair` entry, build an `outcome: repaired` active-run execution
   record and persist it as a Linear issue comment. Unknown or ambiguous identities are
   reported and never guessed.
5. Construct the same Task/Dependencies/Workspace/Host/Terminal/Status/Result Coordinator
   table used by `orchestrate` from the final full snapshots. Keep it in conversation as
   the handoff so a following `monkey-maestro:orchestrate <project-id>` can reuse it
   without another full hydration.

## Step 4 — Release and report

Release the token-matched lock in `finally`, remove only this invocation's ephemeral raw
packet, print the recovery report, and exit. The next action is explicit invocation only:
`monkey-maestro:orchestrate <project-id>` resumes normal coordination from the validated
handoff. Do not invoke it automatically.

## Final Report

```text
monkey-maestro:reconcile report
  Project/run:        <project id> / <run id>
  Revision/hash:      <revision> / <decision hash>
  Lock:               acquired then released | held by <owner> | failed
  Providers:          Linear <state> · GitHub <state> · Superset <state>
  Active/residual:    <exact runtime rows | none>
  Repaired:           <issue → Linear record, ... | none>
  Blocked/quarantine: <issue + reason, ... | none>
  Ambiguous:          <issue + resource ids, ... | none>
  Coordinator handoff: ready | partial | unavailable
  Dispatched:         none — recovery never launches work
  Next:               explicit monkey-maestro:orchestrate <project-id>
```

## Never

- Never dispatch work, create a workspace, launch an agent, or invoke
  `monkey-maestro:spawn`.
- Never treat GitHub merge, canceled Linear status, title matching, or local state as
  blocker completion.
- Never auto-confirm a graph expansion, auto-recover a stale lock, or guess unknown data.
- Never maintain a queue, baton, relay flag, daemon, polling loop, or automation.
- Never leave the lock held or hold it across human input.
- Never delete/terminate runtime resources or mutate Linear issue status.
- Never run `git commit`, `git push`, or `git rebase`.
