---
name: reconcile
description: Use when the user explicitly asks Monkey Maestro to inspect Superset transport for a project. Produces an optional read-only issue/runtime correlation report and never repairs or gates scheduling.
argument-hint: "<linear-project-id> [ISSUE...]"
effort: medium
allowed-tools: Bash(node:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset terminals list:*), mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__list_comments, mcp__claude_ai_Linear__list_issues, mcp__claude_ai_Linear__get_issue
---

# reconcile

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Reconcile is optional
and read-only. It never decides readiness or capacity, repairs records or runtime,
dispatches work, calls GitHub, or blocks another skill.

## Workflow

1. Require one exact Linear project id. In parallel, exhaustively page project comments
   and issues, then fetch the listed issues with relations. Resolve the complete
   marker-bearing comment set with `scripts/records.mjs resolve-controls`.
2. Use the user's exact issue identifiers when supplied; otherwise select the stable list
   of current known `started` issues. Exclude terminal issues before Superset inspection.
3. If the usable control does not provide host and Superset project, report the scope as
   non-auditable. If the issue scope is empty, return a successful no-op.
4. Read each exact Superset task, then list workspaces once for the configured project and
   terminals only for matching workspaces. Treat the results only as current transport
   observations.
5. Report task, workspace, terminal, ambiguity, and unavailable evidence per issue. Do
   not create, update, delete, adopt, repair, retry, or write any resource or comment.

## Report

```text
monkey-maestro:reconcile report
  Project/run: <project id> / <run id or none>
  Audited:     <stable issue ids or none>
  Transport:   <per-issue task / workspace / terminal observations>
  Problems:    <per-issue ambiguity or unavailable evidence>
  Mutations:   none
  Scheduling:  unchanged
```
