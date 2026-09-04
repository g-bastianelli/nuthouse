---
name: spawn
description: Use when the user explicitly wants one Linear-authorized issue launched or safely recovered in one task-linked Superset workspace after checking for an existing worker.
argument-hint: "<linear-issue-id> [--host <id>] [--superset-project <id>] [--agent <name>]"
effort: high
allowed-tools: Read, Bash(node:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset terminals list:*), Bash(superset agents create:*), Agent
---

# spawn

> Agent resolution: before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`
> and select the active runtime name for `monkey-maestro:linear-reader`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This skill makes at
most one workspace-create attempt and one agent-launch attempt after one approval. It
never changes Linear status or relations, merges, pushes, or changes dependencies.

## Workflow

1. Require one exact project-bound Linear issue identifier. Dispatch
   `monkey-maestro:linear-reader` in `MODE: selected` for only that issue, deriving its
   exact project id and returning its title, branch, description, status, and blocker ids.
2. Dispatch the reader in `MODE: project` for that exact project. Use only its complete
   marker comments and minimal project status/blocker rows to calculate live capacity and
   verify the target's current classification.
3. Pass the marker comments through `scripts/records.mjs resolve-controls`. A usable
   active control supplies host, Superset project, agent, and
   `maxConcurrency`. If no control exists, require all three explicit transport values
   and use concurrency `1`. An inactive or conflicting control refuses dispatch.
4. A `completed` or `canceled` issue returns `already-terminal`. A blocked issue or any
   unknown project, status, membership, or blocker fact refuses dispatch. A ready issue
   may proceed only when `max(0, maxConcurrency - startedCount)` is positive. An
   explicitly named `started` issue may proceed because it already consumes capacity.
5. Resolve the exact Superset task with `superset tasks get <issueId> --json`. Require its
   exact Linear issue and project binding. Render the deterministic workspace name and
   complete worker prompt. List workspaces once with the configured project plus exact
   workspace-name search, then keep only exact task-bound matches. Multiple matches are
   ambiguous and refuse mutation; an unavailable or malformed listing also refuses.
6. With one matching workspace, list live terminals for that exact workspace. A live
   terminal returns `already-running` without approval or launch. Zero matches previews
   `create`; one match with no live terminal previews `recover`. This is the only path that
   may relaunch an explicitly named `started` issue. An unavailable or malformed terminal
   result refuses mutation. Treat any live terminal conservatively as an existing worker;
   the CLI does not expose a stronger agent/shell discriminator.
7. Show one final preview containing live status, blockers, capacity, task, host, Superset
   project, agent, create/recover action, workspace name, and worker prompt. Ask exactly
   once:

```text
Create or recover this issue worker with the displayed authorization? (y / cancel)
```

8. On approval, use the existing exact workspace or attempt one create without embedding
   an agent:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --name <workspaceName> \
  --json
```

9. A `create` action launches only when the response explicitly says `created` and returns
   the exact task-bound workspace id. If it says `reused`, another invocation won the
   create race: report `concurrent-reuse` and launch nothing. For `recover`, retain the
   exact preflight workspace id.
10. Immediately list the chosen workspace's live terminals once more. If a worker appeared,
    report `already-running` and stop. If the check is unavailable or malformed, launch
    nothing. Otherwise attempt one agent launch and require explicit success before
    reporting `dispatched`:

```text
superset agents create \
  --workspace <workspaceId> \
  --host <targetHostId> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

11. Preserve a successfully created or reused workspace when launch explicitly fails and
    report `launch-failed`. A transport error or malformed response is `launch-unknown`
    and directs the user to read-only `monkey-maestro:reconcile <projectId> <issueId>`
    before any later recovery. Never retry ambiguous mutation evidence or write execution
    telemetry.

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
  Workspace:  created | reused | none
  Result:     dispatched | already-running | concurrent-reuse | launch-failed | launch-unknown | already-terminal | blocked | full | canceled | degraded
```
