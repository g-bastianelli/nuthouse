# monkey-maestro

![monkey-maestro](./assets/banner.png)

> screeching monkey maestro conducting the issue-symphony

Monkey Maestro is the project execution reconciler for verified Linear dependency
graphs. Linear is durable project memory; Superset supplies task-linked workspaces and
agents. Maestro keeps no private issue queue and never polls by default.

Activation writes one versioned project control record after approval. Each explicit
reconciliation reloads Linear, GitHub, and Superset, reconstructs existing executions by
the exact Linear `taskId`, validates dependency eligibility, fills the approved
concurrency capacity, records execution identities back in Linear, and exits. The
default concurrency is four and the hard maximum is ten. Missing durable runtimes keep a
slot until an explicit terminal-exit tombstone proves they are gone.

## Skills

| Skill                      | What it does                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `monkey-maestro:start`     | Activate one verified Linear project with host, Superset project, agent, and concurrency policy; it does not dispatch |
| `monkey-maestro:reconcile` | Perform one locked reconciliation pass and dispatch eligible issues within capacity; it never loops or polls          |
| `monkey-maestro:spawn`     | Create exactly one task-linked Superset workspace, launch its agent, and record the workspace/terminal identity       |
| `monkey-maestro:stop`      | Disable future dispatches while leaving active workspaces and agents running                                          |

`spawn` has two authorization modes. A reconcile-held project lock plus a hash-bound
per-issue eligibility packet authorizes project dispatch without another prompt; spawn
rebuilds that packet from fresh Linear state immediately before creation. Standalone
manual spawn has its own run id and mutation confirmation, then reacquires the project
lock and rechecks task ownership after the human wait.

## Agents

| Agent                                    | Used by                | Role                                                                       |
| ---------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `monkey-maestro:project-snapshot-loader` | start, reconcile, stop | Read-only normalized Linear graph, control, execution, and waiver snapshot |
| `monkey-maestro:runtime-inspector`       | reconcile, spawn       | Read-only Superset workspace/terminal and GitHub PR snapshot               |

## Branch guard

Monkey Maestro owns the one-workspace-per-branch guard. Inside Superset-managed roots,
in-place `git checkout -b`, `git switch -c`, or `git branch <new>` is denied and routed
to `monkey-maestro:spawn`. Set `MONKEY_MAESTRO_SPAWN_DISABLE=1` to disable that guard
explicitly.

The reconciler calls Superset CLI primitives directly. The independent
`superset-orchestrate` skill remains available for temporary parallel work and has no
Maestro project-state dependency.

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
