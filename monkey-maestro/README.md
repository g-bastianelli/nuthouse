# monkey-maestro

![monkey-maestro](./assets/banner.png)

> screeching monkey maestro conducting the issue-symphony

Monkey Maestro starts one bounded batch of Linear work in task-linked Superset
workspaces. Linear is the sole scheduling authority; Superset is only the transport.

For an active project, Maestro reads the live Linear issues, counts every `started`
(`In Progress`) issue against `maxConcurrency`, and fills the remaining slots with ready
issues in stable identifier order. An issue is ready when it is non-terminal, not already
started, and every current `blockedBy` issue is terminal.

Each selected issue gets one workspace create-or-reuse attempt. Only an explicitly new
workspace receives a worker; a reused workspace cannot trigger a duplicate launch. One
failure is reported while siblings continue. A confirmed launch failure stays recoverable
through one-issue `spawn`; ambiguous launch evidence is inspected through read-only
`reconcile`. Runtime state never decides capacity, Maestro maintains no private queue,
does not poll workers, and never mutates Linear lifecycle.

## Skills

| Skill                        | Responsibility                                                      |
| ---------------------------- | ------------------------------------------------------------------- |
| `monkey-maestro:status`      | Report control and the live Linear counts                           |
| `monkey-maestro:start`       | Discover local transport, write one control, then orchestrate       |
| `monkey-maestro:orchestrate` | Fill Linear slots and safely create/reuse then launch selected work |
| `monkey-maestro:spawn`       | Launch or recover one explicitly selected Linear-authorized issue   |
| `monkey-maestro:reconcile`   | Read-only report of runtime transport for requested issues          |
| `monkey-maestro:stop`        | Disable future dispatch without touching existing work              |

## Control and discovery

Control records are append-only v2 Linear project comments containing activation,
Superset host/project/agent selectors, `maxConcurrency`, and a monotonic revision. They
do not copy the issue graph or runtime state.

One read-only `linear-reader` keeps exhaustive Linear pagination and large issue responses
out of the public skill context. It returns only control comments and minimal
status/blocker facts, then selected issue details only when a prompt must be rendered.

On first start, selectors resolve in this order: explicit argument, usable prior control,
then simple local Superset discovery. The host comes from a healthy `superset status
--json`; the project comes from the current Superset worktree id, a matching local project
path, or the sole local project; and the agent comes from the current runtime when that
agent exists on the host, otherwise the sole configured agent. Missing or ambiguous
choices are gathered into one clarification. The complete resolved control then receives
exactly one Linear mutation approval.

## Safety boundary

Maestro never merges or pushes, changes dependencies, changes issue status or relations,
or treats a workspace, terminal, worker envelope, commit, or pull request as scheduling
truth. Human acceptance and manual merge remain outside Maestro.

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
