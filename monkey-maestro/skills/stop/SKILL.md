---
name: stop
description: Stop future project dispatch and recovery by recording active:false. Existing issue workers retain their authorized scope and keep running.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Read, Bash(node:*), Agent, mcp__claude_ai_Linear__save_comment
---

# stop

> Agent resolution: before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`
> and select the active runtime name for `monkey-maestro:linear-reader`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Stop is Linear-only.
Never call Superset or GitHub, change issue status or relations, or terminate/delete an
existing workspace, terminal, or agent.

## Workflow

1. Require one exact Linear project id. Dispatch `monkey-maestro:linear-reader` in
   `MODE: control` and resolve its complete marker-bearing set with
   `scripts/records.mjs resolve-controls`.
2. Missing control returns `not-configured`; invalid or ambiguous control reports the exact
   problem and grants no dispatch authority. An inactive usable control returns
   `already-stopped`. None writes anything.
3. Build a schema-v3 successor with `scripts/records.mjs build-control`, retaining
   the exact run id and stored `workspaceGroup` plus transport configuration, setting `active: false`, incrementing revision,
   and using the current `updatedAt`.
4. Show the exact project, run, unchanged group, revision, and `active: true -> false`. An explicit stop
   request already authorizes this scoped write; ask only when that intent is unresolved:

```text
Stop future Maestro dispatches? Existing Superset work keeps running. (y / cancel)
```

5. With authorization, append one Linear project comment. On denial, do nothing. Dispatch the
   reader once more in `MODE: control` and require the exact successor with the same
   run/group pair; report failed
   verification without rewriting. Later notifications permit observation only: no new
   worker instruction, dispatch, recovery, or group repair. Existing issue workers and
   their own bounded waits retain their original scope. Stop neither closes the master
   runtime nor changes a session-scoped inbound setting; that setting ends with the session.

## Report

```text
monkey-maestro:stop report
  Project/run: <project id> / <run id>
  Control:     schema v3 · revision <n> · inactive
  Group:       <unchanged workspaceGroup from control; placement not inspected>
  Existing:    Superset work untouched
  Next:        idle
```
