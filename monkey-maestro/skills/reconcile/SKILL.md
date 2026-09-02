---
name: reconcile
description: Use when the user explicitly asks Monkey Maestro to audit or repair Superset runtime correlation and best-effort execution records. It is optional, candidate-scoped, GitHub-free, never adopts the Linear graph, never gates orchestration, and never dispatches work.
argument-hint: "<linear-project-id> [ISSUE...]"
effort: high
allowed-tools: Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces get:*), Bash(superset terminals list:*), Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__list_comments, mcp__claude_ai_Linear__save_comment
---

# reconcile

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This skill is an
optional runtime forensic/repair tool. It cannot make an issue ready or blocked, adopt a
relation, update cache authority, dispatch a worker, call GitHub, or create/delete runtime
resources. A failed reconciliation never prevents later `orchestrate`.

## Workflow

1. Require one exact Linear project id and normalize any explicitly supplied issue ids.
   In parallel dispatch:
   - `monkey-maestro:control-loader`;
   - `monkey-maestro:project-snapshot-loader` with `MODE: targeted` and those exact ids
     when the user supplied a scope, otherwise `MODE: full` to discover started issues.
2. Pass the complete control-loader envelope plus exact `expectedProjectId` through
   `scripts/records.mjs resolve-controls`, validate the Linear snapshot, and run
   `scripts/linear-frontier.mjs`. For an unscoped full audit, use
   `scripts/linear-snapshot.mjs` hydrate/recover-full/refresh boundaries for retries; an
   explicit targeted audit validates its exact requested scope directly. Retry an
   unavailable or scoped-unknown retrieval once in the same scope. Control may be inactive; audit is still allowed when its transport
   configuration is usable. Missing, conflicting, or unusable transport configuration
   produces a scoped non-auditable report and no Superset access.
3. Determine audit scope:
   - the exact validated non-terminal frontier rows explicitly supplied by the user;
     otherwise
   - every non-terminal `started` issue from the live Linear snapshot.
     Split terminal issues out before runtime inspection: they are report-only rows and
     never enter the Superset audit or repair scope.
4. If scope is empty, return a successful no-op without Superset access.
5. Dispatch `monkey-maestro:runtime-inspector` for the exact scope. Validate its strict
   raw response through `scripts/runtime-snapshot.mjs validate-audit`, passing the exact
   selected non-terminal frontier rows and expected host/Superset/Linear context. This
   separate forensic boundary permits opaque `ready`, `started`, `blocked`, and `unknown`
   classifications but rejects terminal rows, normalized matches, context mismatch, and
   expanded or incomplete scope. Never call `planRuntimeActions` or alter a Linear
   classification in reconciliation. Keep missing tasks, multiple workspaces, and
   unavailable evidence scoped per issue.
6. Before deciding that telemetry is missing or stale, read every page of comments for
   each exact-runtime issue in the repair scope. Parse only the canonical issue-scoped
   execution-record marker through `scripts/records.mjs`; an unavailable page makes that
   issue non-repairable for this invocation. Use the complete pre-write comment set as
   the idempotence boundary, so an already-equivalent accepted record is reported as
   present and is never duplicated.
7. Build a plain audit table:

```text
Issue | Linear status | Task | Workspaces | Terminals | Telemetry repair | Reason
```

8. One exact runtime with a missing or stale best-effort execution record may be repaired
   after one grouped preview and explicit confirmation. Write only issue-scoped telemetry
   comments; never rewrite control, graph, links, statuses, or runtime resources.
9. Re-fetch every page of the exact issue comments and verify every accepted repair. A
   failed write is reported but never retried blindly.
10. Multiple exact workspaces remain ambiguous. Report all ids and leave them untouched.

No lock is required for read-only audit. If telemetry repair is written, exact
post-write verification is its idempotence boundary. Reconcile never prepares a special
handoff or asks orchestration to trust its snapshot.

## Report

```text
monkey-maestro:reconcile report
  Project/run: <project id> / <run id or none>
  Audited:     <n issues>
  Exact:       <n>
  Repaired:    <issue ids or none>
  Ambiguous:   <per-issue runtime ids or none>
  Degraded:    <per-issue reasons or none>
  Graph:       not owned · no adoption required
  Dispatched:  none
```
