---
name: start
description: Use when the user wants to activate Monkey Maestro for a Linear project. Resolves ordinary local Superset transport, writes one minimal control after one approval, and enters orchestration.
argument-hint: "<linear-project-id> [--host <id>] [--superset-project <id>] [--agent <name>] [--max-concurrency <1-10>]"
effort: high
allowed-tools: Bash(node:*), Bash(git rev-parse:*), Bash(superset status:*), Bash(superset projects list:*), Bash(superset agents list:*), mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__list_comments, mcp__claude_ai_Linear__save_comment
---

# start

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Before approval this
skill performs only read-only configuration discovery. It never reads runtime scheduling
state and never changes Linear issue lifecycle or dependencies.

## Workflow

1. Resolve one exact Linear project with `get_project`.
2. Exhaustively page project comments and pass the complete marker-bearing set through
   `scripts/records.mjs resolve-controls`. If a schema-v2 control is already active and
   the invocation has no overrides, report `already-active` and enter
   `monkey-maestro:orchestrate <project-id>` without writing another comment.
3. Resolve each selector independently: explicit argument, then the latest usable
   control, then local discovery. Keep `maxConcurrency` from explicit or inherited
   control, otherwise use `4`; require 1–10.
4. For a missing host, run `superset status --json`. Use its non-empty `hostId` only when
   it reports `running: true` and `healthy: true`.
5. For a missing project, inspect the current path and
   `git rev-parse --path-format=absolute --git-common-dir`, then run
   `superset projects list --local --json`. Prefer the exact id following
   `.superset/worktrees/` in the current path when present in the list; otherwise use the
   single project whose path owns the current path or Git common directory; otherwise use
   the sole listed local project.
6. For a missing agent, run `superset agents list --host <targetHostId> --json`. Use the
   active runtime (`codex` or `claude`) only when that exact preset or id is listed;
   otherwise use the sole listed agent.
7. Failed, malformed, empty, or ambiguous discovery supplies no value. Gather every
   unresolved selector and its deterministic available choices into one concise
   clarification. Apply the reply as named values; do not ask separate questions.
8. Build the minimal schema-v2 successor with `scripts/records.mjs build-control`: fresh
   run id, `active: true`, revision one above the latest usable control or `1`, and the
   resolved non-empty selectors.
9. Show the complete project, host, Superset project, agent, concurrency, revision, and
   source of every value. Then ask exactly once:

```text
Apply this Maestro activation/update to Linear? (y / cancel)
```

10. On `y`, append one Linear project control comment. On denial, do nothing. Re-page the
    comments once and require the exact successor; report a failed verification without
    blindly writing again.
11. Enter `monkey-maestro:orchestrate <project-id>`.

The clarification in step 7 is configuration input, not mutation approval. There is
exactly one final Linear mutation gate after the fully resolved preview.

## Report

```text
monkey-maestro:start report
  Project/run: <project id> / <run id>
  Control:     schema v2 · revision <n> · active
  Transport:   <host> / <Superset project> / <agent>
  Concurrency: <n>
  Next:        monkey-maestro:orchestrate <project id>
```
