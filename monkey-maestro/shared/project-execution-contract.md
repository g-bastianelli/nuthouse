# Linear-first project execution contract

This is the installed boundary shared by `status`, `start`, `orchestrate`, `reconcile`,
`spawn`, `stop`, `control-loader`, `project-snapshot-loader`, and `runtime-inspector`.

## Authority

Linear is the only durable scheduling authority. Readiness uses only:

- exact current project membership;
- normalized current `status.type`;
- exact current `relations.blockedBy` identifiers.

Superset is execution transport and idempotence evidence. GitHub, pull requests, worker
envelopes, terminals, execution records, result records, waivers, historical graph
receipts, and obsolete control fields never make an issue ready, blocked, terminal, or
capacity-consuming.

## What orchestration never authorizes

Dispatching an issue does not authorize feature acceptance. It does not authorize merge.
It does not authorize Linear completion, dependency mutation, readiness, or a second
dispatch batch. Human feature acceptance and manual merge remain mandatory outside
Maestro, and Linear remains the only lifecycle authority.

## Linear state semantics

`completed` and `canceled` are terminal. Terminal Linear state wins before any Superset
lookup, satisfies a blocker relation, and consumes no logical concurrency even when one
or many residual runtimes remain alive.

`backlog`, `triage`, and `unstarted` are startable. A startable issue is ready exactly
when every current blocker is terminal. `started` means Linear already considers the
issue claimed and remains eligible for runtime transport. Each public entry point owns
its confirmation and launch policy without changing that Linear classification.

## Disposable Linear cache

One orchestration invocation performs one full Linear bootstrap. The in-memory cache
contains only issue id, project id, status type, blocker ids, and scoped unknowns. It is a
performance view, not durable authority.

Every cache construction or mutation goes through `scripts/linear-snapshot.mjs`:
`hydrate` validates one exact full bootstrap; `recover-full` replaces only identifiable
malformed rows with one exact targeted retry; `recover-full-unknown` replaces only
uniquely identifiable rows whose targeted retry remained malformed with canonical scoped
unknowns; `refresh` applies one validated exact targeted snapshot; and `mark-unknown`
isolates retry-exhausted ids after a cache exists. The CLI returns
the next normalized cache to invocation memory and never persists it. No skill manually
splices issue or unknown arrays.

Fast project orchestration performs no event loop or second dispatch batch. It plans from
the validated full bootstrap, transports one deterministic batch, and returns. Manual
`spawn` may refresh its one candidate and blockers at its stronger confirmation boundary;
fresh facts then replace cached facts directly. Relation additions, removals, or
reversals never require historical adoption or `reconcile`.

Lost context or a new invocation performs a new full bootstrap. Never store the Linear
cache in a queue, relay file, project comment, or hidden daemon.

## Retrieval boundaries

`control-loader` performs one exhaustive project-comment pagination traversal and returns
raw marker-bearing project comments. Only `scripts/records.mjs resolve-controls`
validates the exact loader envelope and interprets them.

`project-snapshot-loader` returns only live Linear project/status/blocker facts. Full mode
performs one exhaustive project-membership pagination traversal and detail-fetches issues
in parallel. Targeted mode fetches exact requested ids and never lists the project.
Candidate-blockers mode fetches exact candidates first and their fresh direct blocker
union second inside one loader invocation, returning one strict targeted envelope. It
never sees controls, records, GitHub, or Superset.

Every loader result is schema- and scope-validated before use. Invalid JSON, missing
requested ids, expanded scope, or contradictory ids is rejected. Retry once in the same
scope or fall back to a direct targeted read when available. An identifiable malformed
row carries its exact issue id so the targeted recovery replaces only that row. A
schema-valid scoped
unknown is likewise retried once for only that scope; persistent failure becomes a scoped
unknown and cannot fabricate facts. A project-wide unknown prevents dispatch.

`runtime-inspector` is reserved for `spawn` and `reconcile`; fast `orchestrate` does not
use it. When invoked, it receives only selected non-terminal issue ids after Linear planning.
It echoes the exact Linear project, host, and Superset project context, resolves exact
task/workspace/terminal evidence, and never calls GitHub or decides readiness. Runtime
validation binds all echoed context plus the exact issue scope before planning.
When validation attributes malformed rows or scoped unknowns to exact ids, orchestration
retries only those ids once. It then calls `scripts/runtime-snapshot.mjs merge-targeted`
with the initial raw snapshot, subset retry, exact full selected rows, retry ids, and
expected context. If the retry remains malformed, `merge-targeted-unknown` replaces only
those rows with canonical unknown evidence. Only the helper's revalidated full raw
`runtimeSnapshot` may enter `scripts/runtime-actions.mjs`; consumers never pass a subset
retry to a full-scope planner or splice runtime arrays manually.
For project-less manual spawn, the invocation uses synthetic scope `manual:<issueId>` and
accepts only a task whose external project id is absent; that scope is never persisted as
Linear fact.

## Minimal control v2

The active Linear control stores only:

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

`maxConcurrency` defaults to four and must be between one and ten. A v1 control is usable
when these operational values can be projected from it. Malformed obsolete graph, hash,
or ownership values are ignored warnings. The next explicit control mutation writes v2.
Historical comments are never deleted automatically.

`start` short-circuits an already-active control only when its source schema is v2 and no
explicit transport, agent, or concurrency override was supplied. An active v1 control or
any explicit override follows the normal grouped preview and writes one verified v2
successor, so migration and configuration updates never require a stop/start cycle.

An inactive control prevents dispatch. One validated active control authorizes one fast
orchestration batch. A one-issue `spawn` re-resolves control after its confirmation gate,
so a freshly inactive, reconfigured, or conflicting control ends that run `stopped`
before mutation. `stop` is Linear-only, prevents the next invocation, and never touches
existing workers.

## Pure planners

`planLinearFrontier` accepts only validated Linear facts plus optional invocation-scoped
forced issue ids. It deterministically returns terminal, ready, started, blocked, and
unknown rows. Unknown data, cycles, self-relations, and cross-project relations isolate
only affected components and their dependent decisions. A known `started` issue remains
selected for runtime monitoring and capacity accounting when only its relations are
defective; unknown identity, membership, data, or status still makes the row unknown.
An absent blocker becomes a canonical force uncertainty instead of aborting planning.

`planRuntimeActions` is the stronger one-issue planning boundary used by `spawn`. It
accepts selected frontier rows plus validated candidate-scoped runtime evidence and
returns:

- zero exact workspace: `create`;
- one exact workspace: `reuse` or `monitor`;
- multiple exact workspaces: issue-scoped `ambiguous`;
- started without runtime: `confirm`;
- missing task or provider fact: issue-scoped `non-transportable`.

Runtime planning cannot reclassify Linear facts. Inputs and outputs use stable issue-id
ordering.

## One-issue spawn force

Force is an explicit escape hatch for named issues. Show one preview of bypassed blockers
or uncertain relations and require one confirmation; multiple issues may share that
confirmation. Authorization exists only in the current invocation and never mutates
Linear relations or status.

Force may bypass non-terminal blockers or uncertain relations. It cannot bypass:

- a terminal candidate;
- missing issue or Superset task identity;
- multiple exact runtimes;
- inactive control;
- missing host/project/agent configuration;
- a held dispatch lock.

Force memory includes the exact previewed blocker ids and the exact canonical uncertainty
tokens emitted on each forced frontier row. Each token is
`{ issueId: string | null, code: string }`; arrays are deterministically sorted. The
confirmation builds both `bypassedBlockerIssueIds` and `bypassedUncertainties` maps for
every named issue, including empty arrays. Refresh candidate Linear facts immediately
before mutation. A candidate that became terminal is skipped even after force
confirmation; a newly added blocker or uncertainty that widens either preview invalidates
that authorization instead of being silently included. Because the under-lock read
contains only the candidate and live direct blockers, omitted transitive blocker
subgraphs are not reinterpreted as newly missing facts during reauthorization; relations
fully present inside the refreshed scope and explicit unknown evidence remain enforced.

Requested force ids enter an unconfirmed frontier overlay before runtime inspection. That
overlay selects candidates but authorizes no mutation. `planRuntimeActions` returns
`confirm` for forced create/reuse until an invocation-id-bound authorization is supplied.

Manual `spawn` configuration is allowed only when a project control is provably absent,
or when the issue itself has no project. It becomes an invocation-only active control
with concurrency one and a `manual:<invocationId>` run. That validated invocation control
authorizes one locked batch while live Linear candidate/blocker refresh remains
mandatory. An inactive or unusable durable control is never bypassed.

## Fast project orchestration

`orchestrate` treats started rows as capacity-consuming, then fills remaining
`maxConcurrency` slots with ready rows. Ordering is stable by issue id. Task lookup runs
in one parallel wave sized to the available capacity. A failed started lookup retains
its reserved capacity; a failed ready lookup does not. Only then does orchestration query
the next deferred ready rows needed to backfill open slots. The healthy path stays one
wave, while failures cannot permanently starve later valid ready work.

For each transportable candidate, orchestration calls branch-scoped
`superset workspaces create` once without first listing workspaces. The call includes the
exact project, host, task id, provider branch, deterministic workspace name,
`--skip-branch-prefix`, and JSON output. It never embeds an agent launch in workspace
creation.

Superset's `alreadyExists` result is the workspace idempotence boundary:

- `false` records a newly created workspace and immediately launches one agent;
- `true` records a reused workspace and triggers one exact workspace read;
- a reused workspace with a live terminal is already running;
- a reused workspace without a live terminal launches one agent.

Before terminal inspection, a reused workspace must match the exact host, project,
provider branch, and task. An absent task binding is repaired once with
`superset workspaces update --task-id`; a different non-empty task binding is an
issue-scoped ownership conflict and is never overwritten. No project-wide workspace list
is needed.

Agent launch uses `superset agents create` and must return a non-empty session id. One
candidate failure never cancels siblings. A created workspace survives an agent-launch
failure and is reused by a later invocation. After launch and reuse decisions,
`orchestrate` returns immediately; it does not poll workers, refresh Linear, or promote a
second batch.

Branch-scoped creation prevents duplicate workspaces. Terminal inspection avoids the
ordinary retry duplicate-agent case, but agent launch is not an atomic cross-invocation
claim. Do not run two `orchestrate` invocations concurrently for the same project.

## One-issue spawn runtime idempotence and dispatch

`lib/orchestration-epoch.mjs` exports the normative `runOrchestrationEpoch` state machine.
`scripts/orchestration-epoch.mjs` is its production transcript/effect bridge.
`spawn` drives provider adapters through that executable bridge. Every public bridge invocation mints a fresh
UUID v4 `invocationId`; it is never accepted from a user, derived from a durable run id,
or reused. Effect ids bind that invocation id, adapter name, exact input, and occurrence;
forged, duplicate, cross-invocation, stale, or unused transcript responses are rejected.
Only a final `state: complete` result authorizes the reported outcome.

Adapter wiring for `spawn` is fixed: project-lock helpers acquire/release; project-snapshot-loader
refreshes each candidate and its live direct blockers in one invocation; the Superset
sequence below is `dispatchIssue`; runtime-inspector is reserved for one ambiguous
mutation recovery; exact terminal reads are `monitorWorker`; targeted Linear reads after
an event are `refreshAfterWorkerEvent`/promotion input. No adapter may reclassify Linear.
The one exception is a project-less manual spawn: because no Linear project exists, its
`refreshCandidateAndBlockers` adapter uses direct exact `get_issue` reads, candidate
first and then the freshly derived blocker union, and emits a strict targeted envelope
whose project/scope is the synthetic `manual:<issueId>`. The same Linear validator must
accept that envelope before the bridge consumes it; failed reads remain scoped unknown.

### Adapter response envelopes

Invoke `scripts/orchestration-epoch.mjs` with this exact outer structure:

```text
{
  schemaVersion: 1,
  request: {
    invocationId,
    frontierPlan,
    runtimePlan,
    control,
    selectedIssueIds,
    lockDirectory,
    dispatchContextByIssueId
  },
  transcript: [] | exact prior response entries
}
```

The CLI writes the bridge result directly as top-level
`{ schemaVersion: 1, state: "needs-effects" | "complete", ... }` on success, without an
`ok` or `epoch` wrapper. A nonzero failure alone uses `{ ok: false, error }`.

Bridge responses are values, not raw CLI wrappers. Apply these exact projections:

- `acquireDispatchLock` returns the direct successful `project-lock acquire` value;
  `releaseDispatchLock` returns the direct `{ "released": true }` value.
- `refreshCandidateAndBlockers` and `refreshAfterWorkerEvent` return the strict raw
  targeted Linear snapshot envelope, after the required candidate-first/blocker-union
  reads. `inspectExactRuntime` returns the strict raw candidate-only runtime envelope.
- `monitorWorker` returns `{}` when no event occurred or `{ "event": <provider-event> }`;
  terminal-suggested issue ids have no scheduling authority.
- `promoteAfterRefresh` applies only the already validated refreshed rows to the
  invocation cache, replans, and returns `{ "applied": true }`.

`dispatchIssue` has four fulfilled response forms. All begin with
`schemaVersion: 1`, the named `state`, and
`lockVerification: verifyOutput.verification` from the live verify-first sub-step:

```json
{
  "schemaVersion": 1,
  "state": "verified",
  "action": "create | reuse",
  "lockVerification": "<exact inner verification object>",
  "runtimeSnapshot": "<strict raw one-issue envelope; one workspace and one active terminal>",
  "record": { "status": "written" }
}
```

`action` is the live outcome after the exact duplicate check, not the pre-lock planner
hint. A `create` request may therefore return `reuse` when the inventory found an existing
workspace. A `reuse` request must return `reuse` whose runtime snapshot is bound to the
exact requested workspace id; any other action or workspace binding is a rejected
envelope, not an adopted fact. For verified runtime with failed telemetry, `record` is
`{ "status": "failed", "detail": "<non-empty reason>" }`. A `partial` response uses the
same fields including the actual action, changes state to `partial`, adds non-empty
`failedPhase`, requires exactly
one workspace and at most one active terminal, and permits record status `written`,
`failed`, or `not-attempted`. If partial evidence contains one exact active terminal,
monitor it after verified lock release. `ambiguous` and `failed` responses contain no runtime
snapshot or record and use this identity-bound form:

```json
{
  "schemaVersion": 1,
  "state": "ambiguous | failed",
  "issueId": "<exact issue id>",
  "taskId": "<exact task id>",
  "context": {
    "targetHostId": "<exact host id>",
    "supersetProjectId": "<exact Superset project id>",
    "linearProjectId": "<exact Linear/manual project scope>"
  },
  "lockVerification": "<exact inner verification object>",
  "code": "<non-empty failure code>",
  "detail": "<optional detail>"
}
```

If live lock verification itself fails, append a rejected transcript response with the
helper error instead of fabricating a fulfilled dispatch envelope. Every fulfilled form
is rejected unless the issue, task, context, workspace cardinality, terminal cardinality,
record state, and lock verification match the effect and validated runtime boundary.

Only ready issues, confirmed started issues, confirmed forced issues, and exact active
workers enter Superset inspection. Never inspect a terminal issue.

Select a deterministic batch up to available `maxConcurrency`. Independent issue
sequences use all-settled semantics: one failure never cancels, rolls back, or suppresses
sibling sequences. Within one issue, preserve this order:

Before the bridge, exact-fetch and bind branch/workspace/prompt context per selected
mutation. Retry only the failed issue once. A persistent per-issue context failure is
removed from the execution batch as `DISPATCH_CONTEXT_UNAVAILABLE`; valid siblings and
active monitors continue, and the next deterministic deferred candidate may fill freed
capacity. The bridge still rejects extra, missing, or malformed context for every
surviving mutation.

```text
live token/owner/lease verification
  -> exact task lookup
  -> exact workspace duplicate check
  -> workspace create when absent
  -> exact workspace verification
  -> terminal snapshot
  -> agent create only when no active terminal exists
  -> exact terminal correlation
  -> best-effort Linear execution record
```

The first `dispatchIssue` sub-step invokes `scripts/project-lock.mjs verify` with the
exact effect `lockReceipt`, immediately before any Superset call. It requires
`verifyOutput.verified === true` and returns
`lockVerification: verifyOutput.verification`, the exact inner verification object.
Never fabricate verification from the acquisition receipt. Expired, changed, or missing
ownership refuses mutation.

Acquire the short project dispatch lock only after every human decision. Under the lock,
refresh each candidate and its live direct blockers once, then let `dispatchIssue` perform
the one live task/workspace duplicate check that chooses create or reuse. The validated
control is fixed for this batch; a later batch starts with a fresh control read. Release
in `finally` before monitoring, follow-ups, waits, or questions.

An ambiguous mutation response gets one exact inspection and no blind retry. A workspace
created before agent or record failure is preserved and reused on a later invocation.
Workspace-only recovery with no active terminal is reported `degraded`, not `busy`.
If partial evidence already contains one exact active terminal, monitor it after release.
Record-write failure is degraded telemetry, never redispatch permission.

## Lock recovery

The ephemeral local lock lives only below `${CLAUDE_PLUGIN_DATA}/locks`, is keyed by exact
`projectId`, binds the selected `hostId` in its owner, and has one exclusive owner token
plus creation/expiry timestamps. Release requires the matching token. There is no
recursive transition lock. Recovery directly handles an expired owner, an empty owner
left by a crash, and a stale legacy transition artifact. Concurrent recoverers converge
on one exclusive owner.

For an expired owner, recovery requires the exact token observed during inspection. Empty
and stale legacy-transition artifacts need no token. After one successful recovery,
acquisition may be retried once; a changed artifact or new live owner returns `busy`.

## One-issue spawn monitoring and exit

`spawn` monitors only its exact active terminal. Read the worker at a measured cadence
and send follow-ups to the same terminal when needed. A worker DONE/BLOCKED envelope is
coordination evidence only and never changes Linear lifecycle.

After a worker event, derive direct dependent candidates only from validated cached
frontier rows whose `blockerIssueIds` contain the worker issue. Ignore refresh ids from
terminal output, then perform a targeted Linear refresh before promoting dependents. If
there is no exact active worker and no ready or confirmed force candidate, return `idle`
immediately. Do not poll Linear waiting rows, sleep in the background, or create a hidden
automation. A later Linear change needs a new invocation.

## Public entry points

- `status`: Linear-only, read-only control and live frontier report. Never inspect runtime
  and never require reconciliation.
- `start`: preview and write minimal control v2, verify it, then enter `orchestrate`.
- `orchestrate`: load control and the full Linear snapshot in parallel, plan one stable
  batch, branch-idempotently create or reuse workspaces, launch only missing agents, and
  return immediately.
- `reconcile`: optional runtime audit and exact telemetry repair. It never owns, adopts,
  or gates the Linear graph and never dispatches work. Before proposing any repair it
  reads every page of the issue's existing telemetry comments; incomplete comment
  evidence disables repair for that issue. Exact post-write pagination verifies an
  accepted repair, and an equivalent pre-existing record is never duplicated.
- `spawn`: one issue through the stronger runtime planner, force rules, confirmation,
  lock, and provider-effect bridge. An active project control supplies configuration
  rather than causing redirection.
- `stop`: preview and write `active:false` using Linear only.

`linear-devotee:greet` remains the sole owner of the `In Progress` mutation inside worker
prompts. Maestro never changes business issue status or dependency relations.

## Failure scope

- One issue read failure: retry once, then isolate that issue and dependent decisions.
- Complete Linear outage: no blind dispatch; return `degraded`; existing workers stay.
- Superset outage: selected issues become temporarily non-transportable; Linear state is
  unchanged.
- One issue dispatch failure: siblings continue.
- Multiple runtime matches: only that issue is ambiguous.
- No active/ready work: clean immediate `idle`.

Only explicit `stop` changes control activation. Other exits are `idle`, `busy`, or
`degraded`; none silently disables Maestro or recommends graph reconciliation.
