---
name: start
description: Use when the user wants to activate Monkey Maestro for a Linear project. Writes one minimal control v2 after a single approval and enters Linear-first orchestration; graph receipts, GitHub, and Superset availability are not activation prerequisites.
argument-hint: "<linear-project-id> [--host <id>] [--superset-project <id>] [--agent <name>] [--max-concurrency <1-10>]"
effort: high
allowed-tools: Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__save_comment
---

# start

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Activation configures
transport; it does not verify, freeze, hash, or adopt the Linear graph. Do not call GitHub,
Superset, the project snapshot loader, or the project lock before writing control.

## Workflow

1. Resolve one exact Linear project id with `get_project`.
2. Dispatch `monkey-maestro:control-loader`, then pass its complete envelope plus exact
   `expectedProjectId` through `scripts/records.mjs resolve-controls`. Retry an
   unavailable/invalid loader envelope once.
3. Leave an active control unchanged and report `already-active` only when the resolver's
   `sourceSchemaVersion` is `2` and the invocation supplied no explicit transport,
   agent, or concurrency override. Then enter
   `monkey-maestro:orchestrate <project-id>`. An active source-v1 control requires
   migration, and any explicit override requests a control update; both continue through
   the preview and verified v2 write below.
4. Resolve configuration from explicit arguments first, then the latest usable active or
   inactive control: `targetHostId`, `supersetProjectId`, `defaultAgent`, and
   `maxConcurrency`. Record `defaultAgent` from an explicit `--agent` or the latest control,
   and leave it unset when neither names one — activation never contacts the host, so it
   never assumes an agent name either. `orchestrate` and `spawn` settle it against the
   host inventory at launch, which is the only authoritative moment.
   Default concurrency is `4`. Require host
   and Superset project ids rather than guessing them. Concurrency must be 1–10.
5. Build a schema-v2 successor through `scripts/records.mjs build-control` with a fresh
   `runId`, `active: true`, revision one above the latest usable control or `1`, and now as
   `updatedAt`. It contains only the fields in the shared contract.
6. Show the complete mutation preview and ask once:

```text
Apply this Maestro activation/update with the displayed host, Superset project, agent, and concurrency? (y / cancel)
```

7. On `y`, save one Linear project comment. On denial, create nothing.
8. Re-dispatch `control-loader`, re-run envelope validation/resolution, and require the
   exact written project/run/config/revision with `active: true`. Report an unverifiable
   write as `degraded-control`; never rewrite blindly.
9. Enter `monkey-maestro:orchestrate <project-id>`. Orchestration performs transport checks
   only if Linear selects non-terminal work.

## Report

```text
monkey-maestro:start report
  Project/run: <project id> / <run id>
  Control:     schema v2 · revision <n> · active
  Transport:   <host> / <Superset project> / <agent> / concurrency <n>
  Next:        monkey-maestro:orchestrate <project id>
```
