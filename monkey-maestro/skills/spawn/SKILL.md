---
name: spawn
description: Use when the user explicitly wants either one Linear-authorized issue launched or recovered in a task-linked Superset workspace, or one free-form quick fix launched in a branch-bound workspace.
argument-hint: "<linear-issue-id | quick-fix objective> [--quick] [--host <id>] [--superset-project <id>] [--agent <name>]"
effort: high
allowed-tools: Read, Bash(node:*), Bash(git rev-parse:*), Bash(superset status:*), Bash(superset projects list:*), Bash(superset agents list:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset terminals list:*), Bash(superset agents create:*), Agent
---

# spawn

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This skill makes at
most one workspace-create attempt and one agent-launch attempt after one approval. It
never changes Linear status or relations, merges, pushes, or changes dependencies.

`spawn` is a manual dispatch path. Never read or obey a Linear project control, even when
one exists. Controls belong only to project activation, orchestration, status, stop, and
project-wide reconciliation.

## Mode selection

1. Use **issue mode** when the positional input is exactly one Linear issue identifier
   and `--quick` is absent.
2. Use **quick-fix mode** when `--quick` is present or the positional input is a free-form
   objective rather than exactly one issue identifier. Remove `--quick` and recognized
   transport flags from the objective but preserve the user's wording.
3. If neither mode has a non-empty identifier or objective, ask one concise clarification
   before any discovery. Never reinterpret an unavailable Linear issue as a quick fix.

## Issue mode

1. Before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`, select the
   active runtime name for `monkey-maestro:linear-reader`, and dispatch it in
   `MODE: selected` for only the exact Linear issue. Require its exact project id, title,
   branch, description, status, blocker ids, and current direct blocker rows.
2. A `completed` or `canceled` issue returns `already-terminal`. A blocked issue or any
   unknown project, status, membership, or blocker fact refuses dispatch. A ready or
   explicitly named `started` issue may proceed. Manual issue spawn does not calculate
   project capacity and does not read the rest of the project.
3. Resolve the exact Superset task with `superset tasks get <issueId> --json`. Require its
   exact Linear issue and project binding. Calculate `taskDigest` as the first eight
   hexadecimal characters of SHA-256 over the exact task id. Set the workspace name to
   `linear-<lowercaseIssueId>-<taskDigest>` and use `bindingArgs = --task <taskId>`. This is
   the same issue identity required of project orchestration.

## Quick-fix mode

1. Use the complete non-empty free-form objective as the source of truth. Do not dispatch
   `linear-reader`. There is no Linear issue, task, project control, or capacity
   calculation in this mode.
2. Normalize the objective by trimming it and replacing every whitespace run with one
   ASCII space. For the slug, lowercase that normalized value, apply Unicode NFKD, remove
   combining marks, replace every run outside `a-z0-9` with one hyphen, trim hyphens, take
   the first 48 characters, and trim any final hyphen again. Calculate the first eight
   hexadecimal characters of SHA-256 over the normalized objective with Node. Use
   `quick-fix` when the slug would otherwise be empty.
3. Set the branch name to `quick/<slug>-<digest>` and the workspace name to
   `quick-<slug>-<digest>`. Use
   `bindingArgs = --branch <branchName> --skip-branch-prefix` so Superset preserves that
   exact branch instead of applying the project's configured prefix. This stable identity
   makes the same objective recover the same workspace while distinct objectives do not
   collide merely because their readable slugs match.
4. Build the worker prompt from the exact objective plus the quick-fix ownership and
   handoff rules in the shared contract. The worker prompt must not invoke
   `linear-devotee:greet` or imply that a Linear issue exists.

## Transport discovery

Resolve host, Superset project, and agent independently from an explicit argument, then
from narrow local discovery. Never consult a project control.

1. For a missing host, run `superset status --json`. Use its non-empty `hostId` only when
   it reports `running: true` and `healthy: true`.
2. For a missing project, inspect the current path and
   `git rev-parse --path-format=absolute --git-common-dir`, then run
   `superset projects list --local --json`. Prefer the exact id following
   `.superset/worktrees/` in the current path when present in the list; otherwise use the
   single project whose path owns the current path or Git common directory; otherwise use
   the sole listed local project.
3. For a missing agent, run `superset agents list --host <targetHostId> --json`. Use the
   active runtime (`codex` or `claude`) only when that exact preset or id is listed;
   otherwise use the sole listed agent.
4. Failed, malformed, empty, or ambiguous discovery supplies no value. Gather every
   unresolved selector and its deterministic available choices into one concise
   clarification. The reply supplies configuration only; it is not mutation approval.

## Workspace inspection and approval

1. List workspaces once with the resolved Superset project and exact workspace-name
   search. In issue mode keep only exact task-bound matches. In quick-fix mode keep only
   exact name-and-branch matches. Multiple exact matches are ambiguous and refuse
   mutation; an unavailable or malformed listing also refuses.
2. With one matching workspace, list live terminals for that exact workspace. A live
   terminal returns `already-running` without approval or launch. Zero matches previews
   `create`; one match with no live terminal previews `recover`. An unavailable or
   malformed terminal result refuses mutation. Treat any live terminal conservatively as
   an existing worker because the CLI exposes no stronger agent/shell discriminator.
3. Show one final preview containing mode, issue status and blockers or quick-fix
   objective, task or branch, host, Superset project, agent, create/recover action,
   workspace name, and the complete worker prompt. Ask exactly once:

```text
Create or recover this displayed worker? (y / cancel)
```

## Mutation

1. On approval, use the existing exact workspace or attempt one create without embedding
   an agent. Expand `bindingArgs` to the exact mode-specific argument defined above:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  <bindingArgs> \
  --name <workspaceName> \
  --json
```

2. A `create` action launches only when the response explicitly says `created` and
   returns the exact mode-bound workspace id. If it says `reused`, another invocation won
   the create race: report `concurrent-reuse` and launch nothing. For `recover`, retain
   the exact preflight workspace id.
3. Immediately list the chosen workspace's live terminals once more. If a worker
   appeared, report `already-running` and stop. If the check is unavailable or malformed,
   launch nothing. Otherwise attempt one agent launch and require explicit success before
   reporting `dispatched`:

```text
superset agents create \
  --workspace <workspaceId> \
  --host <targetHostId> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

4. Preserve a successfully created or recovered workspace when launch explicitly fails
   and report `launch-failed`. A transport error or malformed launch response is
   `launch-unknown`; never retry during the same invocation. In issue mode direct the user
   to read-only `monkey-maestro:reconcile <projectId> <issueId>`. In quick-fix mode report
   the exact workspace and require a later identical spawn to repeat both terminal checks
   before any recovery launch. Never write execution telemetry.

## Worker prompts

An issue worker prompt starts with `linear-devotee:greet <issueId>` and preserves the
selected issue's title, branch, and description verbatim. Extract scope, acceptance
criteria, and required checks only when the description states them; otherwise label each
missing section `not specified in Linear` and never infer it. Include the shared ownership
rules.

A quick-fix worker prompt starts directly with the exact objective, requires repository
instructions to be read before editing, scopes ownership to this fix and workspace,
requires appropriate checks, and forbids reverting others' edits, merging, pushing,
changing dependencies, or changing Linear. It ends with a concise DONE/BLOCKED handoff.

## Report

```text
monkey-maestro:spawn report
  Mode:       issue | quick-fix
  Work:       <issue id / live status / blockers | quick-fix objective>
  Binding:    <task id | branch name>
  Workspace:  created | reused | none
  Result:     dispatched | already-running | concurrent-reuse | launch-failed | launch-unknown | already-terminal | blocked | canceled | degraded
```
