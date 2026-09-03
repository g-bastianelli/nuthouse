# Linear-first project execution contract

This contract is shared by every public Monkey Maestro skill.

## Authority

Linear is the sole scheduling authority. Superset only transports selected work.

- `completed` and `canceled` are terminal.
- Every `started` issue counts against `maxConcurrency`, whether or not a workspace or
  terminal exists.
- `backlog`, `triage`, and `unstarted` issues are candidates.
- A candidate is ready only when every identifier in its current `blockedBy` relation is
  present in the same live project read and terminal.
- Unknown issue, status, membership, or blocker facts never become ready facts.

For project orchestration:

```text
slots = max(0, maxConcurrency - startedIssueCount)
selected = first slots ready issues, sorted by issue identifier
```

Started issues reserve capacity but are not redispatched by project orchestration.
Superset workspace or terminal counts never change this calculation.

## Minimal control v2

The latest usable Linear project control contains only:

```text
schemaVersion: 2
projectId
runId
active
targetHostId
supersetProjectId
defaultAgent
maxConcurrency
revision
updatedAt
```

The three selectors are non-empty strings. `maxConcurrency` defaults to four and must be
between one and ten. `scripts/records.mjs` is the only deterministic helper: pass
`{ projectId, comments }` to `resolve-controls`, and use `build-control` for successors.
Historical controls remain append-only and are never deleted automatically.

An inactive control prevents future project dispatch. `stop` never touches existing
Superset work.

## Start discovery and approval

Resolve host, project, and agent independently in this order:

1. explicit invocation value;
2. value inherited from the latest usable control;
3. simple read-only local discovery.

Local discovery is deliberately narrow:

- Host: use the non-empty `hostId` from `superset status --json` only when status reports
  the local service running and healthy.
- Project: prefer the id in the current `.superset/worktrees/<projectId>` path; otherwise
  match the current path or Git common directory to `superset projects list --local
--json`; otherwise use the sole local project.
- Agent: use the active runtime name only when it appears in `superset agents list` for
  the resolved host; otherwise use the sole listed agent.

Never guess an unavailable or ambiguous selector. Gather every unresolved selector into
one concise clarification. After all values are resolved, show one complete control
preview and request exactly one Linear mutation approval. Discovery and clarification do
not authorize the write.

## Project orchestration

Load the latest control and one complete live Linear project issue set. Compute capacity
and readiness only from that Linear set. If the control is inactive or unusable, stop. If
Linear is unavailable or incomplete, perform no Superset mutation.

For each selected ready issue, resolve its exact Superset task, render its worker prompt,
and attempt exactly one branch-scoped workspace creation. Prefer one command containing
the workspace, task, host, project, agent, and prompt:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --name <workspaceName> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

Run independent issue attempts with all-settled semantics. A failed task lookup or create
is reported for that issue and does not cancel successful siblings. Do not replace a
failed selection with another issue in the same invocation. Do not pre-list, adopt,
repair, delete, or reconcile workspaces; do not inspect terminals; do not poll workers.
A later invocation begins from a new Linear read.

## One-issue spawn

`spawn` applies the same live Linear meanings and capacity count to one named issue. A
terminal, blocked, or unknown issue never launches. A ready issue may proceed only when
`maxConcurrency - startedIssueCount` leaves a slot. An explicitly named `started` issue
may proceed because Linear already counts it against capacity.

After approval, call workspace creation once. Do not inspect existing runtime state or
retry ambiguous mutation evidence.

## Read-only entry points

`status` reads only the latest control and current Linear issue set. It reports started,
ready, blocked, terminal, and unknown counts plus remaining slots.

`reconcile` is an optional read-only Superset report for explicit issue ids or current
started issues. It may report task, workspace, and terminal correlation, but it never
repairs records or runtime resources and never gates `start`, `orchestrate`, or `spawn`.

## Worker boundary

Every worker prompt starts with `linear-devotee:greet <issueId>`, contains the issue scope
and acceptance criteria, and states:

- own only the selected issue and workspace;
- read repository instructions before editing;
- do not revert others' edits;
- do not merge, push, or change dependencies;
- do not change Linear status or relations outside the greet/user workflow;
- human feature acceptance and manual merge remain mandatory.

A DONE/BLOCKED worker envelope is a handoff only. It never changes scheduling state.

## Mutation boundary

Monkey Maestro may append an approved control comment and create an approved Superset
workspace. It never merges, pushes, changes dependencies, changes Linear issue lifecycle
or relations, or infers completion from GitHub, commits, checks, runtime state, or worker
output.
