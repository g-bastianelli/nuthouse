---
name: stop
description: Use when the user wants to stop future Monkey Maestro dispatches for a Linear project. Appends one approved active:false control while leaving existing Superset work untouched.
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
2. No usable control returns `not-configured`. An inactive usable control returns
   `already-stopped`. Neither writes anything.
3. Build a minimal schema-v2 successor with `scripts/records.mjs build-control`, retaining
   the run and transport configuration, setting `active: false`, incrementing revision,
   and using the current `updatedAt`.
4. Show the exact project, run, revision, and `active: true -> false`, then ask once:

```text
Stop future Maestro dispatches? Existing Superset work keeps running. (y / cancel)
```

5. On approval, append one Linear project comment. On denial, do nothing. Dispatch the
   reader once more in `MODE: control` and require the exact successor; report failed
   verification without rewriting.

## Report

```text
monkey-maestro:stop report
  Project/run: <project id> / <run id>
  Control:     schema v2 · revision <n> · inactive
  Existing:    Superset work untouched
  Next:        idle
```
