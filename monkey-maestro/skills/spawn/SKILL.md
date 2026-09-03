---
name: spawn
description: Use when the user explicitly wants one Linear-authorized issue placed in one task-linked Superset workspace. Enforces live project capacity and makes one approved workspace-create attempt.
argument-hint: "<linear-issue-id> [--host <id>] [--superset-project <id>] [--agent <name>]"
effort: high
allowed-tools: Bash(node:*), Bash(superset tasks get:*), Bash(superset workspaces create:*), mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__list_comments, mcp__claude_ai_Linear__list_issues, mcp__claude_ai_Linear__get_issue
---

# spawn

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This skill makes at
most one direct Superset workspace-create attempt. It never changes Linear status or
relations, merges, pushes, changes dependencies, or inspects runtime state before acting.

## Workflow

1. Require one exact project-bound Linear issue identifier and fetch it with relations.
   Capture its exact project, status type, title, branch, description, and `blockedBy`
   identifiers.
2. In parallel, exhaustively page that project's comments and issue membership. Fetch
   every listed issue with relations so status, blockers, and started capacity come from
   one complete live project read.
3. Pass the complete marker-bearing comments through `scripts/records.mjs
resolve-controls`. A usable active control supplies host, Superset project, agent, and
   `maxConcurrency`. If no control exists, require all three explicit transport values
   and use concurrency `1`. An inactive or conflicting control refuses dispatch.
4. A `completed` or `canceled` issue returns `already-terminal`. A blocked issue or any
   unknown project, status, membership, or blocker fact refuses dispatch. A ready issue
   may proceed only when `max(0, maxConcurrency - startedCount)` is positive. An
   explicitly named `started` issue may proceed because it already consumes capacity.
5. Resolve the exact Superset task with `superset tasks get <issueId> --json`. Require its
   exact Linear issue and project binding. Render the deterministic workspace name and
   complete worker prompt.
6. Show one final preview containing live status, blockers, capacity, task, host, Superset
   project, agent, workspace name, and worker prompt. Ask exactly once:

```text
Create this issue workspace with the displayed authorization? (y / cancel)
```

7. On approval, attempt exactly one command:

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

8. Report the direct result. Do not list or repair workspaces, inspect terminals, retry
   ambiguous mutation evidence, or write execution telemetry.

## Worker prompt

Start with `linear-devotee:greet <issueId>`. Include the exact issue objective, scope,
acceptance criteria, required checks, and the ownership and handoff rules from the shared
contract.

## Report

```text
monkey-maestro:spawn report
  Issue:      <id / live status / blockers>
  Capacity:   <started count> of <maxConcurrency>
  Task:       <task id>
  Workspace:  created | existing | failed | none
  Result:     dispatched | already-terminal | blocked | full | canceled | degraded
```
