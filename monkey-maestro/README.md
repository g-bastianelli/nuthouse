# monkey-maestro

![monkey-maestro](./assets/banner.png)

> screeching monkey maestro conducting the issue-symphony

Monkey Maestro conducts a Linear project through parallel, task-linked Superset
workspaces. Linear is the sole scheduling authority: each issue's live status and
`blockedBy` relations decide whether it is terminal, active, ready, or blocked.
Workspace, terminal, receipt, pull-request, and worker-report state never overrides that
decision.

Within one invocation Maestro hydrates the Linear graph once, keeps a disposable
in-memory cache, and refreshes only issues affected by a transition. A new invocation or
lost context performs a new full hydration. Dynamic Linear dependency edits therefore
apply to the next dispatch without a separate recovery ceremony.

## Skills

| Skill                        | Responsibility                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `monkey-maestro:status`      | Report control and the live Linear frontier without inspecting runtimes            |
| `monkey-maestro:start`       | Write minimal v2 control, then enter orchestration                                 |
| `monkey-maestro:orchestrate` | Plan from Linear, dispatch ready issues in parallel, and monitor selected runtimes |
| `monkey-maestro:reconcile`   | Optionally audit or repair runtime telemetry; never rebuild scheduling truth       |
| `monkey-maestro:spawn`       | Launch one selected issue through the same planner and idempotence rules           |
| `monkey-maestro:stop`        | Set project control inactive without touching running work                         |

`status` is the implicit landing point for a Linear project URL. It is read-only and
never scans GitHub or Superset.

`orchestrate` computes one deterministic frontier, plans runtime actions only for ready,
forced, or active issues, acquires a short-lived dispatch lock, and launches independent
work with all-settled semantics. One issue or provider failure is quarantined to that
issue or provider; unrelated Linear-ready work continues. When no issue is ready or
active, the command returns idle instead of polling.

If Linear says an issue is terminal, it is complete for scheduling even when an old
workspace, terminal, or receipt remains. If Linear says an issue is started but no
runtime can be selected, Maestro asks whether to launch a replacement. That confirmation
may cover a group. An explicit issue-scoped force request can authorize a launch despite
non-terminal blockers or uncertain live relations, but it cannot bypass terminal state,
identity ambiguity, an ambiguous live runtime, inactive or invalid control, or lock
ownership.

## Agents and deterministic kernels

| Component                                  | Role                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| `monkey-maestro:control-loader`            | Retrieve raw project control-marker comments only                              |
| `monkey-maestro:project-snapshot-loader`   | Retrieve full or targeted live Linear issue/status/`blockedBy` facts           |
| `monkey-maestro:runtime-inspector`         | Inspect Superset candidates for the planner-selected issues only               |
| `lib/linear-snapshot.mjs`                  | Validate snapshots and maintain the invocation-local cache                     |
| `lib/linear-frontier.mjs`                  | Classify the Linear frontier and enforce force exclusions                      |
| `lib/runtime-actions.mjs`                  | Choose reuse, launch, ask, skip, or quarantine without changing readiness      |
| `scripts/orchestration-epoch.mjs`          | Drive the shared state machine through replay-safe provider effect transcripts |
| `lib/records.mjs` / `lib/project-lock.mjs` | Select monotonic control and manage an expiring owner-verified dispatch lock   |

Control records are append-only v2 Linear comments. They hold activation and stable
configuration, not a copied dependency graph. Their monotonic revisions expose stale or
conflicting writers. The dispatch lock is a short ephemeral local project lease whose
owner also binds the target host; expiry or a crashed owner can be reclaimed, and only
the token holder may release it.

GitHub is optional delivery telemetry. Superset is transport and idempotence evidence.
Neither provider is required to classify the Linear frontier, and neither can turn a
Linear-ready issue into a blocked one.

## Branch guard

Inside Superset-managed roots, in-place branch creation is denied and routed to
`monkey-maestro:spawn`, preserving one workspace per issue. Set
`MONKEY_MAESTRO_SPAWN_DISABLE=1` to disable that guard explicitly.

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
