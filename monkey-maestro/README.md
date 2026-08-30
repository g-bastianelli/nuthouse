# monkey-maestro

![monkey-maestro](./assets/banner.png)

> screeching monkey maestro conducting the issue-symphony

Monkey Maestro is a durable Linear-backed Superset project orchestrator. Linear stores
the approved dependency graph, lifecycle, control policy, waivers, execution identities,
and worker results. Superset supplies isolated task-linked workspaces, terminal agents,
progress reads, and follow-ups. Maestro keeps no private issue queue or hidden background
daemon.

Activation writes one versioned project control record after approval, then enters the
live orchestration session. The coordinator hydrates Linear and runtime state once,
builds a task/dependency/workspace/terminal table, and launches every independent ready
issue up to the configured concurrency before monitoring workers. The default
concurrency is four and the hard maximum is ten.

Workers report through structured DONE/BLOCKED envelopes. Maestro records those results
in Linear, but dependency promotion still requires fresh Linear completion or one exact
human waiver. After a transition, Maestro reloads only the affected issue, its direct
dependents, and their known blocker facts. It does not reload the complete project
between issues.

Full reconciliation is reserved for explicit recovery after graph drift, provider
ambiguity, runtime mismatch, or lost coordinator context. It rebuilds all Linear,
GitHub, and Superset authority, repairs reconstructable records, prepares a coordinator
handoff, and never dispatches work itself.

Maestro bridges two identities: Linear graph state uses the exact opaque issue
identifier returned by its team, for example `ENG-42`, while Superset workspace
ownership uses the internal `task.id` returned by `superset tasks get ENG-42 --json`.
Neither a team prefix nor a Linear transport UUID is inferred.

## Skills

| Skill                        | What it does                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `monkey-maestro:status`      | Inspect a Linear project link read-only and recommend activation, orchestration, or recovery              |
| `monkey-maestro:start`       | Activate one verified project, configure concurrency, and enter orchestration                             |
| `monkey-maestro:orchestrate` | Hydrate once, fan out every ready issue, monitor terminals, and advance through targeted Linear reads     |
| `monkey-maestro:reconcile`   | Perform one explicit full recovery/audit and prepare a reusable orchestration handoff without dispatching |
| `monkey-maestro:spawn`       | Manually create exactly one task-linked workspace and terminal outside an active Maestro project          |
| `monkey-maestro:stop`        | Disable future dispatch batches while leaving existing workspaces and agents running                      |

`status` is the implicit landing point for URLs shaped like
`https://linear.app/<workspace>/project/<slug>/overview`. It deliberately ignores Linear
issue URLs, reads only durable Linear state, and never starts work on the user's behalf.

`orchestrate` is the normal project path. During one live coordinator session it:

1. hydrates the complete graph/runtime once or reuses an exact validated handoff;
2. dispatches a full ready batch through the native Superset workspace-first protocol;
3. releases the project lock before monitoring all running terminals;
4. stores exact execution and worker-result receipts in Linear;
5. refreshes only affected Linear nodes and immediately launches newly unblocked work.

If a targeted read detects an added, removed, reversed, unknown, or ambiguous relation,
only the affected component becomes `reconcile_required`. Reconciliation is never
started automatically, and unrelated known work may continue.

`spawn` remains the manual/legacy one-workspace escape hatch and branch-guard target.
The project orchestrator reuses its safe primitive order—duplicate check, create
workspace, verify, launch agent, capture terminal, write receipt—but executes that order
directly for a batch instead of invoking the standalone workflow once per issue.

## Agents

| Agent                                    | Used by                                            | Role                                                                 |
| ---------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `monkey-maestro:project-snapshot-loader` | status, start, orchestrate, reconcile, spawn, stop | Read-only control, full-project, or targeted Linear normalization    |
| `monkey-maestro:runtime-inspector`       | orchestrate hydration, reconcile                   | Read-only Superset workspace/terminal/task and GitHub reconstruction |

## Branch guard

Monkey Maestro owns the one-workspace-per-branch guard. Inside Superset-managed roots,
in-place `git checkout -b`, `git switch -c`, or `git branch <new>` is denied and routed
to `monkey-maestro:spawn`. Set `MONKEY_MAESTRO_SPAWN_DISABLE=1` to disable that guard
explicitly.

Maestro implements the native Superset coordinator protocol directly: isolated
workspaces, stable task-to-terminal mappings, terminal reads/follow-ups, dependency
promotion, and structured worker envelopes. It remains self-contained and does not
depend on a second workflow layer.

## Install

### Claude Code

```text
/plugin install monkey-maestro@nuthouse
```

### Codex CLI

```text
codex plugin install monkey-maestro@nuthouse
```

## License

MIT
