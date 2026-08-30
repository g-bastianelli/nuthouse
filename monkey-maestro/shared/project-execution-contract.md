# Project execution contract

This contract is the installed boundary shared by `status`, `start`, `orchestrate`,
`reconcile`, `spawn`, `stop`, `project-snapshot-loader`, and `runtime-inspector`.

- Linear is durable project memory: approved dependency graph, normalized lifecycle,
  control policy, waivers, execution receipts, and worker results.
- Superset is execution transport: isolated task-linked workspaces, terminal agents,
  progress reads, and follow-ups.
- The active `orchestrate` conversation is the live coordinator. Its table is rebuilt
  from durable records after context loss; it is never stored in a private queue.
- GitHub is delivery evidence only. A merge never substitutes for Linear completion.

Normal execution uses one full hydration at coordinator start, then targeted Linear
transition reads. Full `reconcile` is an explicit recovery/audit operation, never the
per-issue loop. `spawn` is the manual one-workspace fallback and branch-guard target;
project orchestration shares its verified primitive order but does not invoke it.

`status` remains the read-only project-link landing point. It reports durable Linear
state and recommends `orchestrate` for a healthy active control or `reconcile` for known
drift. It never claims issue links, inspects live Superset state, invokes another skill,
or mutates anything.

## Durable Linear records

Records are Markdown comments containing one HTML marker followed by one fenced JSON
object. Schema version 1 markers are:

- project control: `nuthouse:maestro-control`;
- issue execution identity: `nuthouse:maestro-execution`;
- worker result: `nuthouse:maestro-result`;
- explicit blocker waiver: `nuthouse:maestro-waiver`;
- verified project graph receipt, produced by Linear Devotee:
  `nuthouse:project-graph-receipt`.

Use `scripts/records.mjs` for parsing and serialization. An unknown schema, malformed
field, duplicate highest control revision, decision-hash mismatch, or missing verified
graph receipt is unknown authority and blocks mutation.

Resolve project controls with `records.mjs resolve-controls`: order every marker-bearing
candidate by its claimed revision before strictly validating the sole highest candidate.
Never filter invalid controls before ordering. An unorderable candidate or invalid sole
highest revision is `CONTROL_INVALID`; duplicate highest claimed revisions are
`CONTROL_AMBIGUOUS`.

An execution record binds one run, Linear issue identifier, Superset task UUID,
workspace, optional terminal, branch, agent, host, timestamp, and outcome. A result
record binds the same run/workspace/terminal to `completed`, `blocked`, or `failed` and
preserves the worker envelope evidence. A result is durable coordination evidence, not
permission to change Linear lifecycle or satisfy a dependency edge. Reconstruction uses
the latest exact active-run result by timestamp; conflicting canonical records tied at
the latest timestamp are ambiguous authority.

Two exact identity namespaces are used and never conflated:

- `issueId` is Linear's opaque canonical issue `identifier`, for example `TEAM-123`.
  Never hard-code a team prefix, infer it from a title/branch/URL, or require a transport
  UUID.
- `taskId` is Superset's internal task UUID. Resolve it read-only with
  `superset tasks get <issueId> --json` and require a non-empty `task.id`,
  `externalProvider === "linear"`, `externalKey === issueId`, and the expected
  `externalProjectId`. A workspace stores this task UUID.

If either exact identity is unavailable, only the affected dispatch is unknown and must
not mutate.

## Control and graph authority

One active control authorizes only its exact `projectId`, `runId`, `repository`,
`targetHostId`, `supersetProjectId`, `defaultAgent`, and `maxConcurrency`.

The control's `decisionBaseline` contains sorted issue ids and exact
`dependentIssueId -> blockerIssueId` edges. `decisionHash` is the SHA-256 of its canonical
form. `start` initializes the baseline from a verified graph receipt or carries the exact
latest inactive baseline across restart. Only explicit full reconciliation may adopt a
new representable baseline. Targeted orchestration never silently adds, removes, or
reverses an edge.

The control also keeps `executionIssueIds` and `exitedExecutionIssueIds` as conservative
ownership indexes for executions that have moved outside the current managed issue set.
They are not a queue and never determine eligibility. Active and exited ids cannot
overlap.

Linear normalized `status.type === completed` is the ordinary blocker-completion proof.
A canceled blocker is unsatisfied unless one exact non-revoked waiver is attributed to a
human and names the same dependent/blocker ids. Worker results, terminal exit, PR state,
and GitHub merge never replace that proof.

## Coordinator session

`orchestrate` keeps this table in live conversation context:

| Field        | Meaning                                                |
| ------------ | ------------------------------------------------------ |
| Task         | exact Linear issue identifier                          |
| Dependencies | exact blocker identifiers from the approved baseline   |
| Workspace    | exact Superset workspace id or none                    |
| Host         | configured host id                                     |
| Terminal     | exact agent terminal id or none                        |
| Status       | pending, ready, running, completed, blocked, or failed |
| Result       | latest exact worker evidence or none                   |

At the start of a coordinator session, load one complete Linear snapshot and one
complete correlated Superset/GitHub runtime snapshot. Compose them through the pure
reconciliation resolver to reconstruct active, residual, guarded, ready, blocked, and
ambiguous work. If an exact same-run/revision/hash table is already present in the active
conversation and its runtime identities remain valid, first make one targeted read for
the deduplicated union of every existing Coordinator task and its approved blockers.
This refresh is mandatory even when no row is running or ready. Require the same active
control, baseline-equal relations, and fresh normalized status/waiver facts before
deriving readiness or reusing the table. A lifecycle-only change updates the table
without a full load; relation drift requires reconciliation, and partial/unknown
authority blocks dispatch rather than reusing stale facts.

Launch every ready independent issue up to available concurrency before monitoring the
new batch. Capacity counts exact active/guarded task executions. A live runtime for a
fresh terminal Linear issue becomes report-only `residual` only when its issue, task,
workspace, terminal, host, run record, and Superset project correlate exactly. Partial,
missing, cross-scope, or ambiguous evidence keeps one conservative slot occupied.

After launch, release the project lock and monitor all running terminals at a measured
cadence with `superset terminals read`. Use `superset terminals send` to provide
clarification, dependency results, or review feedback to the same session. Terminal
presence, title, attachment, or silence is never completion proof.

Workers end with one of these prompt-level envelopes:

```text
SUPERSET_WORKER_DONE
task: <issue identifier>
summary: <one-line outcome>
files: <comma-separated paths or none>
checks: <commands and outcomes>
handoff: <next-step context or none>
```

```text
SUPERSET_WORKER_BLOCKED
task: <issue identifier>
reason: <specific blocker>
needs: <decision, access, or dependency required>
```

Correlate the envelope with its exact row and surrounding terminal evidence before
persisting a result. Normalize the DONE envelope's comma-separated file field to a
deduplicated array, with `none` becoming `[]`. A DONE result completes worker execution in the table, but its
dependents remain pending until Linear reports the blocker completed or a valid waiver
exists. Its live execution also remains capacity-guarding until targeted Linear status
is terminal and the current-run execution/result/workspace/terminal identities correlate
exactly, or exact terminal exit is proven. A correlated still-live terminal runtime is
then residual and does not consume logical concurrency.

## Targeted transition reads

After a worker result or observed lifecycle transition, refresh only:

1. the affected issue;
2. its direct dependents from the approved baseline;
3. their known blockers;
4. the latest control and only comments/status metadata needed for those decisions.

`project-snapshot-loader MODE: targeted` must receive the exact requested issue ids and
expected control run/revision/hash. It never lists the full project. A targeted response
is not valid input to the full reconciliation resolver; it only validates promotions
already representable by the approved baseline.

If a DONE result precedes native Linear completion, keep the issue as `Linear waiting`.
At each measured monitoring pass, make one batched targeted read for the deduplicated
union of all waiting issues, their baseline direct dependents, and their known blockers.
Do not poll once per issue, and do not exit the coordinator merely because no worker is
still running while Linear-waiting rows remain.

Any new, removed, reversed, unknown, self, cyclic, or cross-project relation produces
`reconcile_required` for the affected component. Preserve unrelated running work and
continue independent known components. Never launch a full reconcile automatically.

When a targeted read proves newly ready work and capacity exists, acquire the lock,
revalidate the entire candidate batch together, dispatch the full ready batch, write its
receipts, release the lock, and return to monitoring. Do not run a complete Linear or
runtime reload between issue transitions.

An inactive control observed before a batch stops every future dispatch. Existing
workspaces and terminals continue untouched.

## Locked batch authorization

`start`, `stop`, `reconcile`, and orchestration dispatch/control batches serialize
mutation through `scripts/project-lock.mjs` on the exact target host and project. Human
confirmation always occurs before lock acquisition. No lock is held across terminal
monitoring, worker waits, follow-ups, or user questions.

For each batch candidate, orchestration builds one hash-bound authorization from the
active control, held lock token, exact issue/task ids, fresh startable status, and exact
blocker/waiver facts. All candidates are targeted-read and duplicate-checked before any
new monitoring pass. A control change, lock mismatch, task-binding change, non-startable
status, unsatisfied blocker, existing runtime, or unknown required field removes only
the affected candidate.

The active project control is the batch mutation gate. There is no extra per-issue
confirmation. Always release the token-matched lock in `finally`.

## Superset primitive order

Every authorized dispatch follows this order within its issue sequence. Different issue
sequences in one locked batch may run concurrently.

1. Query one complete project workspace inventory and group exact task-id matches. Zero
   may proceed; one is existing/repair; multiple are ambiguous.
2. `superset workspaces create --host <host> --project <project> --name <name> --task
<taskId> --json`, with no agent flag.
3. `superset workspaces get <workspaceId> --host <host> --json`; require exact host,
   project, task, and worktree.
4. Snapshot terminals, then run `superset agents create --workspace <workspaceId> --host
<host> --agent <agent> --prompt <prompt> --json`.
5. Re-list terminals, require one exact returned/new terminal, and capture its id.
6. Persist the execution record in Linear.

Workspace success plus agent failure is a partial execution. Preserve it, record it when
possible, and never create another automatically. A failed record write after verified
runtime creation is degraded traceability, never permission to delete or redispatch.
No Maestro workflow deletes a workspace, terminates an agent, or creates a branch in
place.

The worker prompt begins with `linear-devotee:greet <identifier>`. Only greet may move an
issue to normalized `started`; Maestro never mutates issue status.

## Manual spawn

`spawn` creates exactly one workspace only when the user or branch guard invokes it. It
resolves one issue/task/host/project/agent. For a project-bound issue, an active Maestro
control redirects to `orchestrate`; invalid authority requires repair of the malformed or
conflicting Linear control records and never redirects to `reconcile`. For a project-less
issue, absent and `null` project bindings are equivalent, the project loader is skipped,
and the exact `manual:<identifier>` lock scope is used. Spawn shows one exact mutation
preview and continues only after confirmation. After the human wait it acquires the
project/task lock, refetches issue/control/task/runtime ownership, then uses the same
workspace-first primitive.

Manual spawn mints its own run id. It never receives project batch authorization, never
coordinates dependencies, and never serves as the normal project loop.

## Full reconciliation and recovery

`reconcile` is explicit-only and intentionally exhaustive. It reloads complete Linear,
GitHub, workspaces, terminals, task bindings, records, waivers, and control; runs the pure
resolver; repairs exact reconstructable execution identities; safely updates only the
resolver's representable `nextBaseline` and ownership indexes; and creates a Coordinator
handoff in conversation. It never dispatches a workspace or agent.

Runnable graph expansion still requires a human confirmation outside the lock. After
approval, reconcile reacquires the lock and repeats the authoritative reads before
persisting. The following explicit `orchestrate` invocation reuses the validated handoff
without another full hydration when its authority still matches.

## Failure and ownership rules

- Provider unavailability or unscoped required unknowns allow no new mutation. Scoped
  unknowns quarantine only affected components.
- Quarantine invalid nodes and descendants while continuing independent valid work.
- An issue moved out of the project is unmanaged; its runtime remains untouched and
  guarded until exact exit proof.
- Local lock/scratch files are ephemeral coordination only. Linear remains durable
  project memory.
- Monkey Maestro owns project coordination, Superset workspace/agent dispatch, and its
  branch guard. Linear Devotee owns graph correctness and In Progress. Git Gremlin owns
  review, commit, and PR operations.
