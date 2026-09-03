---
name: orchestrate
description: Use when the user wants Monkey Maestro to run an active Linear project. Counts live started issues, fills the remaining slots with ready work, and attempts one Superset workspace creation per selected issue.
argument-hint: "<linear-project-id>"
effort: medium
allowed-tools: Bash(node:*), Bash(superset tasks get:*), Bash(superset workspaces create:*), mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__list_comments, mcp__claude_ai_Linear__list_issues, mcp__claude_ai_Linear__get_issue
---

# orchestrate

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Linear alone decides
capacity and readiness. Superset receives selected work but never changes the plan.

## Workflow

1. Require one exact Linear project id. In parallel, exhaustively page its comments and
   issue membership. Fetch every listed issue with relations; issue detail calls may run
   in parallel.
2. Pass the complete marker-bearing comments through `scripts/records.mjs
resolve-controls`. Require one usable active control for the exact project. Inactive,
   absent, or unusable control creates no workspace.
3. Require a complete live Linear project issue set. A failed project, page, or issue read
   creates no workspace. Classify only from current status types and `blockedBy`
   identifiers:
   - count every known `started` issue;
   - candidates are known `backlog`, `triage`, and `unstarted` issues;
   - a candidate is ready only when every blocker is present and terminal;
   - terminal issues are `completed` or `canceled`.
4. Compute `slots = max(0, maxConcurrency - startedCount)`. Sort ready issues by Linear
   identifier and select the first `slots`. Started issues consume capacity but are never
   redispatched. If no slot or no ready issue exists, return `idle` without Superset.
5. For every selected issue, fetch its exact current Linear detail and exact Superset task
   in parallel with sibling issues. Require the task to be bound to that Linear issue and
   project. A failed issue or task read fails only that selected issue; do not backfill it
   with another issue during this invocation.
6. Render one deterministic workspace name and complete worker prompt per valid issue.
   Attempt exactly one branch-scoped command per issue, with sibling attempts settled
   independently:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --name <workspaceName> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

7. Report each command result as created, already existing, or failed and return. Never
   list or repair workspaces, inspect terminals, launch a second agent command, poll a
   worker, retry ambiguous creation, or refresh Linear for another batch.

## Worker prompt

Start with `linear-devotee:greet <issueId>`. Include the exact issue objective, scope,
acceptance criteria, required checks, and the ownership and handoff rules from the shared
contract. The worker must not merge, push, change dependencies, or infer Linear completion.

## Report

```text
monkey-maestro:orchestrate report
  Project/run: <project id> / <run id>
  Linear:      started <n> · ready <n> · slots <n>
  Selected:    <stable issue ids or none>
  Superset:    <per-issue created / existing / failed>
  Exit:        idle | dispatched | degraded | stopped
```
