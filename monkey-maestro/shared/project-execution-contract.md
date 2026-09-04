# Linear-first project execution contract

This contract is shared by every public Monkey Maestro skill.

## Authority

For Linear-backed work, Linear is the sole scheduling authority. Superset only transports
selected work. A manual quick fix has no scheduling state and never pretends to be a
Linear issue.

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

## Workspace identities

Issue-backed orchestration and manual issue spawn use the same identity. Calculate the
first eight hexadecimal characters of SHA-256 over the exact Superset task id and name the
workspace `linear-<lowercaseIssueId>-<taskDigest>`. Bind it with `--task <taskId>`.

For a quick fix, normalize the exact objective by trimming it and replacing every
whitespace run with one ASCII space. Build its readable slug by lowercasing, applying
Unicode NFKD, removing combining marks, replacing every run outside `a-z0-9` with one
hyphen, trimming hyphens, taking the first 48 characters, and trimming a final hyphen
again. Use `quick-fix` if empty. Calculate the first eight hexadecimal characters of
SHA-256 over the normalized objective. Name the branch `quick/<slug>-<digest>` and the
workspace `quick-<slug>-<digest>`. Bind it with `--branch <branchName>` and
`--skip-branch-prefix`; the stored branch must remain exactly the derived identity used by
recovery matching.

## Linear retrieval boundary

Linear-backed public skills never hydrate a whole Linear project into their main context.
They dispatch the read-only `monkey-maestro:linear-reader` and consume only its marker
comments, status types, blocker identifiers, and scoped unknowns. Full descriptions are
returned only for exact selected issue ids when rendering worker prompts. The reader
never decides readiness, capacity, or runtime actions. Quick-fix spawn does not dispatch
the reader at all.

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

An inactive control prevents future project dispatch. It does not govern manual `spawn`.
`stop` never touches existing Superset work.

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
preview plus the immediate bounded orchestration handoff. Request exactly one approval
for the Linear control write and that first pass. Discovery and clarification do not
authorize either mutation.

## Project orchestration

Load the latest control and one complete live Linear project issue set. Compute capacity
and readiness only from that Linear set. If the control is inactive or unusable, stop. If
Linear is unavailable or incomplete, perform no Superset mutation.

For each selected ready issue, resolve its exact Superset task and selected Linear detail,
then render its worker prompt. Attempt exactly one branch-scoped workspace creation or
reuse without embedding an agent launch:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --name <workspaceName> \
  --json
```

Require workspace creation to distinguish `created` from `reused`. Launch only for an
explicitly `created` workspace; a reused or ambiguous result launches nothing. The
create-or-reuse decision is the duplicate guard across concurrent orchestration calls.
Call `superset agents create` once and report `dispatched` only when it confirms success.
An explicit launch refusal preserves the workspace, receives no retry or backfill, and
reports `monkey-maestro:spawn <issueId>` as recovery. An unknown launch result instead
reports read-only `reconcile`, because immediate relaunch could duplicate a delayed worker.

Run independent issue attempts with all-settled semantics. A failed detail, task, create,
terminal, or launch call is reported for that issue and does not cancel successful
siblings. Do not replace a failed selection in the same invocation or poll workers. A
later invocation begins from a new Linear read.

## Manual spawn

`spawn` has two explicit manual modes and never reads a project control or calculates
project capacity.

- **Issue mode:** read only the selected Linear issue and its current direct blockers. A
  terminal, blocked, or unknown issue never launches. A ready or explicitly selected
  `started` issue may proceed. Require the exact Superset task binding and use it as the
  workspace identity.
- **Quick-fix mode:** use a non-empty free-form objective without any Linear read, issue,
  task, control, or scheduling claim. Derive a stable branch and workspace identity from
  the objective and bind the workspace with `--branch`.

Both modes resolve transport from explicit values followed by narrow local discovery.
Before approval, narrow one workspace listing by the deterministic identity and require
at most one exact task-bound or branch-bound match. A matching live terminal returns
`already-running`. Otherwise preview `create` or `recover` and ask once. After approval,
create at most one workspace, but launch from a create action only when the response
explicitly says `created`; a reuse caused by a concurrent winner launches nothing.
Recheck the exact chosen workspace's live terminals and launch at most one agent only when
none exists. Any live terminal conservatively blocks a launch because the CLI exposes no
stronger agent/shell discriminator. A failed launch preserves the workspace and remains
recoverable by a later identical `spawn`; ambiguous mutation evidence is never retried in
the same invocation.

## Read-only entry points

`status` reads only the latest control and current Linear issue set. It reports started,
ready, blocked, terminal, and unknown counts plus remaining slots.

`reconcile` is an optional read-only Superset report for explicit issue ids or current
started issues. It may report task, workspace, and terminal correlation, but it never
repairs records or runtime resources and never gates `start`, `orchestrate`, or `spawn`.

## Worker boundary

An issue worker prompt starts with `linear-devotee:greet <issueId>` and preserves the
selected issue title, branch, and description verbatim. It extracts scope, acceptance
criteria, and required checks only when explicitly present; absent sections are labeled
`not specified in Linear` instead of being inferred. A quick-fix worker prompt starts
directly with the exact objective, never invokes Linear Devotee, and never implies that an
issue exists. Both state:

- own only the selected issue or quick fix and its workspace;
- read repository instructions before editing;
- do not revert others' edits;
- do not merge, push, or change dependencies;
- for issue work, do not change Linear status or relations outside the greet/user
  workflow; for quick fixes, do not change Linear at all;
- human feature acceptance and manual merge remain mandatory.

A DONE/BLOCKED worker envelope is a handoff only. It never changes scheduling state.

## Mutation boundary

Monkey Maestro may append an approved control comment during project activation, create
an approved issue or quick-fix Superset workspace, and launch its approved worker. It
never merges, pushes, changes dependencies, changes Linear issue lifecycle or relations,
or infers completion from GitHub, commits, checks, runtime state, or worker output.
