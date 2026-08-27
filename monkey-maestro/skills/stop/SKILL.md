---
name: stop
description: Use when the user wants to stop future Monkey Maestro dispatches for a Linear project — "stop Maestro", "disable project execution", "baton down", or "stop the reconciler". Revision-updates the durable Linear control record to inactive and leaves every existing workspace and agent running.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Bash(node:*), Bash(superset status:*), Read, Write, Agent, mcp__claude_ai_Linear__save_comment
---

# stop

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. Skip on failure or disabled voice; never retry or mention it.

## Voice

Read `../../persona.md` at the start. Apply it only around plain record/report blocks.

**Scope:** this skill only; restore the session voice after the report.

This skill is **rigid** — execute steps in order.

## Language

Match the user's language; preserve technical identifiers.

## When you're invoked

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is a durable
control change, not process termination and not a legacy `halt` alias.

## Step 0 — Load authority

1. Require one Linear project id. Dispatch `monkey-maestro:project-snapshot-loader` with
   `MODE: control-only` and require one valid latest control plus its comment id.
2. If no control exists, report `not-configured`. If `active: false`, report
   `already-stopped`. Neither case mutates anything.
3. Build the preview successor through `scripts/records.mjs build-control`, preserving project,
   run, repository, host, Superset project, agent, concurrency, graph hash, exact
   decision baseline, `executionIssueIds`, and `exitedExecutionIssueIds` while setting `active: false`,
   `updatedAt: now`, and revision + 1.

## Step 1 — Mutation gate

Show old/new active state, run id, revision, and this explicit consequence:

```text
Future dispatches stop. Existing workspaces and agents keep running.
Stop Maestro for this project? (y / cancel)
```

Continue only on `y`.

## Step 2 — Update and verify

1. After approval, require `superset status --json` to report the control's exact target
   host. Acquire the project lock through `scripts/project-lock.mjs acquire`. If held,
   report `not-stopped — reconciliation/control
mutation in progress` and ask the user to invoke stop again; mutate nothing.
2. Under the lock, reload the control and require the same comment id, run id, revision,
   decision hash, and `active: true` that the user previewed. Rebuild the successor from
   that exact record. Any change invalidates the approval and exits without mutation.
3. Update the existing Linear project comment by its exact comment id; never create a
   competing control revision. Reload it and require `active: false` plus the expected
   revision. A failed/ambiguous write means the project remains active for safety.
4. Release the exact lock token through `scripts/project-lock.mjs release` in `finally`
   on every outcome.

Do not run any Superset delete/stop command, change an issue status, or touch a workspace.

## Final Report

```text
monkey-maestro:stop report
  Project:       <Linear project id>
  Run:           <runId>
  Active:        false | unchanged
  Revision:      <N>
  Lock:          acquired then released | held | failed
  Existing work: untouched
  Future spawn:  blocked | still active (<write failure>)
```

## Never

- Stop, delete, archive, or terminate a Superset workspace, terminal, or agent.
- Mark any Linear issue completed/canceled or rewrite dependencies.
- Treat a local file as the control record.
- Mutate without explicit confirmation or update an ambiguous control.
- Hold a project lock while waiting for stop confirmation.
- Run `git commit`, `git push`, or `git rebase`.
