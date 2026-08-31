---
name: stop
description: Use when the user wants to stop future Monkey Maestro dispatches for a Linear project. Performs one Linear-only minimal-control update to active:false; Superset availability can never prevent stop and existing workers remain untouched.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__save_comment
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# stop

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try `warden:voice` through the shared persona-line contract. Print only a non-empty line; skip failure or disabled voice without mention.

## Voice

Read `../../persona.md`. Apply it to wrapper lines only. Keep control evidence neutral.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Stop is Linear-only.
Never call Superset, GitHub, the runtime inspector, project snapshot loader, or project
lock. Never terminate or delete a workspace, terminal, or agent.

## Workflow

1. Require one exact Linear project id. Dispatch `monkey-maestro:control-loader` and pass
   its complete envelope plus exact `expectedProjectId` to
   `scripts/records.mjs resolve-controls`. Retry an unavailable/invalid envelope once.
2. No usable control returns `not-configured`. An inactive usable control returns
   `already-stopped`. Neither case writes anything.
3. Build a schema-v2 successor containing only the projected operational fields, with
   `active: false`, revision + 1, and current `updatedAt`.
4. Show the exact old/new active state, run, transport config, and revision. Ask:

```text
Future dispatches stop. Existing workspaces and agents keep running.
Stop Maestro for this project? (y / cancel)
```

5. On `y`, save one Linear project comment. On denial, do nothing.
6. Re-dispatch `control-loader`, re-run envelope validation/resolution, and require the
   exact successor with `active: false`. A failed verification reports
   `degraded-control`; never retry the write blindly.

## Report

```text
monkey-maestro:stop report
  Project/run: <project id> / <run id>
  Control:     schema v2 · revision <n> · inactive
  Existing:    workers untouched
  Next:        idle
```
