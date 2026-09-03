---
name: status
description: Use automatically when the user supplies a Linear project URL or asks to inspect one project's Maestro state. Reports the current control, live Linear frontier, and available capacity without inspecting Superset.
argument-hint: "<linear-project-url-or-id>"
effort: medium
allowed-tools: Bash(node:*), mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__list_comments, mcp__claude_ai_Linear__list_issues, mcp__claude_ai_Linear__get_issue
---

# status

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This skill is
read-only and Linear-only. Never call Superset or GitHub and never mutate control, issue
status, or relations.

## Workflow

1. Require one exact Linear project reference.
2. Exhaustively page the project's comments and issues. Fetch every listed issue with
   relations; issue detail calls may run in parallel. A failed page makes that provider
   input unavailable rather than partial.
3. Pass the complete marker-bearing control comments through
   `scripts/records.mjs resolve-controls`. Treat an unavailable or conflicting latest
   control as unusable; do not guess.
4. Classify the live issues directly:
   - terminal: `completed` or `canceled`;
   - started: every known `started` row;
   - ready: `backlog`, `triage`, or `unstarted`, with every current `blockedBy` row
     present and terminal;
   - blocked: a known candidate with a known non-terminal blocker;
   - unknown: any row or dependency decision lacking complete Linear facts.
5. Compute `remaining = max(0, maxConcurrency - startedCount)` when control is usable.
   Report stable issue-id lists and counts. Never use runtime state to adjust them.

## Report

```text
monkey-maestro:status report
  Project:   <id / name>
  Control:   active | inactive | not-configured | unusable
  Linear:    started <n> · ready <n> · blocked <n> · terminal <n> · unknown <n>
  Capacity:  <remaining> of <maxConcurrency>
  Superset:  not inspected
  Next:      orchestrate | start | idle | repair control
```
