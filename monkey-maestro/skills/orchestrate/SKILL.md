---
name: orchestrate
description: Use when the user wants Monkey Maestro to run an active Linear project. Counts live started issues, fills remaining slots, and safely creates or reuses one Superset workspace per selected issue.
argument-hint: "<linear-project-id>"
effort: medium
allowed-tools: Read, Bash(node:*), Bash(superset tasks get:*), Bash(superset workspaces create:*), Bash(superset agents create:*), Agent
---

# orchestrate

> Agent resolution: before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`
> and select the active runtime name for `monkey-maestro:linear-reader`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Linear alone decides
capacity and readiness. Superset receives selected work but never changes the plan.

## Workflow

1. Require one exact Linear project id and dispatch `monkey-maestro:linear-reader` in
   `MODE: project`. Consume only its exact project identity, complete marker comment set,
   minimal status/blocker rows, and scoped unknowns.
2. Pass the comments through `scripts/records.mjs resolve-controls`. Require one usable
   active control for the exact project. Inactive,
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
5. Dispatch the reader once in `MODE: selected` with exactly the selected issue ids. It
   refreshes those candidates plus their direct blockers. Reclassify every selected issue
   from this bounded result and require it to remain ready. In parallel, fetch each exact
   Superset task. A changed, unknown, terminal, or non-ready issue, or a failed detail/task
   read, fails only that selected issue; do not backfill it during this invocation.
6. Render the shared deterministic issue workspace name
   `linear-<lowercaseIssueId>-<taskDigest>`, where `taskDigest` is the first eight
   hexadecimal characters of SHA-256 over the exact task id. Render the complete worker
   prompt per valid issue. Attempt exactly one branch-scoped workspace create-or-reuse per
   issue, without an embedded agent launch, with sibling attempts settled independently:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --name <workspaceName> \
  --json
```

7. Require the response to distinguish `created` from `reused` and return one exact
   task-bound workspace id. Launch only after an explicit `created` result. A `reused` or
   ambiguous result never launches an agent; report `already-existing` and the confirmed
   recovery command `monkey-maestro:spawn <issueId>`. This makes workspace creation the
   atomic duplicate guard across concurrent orchestration invocations. For a newly created
   workspace, attempt one launch:

```text
superset agents create \
  --workspace <workspaceId> \
  --host <targetHostId> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

8. Report `dispatched` only when the agent command confirms success. An explicit launch
   refusal is `launch-failed`: preserve the workspace, do not retry or backfill, and report
   `monkey-maestro:spawn <issueId>` as recovery. A transport error or malformed response
   is `launch-unknown` and must not recommend immediate relaunch; report
   `monkey-maestro:reconcile <projectId> <issueId>` instead. Never poll a worker or refresh
   Linear for another batch.

## Worker prompt

Start with `linear-devotee:greet <issueId>`. Preserve the selected issue's title, branch,
and description verbatim. Extract scope, acceptance criteria, and required checks only
when the description states them; otherwise label each missing section
`not specified in Linear` and never infer it. Include the ownership and handoff rules from
the shared contract. The worker must not merge, push, change dependencies, or infer
Linear completion.

## Report

```text
monkey-maestro:orchestrate report
  Project/run: <project id> / <run id>
  Linear:      started <n> · ready <n> · slots <n>
  Selected:    <stable issue ids or none>
  Superset:    <per-issue dispatched / already-existing / create-failed / launch-failed / launch-unknown>
  Recovery:    <per-issue spawn / reconcile command or none>
  Exit:        idle | dispatched | degraded | stopped
```
