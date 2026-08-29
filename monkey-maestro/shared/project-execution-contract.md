# Project execution contract

This contract is the installed boundary shared by `status`, `start`, `reconcile`, `spawn`,
`stop`, `project-snapshot-loader`, and `runtime-inspector`. Linear is durable project memory;
Superset is runtime execution; GitHub is delivery evidence only. No Maestro workflow may
use a private issue queue, relay flag, baton file, or `superset-orchestrate`.

`status` is the read-only project-link landing point. It resolves one canonical Linear
project, reports the verified graph receipt, latest control, current dependency
observations, and durable execution records, then exits. It never claims Linear issue
links, inspects live Superset state, invokes another Maestro skill, or mutates anything.

## Durable Linear records

Records are Markdown comments containing one HTML marker followed by one fenced JSON
object. Schema version 1 markers are:

- project control: `nuthouse:maestro-control`;
- issue execution: `nuthouse:maestro-execution`;
- explicit blocker waiver: `nuthouse:maestro-waiver`;
- verified project graph receipt, produced by Linear Devotee:
  `nuthouse:project-graph-receipt`.

Use `scripts/records.mjs` for control, execution, and waiver parsing/serialization. An
unknown schema, malformed field, duplicate highest control revision, decision-hash
mismatch, or missing verified graph receipt is unknown authority and blocks mutation.

Two exact identity namespaces are used and must never be conflated:

- `issueId` is Linear's canonical issue `identifier` (for example `TEAM-123`). Treat it
  as an opaque, team-dependent value: never hard-code `NOT-`, another prefix, or a local
  identifier regex. Graph
  receipts, control baselines, blockers, waivers, resolver entries, and execution records
  all use this value. A connector's generic `id` may be a transport UUID or may be the
  identifier; its shape is not an authority and a missing Linear UUID is not an error.
- `taskId` is Superset's internal task UUID. Resolve it read-only with `superset tasks get
<issueId> --json` and require a non-empty `task.id`, `externalProvider === "linear"`,
  and `externalKey === issueId`; a managed issue also requires the expected
  `externalProjectId`. A workspace stores this `task.id`, not the Linear identifier or
  Linear transport UUID.

Never derive either identity from a title, branch, URL, or UUID shape. If the exact
Linear identifier or Superset task binding is unavailable, the affected dispatch is
unknown and must not mutate.

The control's `decisionBaseline` contains sorted Linear issue ids and exact
`dependentIssueId -> blockerIssueId` edges. `decisionHash` is the SHA-256 of that
canonical baseline. `start` initializes it from the verified graph receipt on first
activation and carries the latest inactive control baseline across restarts. `reconcile`
updates it before dispatch only from the resolver's representable `nextBaseline`, after
adopting known safe graph changes or receiving required confirmation. Unknown or
quarantined components retain their previous edges; the raw partial Linear baseline is
never persisted. This is how a later removal/reversal can be recognized without local
memory.

The control also keeps sorted `executionIssueIds` for task-linked executions that still
consume capacity after their issue leaves the Linear project. Reconciliation rebuilds
this set from fresh live runtime state. A managed issue with a known normalized terminal
status (`completed` or `canceled`) is logically finished only after its live workspace
and terminal correlate with one durable execution record for the exact active run,
issue, task, workspace, terminal, and host, while the workspace itself belongs to the
control's exact Superset project. That runtime is reported as residual and does not
consume concurrency. A missing, partial, ambiguous, cross-scope, or mismatched durable
record keeps the runtime active and consuming one slot. Residual classification does not
pretend the process exited and does not create an exit tombstone; ambiguous bindings,
unknown status, and runtimes whose issue left the project stay conservative. A recorded
agent terminal with `exited: true` is actual exit proof. A deleted workspace is also
terminal proof only when the
issue is still managed with a known terminal Linear status, every durable execution
record belongs to the active run and has the exact current task, host, and workspace id,
and an authoritative Superset `ready` inventory covers the control's exact host/project.
That inventory carries a complete sorted `workspaceIds` set equal to the full unfiltered
workspace array, and every recorded workspace id must be absent from it. This is the
normal post-completion cleanup convention. A missing/filtered/partial inventory,
different host/project, earlier-run record, observed workspace under a mismatched task,
unknown status, task ambiguity, or issue that left the project remains guarded and
consumes one slot. The companion `exitedExecutionIssueIds` set is the explicit durable
tombstone for either proof; active and exited sets may never overlap, and a new dispatch
removes its old tombstone. These are ownership indexes, not a queue and not eligibility
state.

A waiver is valid only when the exact dependent/blocker ids match, all fields parse, it
is not revoked, and Linear attributes the comment to an explicit human. A canceled
blocker without that waiver remains unsatisfied. GitHub merge state never substitutes
for Linear completion.

## Reconciliation authorization

One active control record authorizes dispatches only for its `projectId`, `runId`,
`targetHostId`, `supersetProjectId`, `defaultAgent`, and concurrency. `reconcile`
acquires the short-lived local host lock through `scripts/project-lock.mjs` and passes
this project authorization to `spawn`:

```json
{
  "kind": "project",
  "projectId": "<Linear project id>",
  "runId": "<run id>",
  "revision": 3,
  "decisionHash": "sha256:<hash>",
  "lockToken": "<ephemeral token>",
  "issueId": "TEAM-123",
  "taskId": "<Superset task UUID>",
  "eligibility": "<canonical fresh status/blocker/waiver evidence>",
  "authorizationHash": "sha256:<hash>"
}
```

`spawn` re-reads the control and lock owner, reloads the issue and blocker/waiver facts,
and must reproduce the hash-bound per-issue authorization immediately before creation.
Any mismatch, wrong/cross-project issue, non-startable status, unsatisfied blocker,
inactive record, unavailable provider, or released lock blocks mutation. This authorized
mode has no per-issue gate. Standalone spawn mints its own run id, uses
`{ "kind": "manual" }`, refuses to bypass an active Maestro project, and shows one exact
Superset mutation gate. After the human wait it acquires the project/task lock and
rechecks both active control and exact `taskId` ownership before mutation.

`start`, `stop`, and `reconcile` serialize control mutations with the same target-host
project lock. User confirmation always occurs before acquisition; reconciliation releases
before an expansion question, then reacquires and reloads every authority before using
that approval. No lock is held across an unbounded human wait.

## Superset primitive order

Every dispatch runs on the one configured host and follows this order:

1. `superset workspaces list --host <host> --project <project> --json`; group exact
   `taskId === <validated Superset task UUID>` matches.
2. Zero matches may proceed. One match is reconstructed/inspected. Multiple matches are
   ambiguous and block only that issue.
3. `superset workspaces create --host <host> --project <project> --name <name> --task
<validated Superset task UUID> --json` with no agent flag.
4. `superset workspaces get <workspaceId> --host <host> --json`; require exact host,
   project, and taskId.
5. Snapshot terminals, then run `superset agents create --workspace <workspaceId>
--host <host> --agent <agent> --prompt <prompt> --json`.
6. `superset terminals list --workspace <workspaceId> --host <host> --json`; require one
   exact returned/new terminal and capture its id.
7. Persist the execution record in Linear. A failed record write after verified runtime
   creation is degraded traceability, never permission to delete or redispatch.

Workspace creation success plus agent failure is a partial execution. Preserve the
workspace, record it when Linear is available, and never create another automatically.
No workflow deletes a workspace, terminates an agent, or creates a branch in place.

The spawned prompt begins by requiring `linear-devotee:greet <identifier>`. Only greet
may move the issue to normalized status type `started`; Maestro never mutates issue
status.

## Fresh-state and failure rules

- `reconcile` runs only on explicit invocation (manual, the successful `start`
  transition, another known workflow transition, or a user-configured Superset
  automation). After its control is verified active and its activation lock is released,
  `start` invokes exactly one full reconciliation pass. It never dispatches directly,
  keeps no background loop, and does not schedule another pass.
- Acquire the target-host lock before the authoritative full reload. A held lock exits
  without external mutation. A stale candidate needs explicit recovery after runtime
  inspection proves the owner terminal absent.
- Reload current Linear status metadata, project graph/comments, GitHub PRs, Superset
  workspaces, and terminals before resolving.
- Capacity counts live task-linked executions owned by the current issue set, control
  baseline, `executionIssueIds`, or durable records from any run, except an exact managed
  runtime whose fresh normalized Linear status is terminal and whose live workspace and
  terminal correlate with its exact active-run issue/task/workspace/terminal/host record
  inside the control's exact Superset project.
  That runtime is residual and report-only. Missing or mismatched durable identity keeps
  the runtime active; missing owned runtime state consumes one conservative slot. Main/foreign
  workspaces do not count. A recorded agent terminal with `exited: true` releases its
  slot; partial or unknown identity/status state keeps its slot conservatively. Extra
  shell/dev terminals never make a recorded agent ambiguous when its exact `terminalId`
  still exists.
- Provider unavailability or unscoped unknown required data allows no new dispatch.
  Issue-scoped runtime/Linear unknowns block only affected decisions, and optional
  unknowns do not poison known components. Preserve and report existing executions.
- Metadata and status updates are fresh values. Optional unknown fields do not make a
  scoped partial response globally unavailable. Acyclic dependency additions are safe.
  Removed/reversed edges and new startable issues require confirmation before affected
  dispatch and before updating the decision baseline.
- Quarantine invalid nodes and descendants; continue independent valid components.
- An issue moved out of the project is unmanaged, but its runtime remains untouched.
- Always release the token-matched lock in a `finally` path. Local lock/scratch files are
  ephemeral coordination, never project memory.

## Ownership boundary

Monkey Maestro owns Superset workspace/agent dispatch and its branch guard. Linear
Devotee owns project graph correctness and `In Progress`. Git Gremlin owns review,
commit, and PR. `superset-orchestrate` remains a separate user-invoked workflow for
temporary parallel work and is neither read nor invoked here.
