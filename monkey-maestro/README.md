# monkey-maestro

![monkey-maestro](./assets/banner.png)

> screeching monkey maestro conducting the issue-symphony

Monkey Maestro conducts a Linear project through parallel, task-linked Superset
workspaces. Linear is the sole scheduling authority: each issue's live status and
`blockedBy` relations decide whether it is terminal, active, ready, or blocked.
Workspace, terminal, receipt, pull-request, and worker-report state never overrides that
decision.

Within one orchestration invocation Maestro loads project control and the full Linear
snapshot in parallel, plans one deterministic batch, dispatches it, and returns. A new
invocation performs a new hydration, so current Linear dependency edits apply without a
separate recovery ceremony.

## Skills

| Skill                        | Responsibility                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `monkey-maestro:status`      | Report control and the live Linear frontier without inspecting runtimes               |
| `monkey-maestro:start`       | Write minimal v2 control, then enter orchestration                                    |
| `monkey-maestro:orchestrate` | Plan once, create or reuse task workspaces in parallel, launch missing agents, return |
| `monkey-maestro:reconcile`   | Optionally audit or repair runtime telemetry; never rebuild scheduling truth          |
| `monkey-maestro:spawn`       | Launch one selected issue through the same planner and idempotence rules              |
| `monkey-maestro:stop`        | Set project control inactive without touching running work                            |

`status` is the implicit landing point for a Linear project URL. It is read-only and
never scans GitHub or Superset.

`orchestrate` computes one deterministic frontier, reserves concurrency for started work,
then fills remaining slots with ready issues in stable issue-id order. For each selected
issue, it resolves the exact Superset task and directly calls branch-scoped workspace
creation. Superset reports whether the workspace was created or already existed, so
Maestro never pre-lists the project inventory. New workspaces receive one agent; reused
workspaces receive one exact binding check and an agent only when one live-terminal check
finds none. An unbound reused workspace is linked once to the exact task; a conflicting
binding is never overwritten. The command then returns immediately.

Task lookup normally runs in one parallel wave. A failed ready issue is replaced by the
next deferred ready issue, so bad transport metadata cannot starve valid siblings; extra
waves happen only after failures.

Independent issue sequences use all-settled semantics. One issue or provider failure is
quarantined to that issue or provider while valid siblings continue. When no issue is
ready or started, the command returns idle without touching Superset.

If Linear says an issue is terminal, it is complete for scheduling even when an old
workspace or terminal remains. The stronger one-issue `spawn` flow retains explicit
confirmation, issue-scoped force, exact runtime inspection, and its short dispatch lock.
Those controls do not sit on the project orchestration hot path.

## Agents and deterministic kernels

| Component                                  | Role                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `monkey-maestro:control-loader`            | Retrieve raw project control-marker comments only                           |
| `monkey-maestro:project-snapshot-loader`   | Retrieve full or targeted live Linear issue/status/`blockedBy` facts        |
| `monkey-maestro:runtime-inspector`         | Inspect selected Superset candidates for `spawn` and `reconcile`            |
| `lib/linear-snapshot.mjs`                  | Validate snapshots and maintain the invocation-local cache                  |
| `lib/linear-frontier.mjs`                  | Classify the Linear frontier and enforce force exclusions                   |
| `lib/runtime-actions.mjs`                  | Plan the stronger one-issue `spawn` runtime flow without changing readiness |
| `scripts/orchestration-epoch.mjs`          | Drive `spawn` through replay-safe provider effects                          |
| `lib/records.mjs` / `lib/project-lock.mjs` | Select monotonic control; protect confirmed manual spawn mutation           |

Control records are append-only v2 Linear comments. They hold activation and stable
configuration, not a copied dependency graph. Their monotonic revisions expose stale or
conflicting writers. The one-issue spawn lock is a short ephemeral local project lease; it
does not gate the fast orchestration path.

GitHub is optional delivery telemetry. Superset is transport and idempotence evidence.
Neither provider is required to classify the Linear frontier, and neither can turn a
Linear-ready issue into a blocked one.

## Workspace scope

One workspace per issue stays a convention, not an interception. Nothing rewrites or
denies your Git commands; invoke `monkey-maestro:spawn <LINEAR-ISSUE-ID>` when you want
an issue placed in its own task-linked Superset workspace.

## Development

```text
bun test monkey-maestro/
bun run test:meta
bun run check:runtime
bun run check:workflow
```

## Install

```text
/plugin install monkey-maestro@nuthouse
codex plugin install monkey-maestro@nuthouse
```

## License

MIT
