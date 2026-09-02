---
id: project-execution-reconciler
status: ratified
spec-version: 2
linear-project: _none_
verified-by: spec-auditor
last-reviewed: 2026-08-30
---

# Linear-backed Superset project orchestrator

> **Partially superseded (2026-09-02).** The branch guard is gone. `AC-043` and every
> passage describing a `PreToolUse` interception of in-place branch creation no longer
> describe shipped behavior: the hook parsed shell commands as whitespace-separated words,
> so quoted prose and heredoc bodies mentioning `git branch` were denied as real branch
> creations, and a false positive misrouted the agent into `monkey-maestro:spawn`. One
> workspace per issue is now a convention, not an interception. Everything else in this
> spec still holds.

## Problem & Why

Nuthouse can create and verify dependency-aware Linear projects, but its first
project-execution design made full reconciliation the normal dispatch operation. Every
issue transition reloaded the complete Linear project, GitHub delivery state, Superset
workspace inventory, task bindings, and terminals. The reconciler then invoked the
single-issue spawn workflow, which repeated expensive Linear and runtime checks for each
candidate.

That model is safe but too slow for long-running issues. A user may spend hours on each
task and expects Maestro to launch independent work immediately, monitor it, and promote
newly unblocked work without another multi-minute scan. Repeated full reconciliation also
throws away useful coordinator context that is already available in the current session.

The former sequential relay is not an acceptable fallback. It cannot fan out independent
issues, relies on local baton state, and does not reconstruct task/workspace/terminal
ownership durably.

The required system treats Linear as durable orchestration memory, Superset as the
workspace and terminal execution engine, and Maestro as a live coordinator. It must
hydrate complete authority once at session start, launch every parallelizable issue up
to bounded concurrency, monitor all workers, and use targeted Linear reads for normal
transitions. Full reconciliation remains available only as explicit recovery/audit.

## Solution

The delivery has two cooperating subsystems with strict ownership.

### Verified project graph

`linear-devotee:create-project` owns the complete Linear project cascade. It validates
the dependency DAG before mutation, binds approval to the exact payload hash, creates
issues and relations recoverably, reloads Linear, and verifies exact graph equivalence.

### Durable project orchestration

Monkey Maestro owns the project-execution entry points:

- `monkey-maestro:status` inspects durable project state read-only and recommends the
  next explicit action.
- `monkey-maestro:start` activates one verified project after a single policy approval,
  then enters `orchestrate`.
- `monkey-maestro:orchestrate` is the normal execution path. It hydrates complete state
  once, builds a coordinator table, launches every ready independent issue up to
  concurrency, monitors exact Superset terminals, records worker results, and advances
  through targeted Linear reads.
- `monkey-maestro:reconcile` is an explicit full recovery/audit. It reconstructs all
  provider authority, repairs exact records, prepares a reusable coordinator handoff,
  and dispatches no work.
- `monkey-maestro:spawn` is the manual/legacy one-workspace workflow and branch-guard
  target. Active Maestro projects are routed to `orchestrate`; the project loop never
  invokes spawn once per issue.
- `monkey-maestro:stop` disables future dispatch batches without terminating existing
  workspaces or agents.

Linear is durable memory for the verified graph, native statuses, active control,
waivers, execution identities, and worker results. Superset provides isolated
task-linked workspaces, terminal agents, progress reads, and follow-ups. The live
coordinator table remains in conversation context and is reconstructable from Linear and
Superset after context loss. No private issue queue, relay file, baton, or hidden daemon
is introduced.

`linear-devotee:greet` remains the sole owner of the `In Progress` transition. Native
Linear completion or an exact human waiver is required to satisfy a dependency; a worker
DONE envelope or merged PR is not enough.

## Architecture

### Ownership boundaries

`linear-devotee` owns project definition, dependency correctness, and issue claim.
`monkey-maestro` owns project coordination, task-linked Superset resources, worker
monitoring, durable execution/result receipts, and the branch guard. `git-gremlin` owns
review, commit, and pull-request delivery.

The deleted `run / advance / halt` relay remains deleted. The installed project lifecycle
is `status / start / orchestrate / reconcile / spawn / stop`; there is no compatibility
alias or local relay state.

Maestro implements the native Superset coordinator protocol directly and remains
self-contained. It uses stable task-to-terminal mappings, isolated workspaces, terminal
read/send operations, structured worker envelopes, and dependency promotion without
requiring a second orchestration workflow.

### Durable Linear records

An activated project has one versioned control comment containing:

```text
project_id
run_id
active
repository
superset_project_id
target_host_id
default_agent
max_concurrency
decision_baseline
decision_hash
graph_hash
execution_issue_ids
exited_execution_issue_ids
revision
updated_at
```

Each dispatched issue receives an execution record containing its exact Linear issue
identifier, Superset task UUID, run, workspace, terminal when known, branch, agent, host,
timestamp, and verified/partial/degraded/repaired outcome.

Each accepted worker envelope receives a result record containing the same run,
workspace, terminal, a completed/blocked/failed outcome, timestamp, and either
summary/files/checks/handoff or reason/needs. Result records support recovery and audit,
but never replace native Linear lifecycle.

Control resolution orders every marker-bearing candidate by claimed revision before
strictly validating the sole highest candidate. It never filters invalid candidates to
fall back to an older valid control. An unorderable or invalid sole highest candidate is
`CONTROL_INVALID`; duplicate highest claimed revisions are `CONTROL_AMBIGUOUS`.

Human waivers remain explicit dependent-issue comments naming the exact blocker,
dependent, reason, approver, and timestamp.

### Coordinator table

The active session owns this compact table:

| Field        | Meaning                                                |
| ------------ | ------------------------------------------------------ |
| Task         | exact Linear issue identifier                          |
| Dependencies | exact approved blocker identifiers                     |
| Workspace    | exact Superset workspace id or none                    |
| Host         | configured host id                                     |
| Terminal     | exact agent terminal id or none                        |
| Status       | pending, ready, running, completed, blocked, or failed |
| Result       | latest durable result evidence or none                 |

The table is live context, not private durable state. On coordinator restart, one full
Linear snapshot and one correlated runtime inventory reconstruct it from control,
issues, waivers, execution records, result records, task bindings, workspaces, and
terminals. If the exact same project/run/revision/hash handoff is already present and its
runtime identities remain valid, orchestration first targeted-loads every known
Coordinator task and its approved blockers in one deduplicated batch. This mandatory
refresh runs even with no running or ready row and supplies fresh lifecycle/waiver facts
before readiness is derived. Lifecycle-only changes update the table without another
full hydration; drift becomes reconcile-required and partial authority blocks dispatch.

### Initial hydration

At a fresh orchestration session:

1. load and validate the active control;
2. verify the configured Superset host and terminal control surface;
3. load one complete Linear graph/control/comment/status snapshot;
4. load one complete correlated GitHub/Superset runtime snapshot;
5. compose the untouched snapshots through the pure reconciliation resolver;
6. build the coordinator table and classify active, residual, guarded, ready, blocked,
   quarantined, and ambiguous rows;
7. dispatch every ready independent issue up to available concurrency before monitoring.

Hydration occurs outside the dispatch lock. Fresh candidate authority is revalidated in
one targeted batch under the lock immediately before mutation.

### Locked batch dispatch

For one ready batch, `orchestrate`:

1. acquires the exact target-host project lock;
2. targeted-loads the candidates, their approved blockers, direct dependents, and latest
   control;
3. requires exact run/revision/decision-hash authority and baseline-equal relations;
4. resolves exact Superset task UUIDs and one complete workspace inventory;
5. rejects existing or ambiguous task ownership;
6. builds hash-bound candidate authorizations;
7. launches every surviving independent candidate, preserving the fixed primitive order
   inside each issue sequence;
8. writes execution receipts;
9. releases the lock in `finally` before monitoring, follow-ups, waits, or user input.

Independent issue sequences may run concurrently. Inside each sequence the order is:

```text
workspace duplicate check
  -> workspaces create without agent
  -> workspaces get and exact verification
  -> terminal snapshot
  -> agents create
  -> terminal correlation
  -> Linear execution receipt
```

Workspace success plus agent failure is a preserved partial execution. Ambiguous
mutation responses are inspected once and never blindly retried. No failure deletes a
workspace or terminal.

### Worker protocol and monitoring

Each worker receives a bounded issue prompt with objective, dependencies, scope,
acceptance, verification, ownership constraints, `linear-devotee:greet`, and one required
envelope:

```text
SUPERSET_WORKER_DONE
task: <issue identifier>
summary: <one-line outcome>
files: <comma-separated paths or none>
checks: <commands and outcomes>
handoff: <next-step context or none>
```

or:

```text
SUPERSET_WORKER_BLOCKED
task: <issue identifier>
reason: <specific blocker>
needs: <decision, access, or dependency required>
```

The coordinator reads all running terminals in every measured pass and sends follow-up
context to the same terminal when needed. Terminal presence, title, attachment, or
silence is not completion. An envelope is accepted only after correlation with its exact
issue/workspace/terminal and surrounding evidence, then persisted as a result record. A
DONE result remains capacity-guarding until targeted Linear state is terminal and its
current-run execution/result/runtime identities correlate exactly, or exact terminal
exit is proven.

### Incremental advancement

After a worker result or observed Linear lifecycle transition, Maestro reads only:

- the affected issue;
- its direct dependents from the approved decision baseline;
- their known blockers;
- the latest control and decision-relevant status/relation/waiver comments.

This targeted response validates only already-approved promotions and is never passed to
the full-project resolver. A dependent becomes ready only when every blocker is freshly
Linear-completed or exactly human-waived. When capacity opens, the coordinator dispatches
the entire newly ready batch before its next monitoring pass.

When a DONE envelope arrives before native Linear completion, the coordinator retains a
`Linear waiting` row. Every measured monitoring pass performs one batched targeted read
for the deduplicated union of all such issues, their baseline direct dependents, and known
blockers. It does not poll once per issue and does not exit while these rows remain.

Any new, removed, reversed, unknown, self, cyclic, or cross-project relation marks the
affected component `reconcile_required`. Maestro never launches a full reconcile
automatically. Existing workers and independent known components continue safely.

### Explicit reconciliation

Reconciliation is intentionally exhaustive and may be slow. It is used only after
explicit request for drift, ambiguous identity, provider uncertainty, or lost context.
It acquires the recovery lock, reloads all Linear/GitHub/Superset authority, runs the pure
resolver, repairs exact execution records, updates only the resolver's representable
baseline/ownership state, constructs a coordinator handoff, releases the lock, and exits
without workspace or agent creation.

Runnable graph expansion still requires an exact human confirmation outside the lock,
followed by reacquisition and a complete authority reload. A subsequent explicit
`orchestrate` reuses the validated handoff if its authority remains unchanged.

### Manual spawn

Manual spawn resolves one issue/task/host/project/agent, redirects a healthy active
Maestro control to `orchestrate`, and requires direct Linear control-record repair for
invalid authority instead of recommending reconciliation. A project-less issue skips the
project loader, normalizes absent/`null` project bindings, and uses the exact
`manual:<identifier>` lock scope. Spawn checks duplicates, previews the complete mutation,
and proceeds only after confirmation. It reacquires the project/task lock after the human
wait and repeats issue/control/task/runtime ownership checks before using the same
workspace-first primitive. It never coordinates a project batch.

## Components / data flow

- **Project cascade drafter:** produces the project, milestones, complete issue packets,
  and proposed DAG.
- **Graph validator/verifier:** rejects invalid edges before mutation and verifies the
  written graph exactly afterward.
- **Control records:** persist activation, policy, approved baseline, and conservative
  runtime ownership indexes.
- **Project snapshot loader:** supports `control-only`, `full`, and exact `targeted`
  Linear normalization.
- **Runtime inspector:** reconstructs exact task/workspace/terminal and GitHub evidence
  for hydration/recovery only.
- **Eligibility resolver:** computes deterministic ready/active/residual/blocked/
  quarantine state from complete snapshots.
- **Live coordinator:** maintains the table, fans out ready batches, monitors all
  terminals, records results, and performs targeted promotions.
- **Dispatch primitive:** creates and verifies one task-linked workspace, starts one
  terminal agent, and records identity.
- **Recovery reconciler:** performs one explicit exhaustive audit/repair and returns a
  coordinator handoff without dispatching.
- **Manual spawn:** exposes the one-workspace primitive behind its own confirmation.
- **Branch guard:** redirects forbidden in-place branch creation to manual spawn.
- **Issue bootstrap:** greet loads context and exclusively owns In Progress.

```text
verified Linear project + active control
  -> orchestrate
  -> hydrate Linear + Superset once
  -> build coordinator table
  -> targeted-validate one ready batch under lock
  -> create/verify isolated workspaces and terminal agents
  -> release lock
  -> monitor every running terminal and send follow-ups
  -> persist worker results in Linear
  -> targeted-read affected issue + direct dependents
  -> launch complete newly ready batch
  -> repeat without full project reload

drift / ambiguity / context loss
  -> explicit reconcile
  -> complete authority reload + repair
  -> reusable coordinator handoff
  -> explicit orchestrate resume
```

## Error handling

- Workflow status names are never hard-coded; native types are normalized.
- Provider unavailability or an unscoped required unknown prevents new mutation while
  existing workers continue.
- Issue-scoped unknowns quarantine only affected decisions.
- Targeted relation drift yields `reconcile_required`; it is never silently adopted.
- A canceled blocker remains unsatisfied without one exact human waiver.
- A DONE envelope, terminal exit, or merged PR never satisfies a Linear edge.
- Invalid components and descendants are quarantined while independent components remain
  eligible.
- Issues moved out of the project become unmanaged without runtime termination.
- Exact task/workspace/terminal matches are reconstructed before retry decisions.
- Multiple matches block only that issue and report every conflicting resource.
- Workspace creation plus agent failure is recorded as partial and never duplicated.
- Linear receipt failure after verified creation is degraded traceability, not
  redispatch permission.
- A result-record failure preserves the worker and terminal evidence and is reported for
  recovery.
- A held project lock prevents competing mutation; stale recovery needs exact terminal
  proof and explicit authority.
- An inactive control prevents every new batch but leaves existing workers untouched.

No failure deletes runtime resources, marks an issue completed, silently rewrites the
graph, or creates a private orchestration queue.

## Acceptance

### Project graph creation

- [AC-001] WHEN a Linear project cascade is drafted, THE SYSTEM SHALL produce the complete normalized dependency DAG before any external mutation.
- [AC-002] IF the proposed DAG contains a cycle, unknown target, self-edge, duplicate edge, cross-project edge, or invalid direction, THE SYSTEM SHALL refuse mutation and identify the exact relation.
- [AC-003] WHEN the cascade is previewed, THE SYSTEM SHALL display every project, milestone, issue, dependency, and normalized payload hash.
- [AC-004] WHEN the user approves the cascade, THE SYSTEM SHALL bind that approval to the exact previewed payload hash.
- [AC-005] WHEN a partially committed cascade resumes, THE SYSTEM SHALL retry only operations not confirmed by Linear.
- [AC-006] WHEN all approved entities and relations have been written, THE SYSTEM SHALL reload the complete graph from Linear and compare it with the approved graph.
- [AC-007] IF the reloaded graph differs from the approved graph, THE SYSTEM SHALL mark the project unverified and refuse Maestro activation.

### Maestro activation and control

- [AC-008] WHEN Maestro is activated, THE SYSTEM SHALL persist a versioned Linear control containing its run, repository, Superset project, host, agent, concurrency, approved baseline/hash, ownership indexes, and revision.
- [AC-009] WHEN no concurrency value is supplied, THE SYSTEM SHALL configure four simultaneous executions.
- [AC-010] IF requested concurrency exceeds ten, THE SYSTEM SHALL reject the configuration.
- [AC-011] WHEN Maestro is stopped, THE SYSTEM SHALL prevent every future dispatch batch for that project.
- [AC-012] WHEN Maestro is stopped while executions are active, THE SYSTEM SHALL leave those executions running.
- [AC-014] WHEN the user configures a Superset automation, THE SYSTEM SHALL allow that automation to invoke the same controlled orchestration entry point without creating private queue state.

### Eligibility and dispatch safety

- [AC-015] WHEN explicit full reconciliation begins, THE SYSTEM SHALL acquire an exclusive project lock on the configured host.
- [AC-016] IF another mutation owns the project lock, THE SYSTEM SHALL exit without competing external mutation.
- [AC-017] WHEN explicit reconciliation holds the lock, THE SYSTEM SHALL reload Linear, GitHub, and Superset before resolving recovery state.
- [AC-018] WHEN an execution already exists for an exact Superset task UUID, THE SYSTEM SHALL count or classify it and refuse duplicate dispatch.
- [AC-019] WHEN orchestration capacity is available, THE SYSTEM SHALL select ready issues in deterministic Linear order until the configured limit is reached.
- [AC-020] WHEN concurrency is exhausted, THE SYSTEM SHALL report active executions and launch no additional work.
- [AC-021] WHEN an issue is evaluated, THE SYSTEM SHALL consider it eligible only when every blocker is completed in Linear or covered by a valid explicit waiver.
- [AC-022] IF a blocker is canceled without an explicit waiver, THE SYSTEM SHALL keep the dependent issue blocked.
- [AC-023] WHEN a valid waiver is recorded, THE SYSTEM SHALL satisfy only the named blocker-to-dependent relation.
- [AC-024] IF GitHub reports a merged PR while Linear has not completed the blocker, THE SYSTEM SHALL keep the dependent issue blocked.

### Linear evolution and resilience

- [AC-025] WHEN Linear issue metadata, ordering, assignment, priority, or status changes within a targeted scope, THE SYSTEM SHALL adopt the fresh known value without requiring graph approval.
- [AC-027] WHEN a Linear graph change may expand runnable work, THE SYSTEM SHALL require explicit full reconciliation and confirmation before adopting that expansion.
- [AC-028] IF a graph component becomes invalid, THE SYSTEM SHALL quarantine its affected issues and descendants.
- [AC-029] WHEN one graph component is quarantined, THE SYSTEM SHALL continue coordinating independent valid components.
- [AC-030] WHEN an issue is added to the active Linear project, THE SYSTEM SHALL mark the affected scope reconcile-required before project dispatch.
- [AC-031] WHEN an issue leaves the active Linear project, THE SYSTEM SHALL stop managing it without terminating an existing execution.
- [AC-032] IF Linear is unavailable or required Linear data is unknown, THE SYSTEM SHALL launch no new execution whose decision needs that data.
- [AC-033] IF Linear changes a required API field or workflow representation, THE SYSTEM SHALL block only decisions whose required data cannot be normalized.

### Workspace and issue ownership

- [AC-034] WHEN Maestro dispatches an eligible issue, THE SYSTEM SHALL create exactly one task-linked workspace on the configured Superset host.
- [AC-035] WHEN the workspace is verified, THE SYSTEM SHALL launch the configured agent and capture exact workspace and terminal ids.
- [AC-036] WHEN a dispatch is verified or partial, THE SYSTEM SHALL record its execution identity in a versioned Linear issue comment.
- [AC-038] WHEN manual `monkey-maestro:spawn` runs outside an active project, THE SYSTEM SHALL require one explicit mutation confirmation.
- [AC-039] IF workspace creation succeeds but agent launch fails, THE SYSTEM SHALL record the partial execution and refuse automatic duplicate creation.
- [AC-040] WHEN a spawned agent claims an issue, THE SYSTEM SHALL leave In Progress exclusively to `linear-devotee:greet`.
- [AC-041] IF a workspace exists while its issue remains unclaimed, THE SYSTEM SHALL inspect and report that execution instead of launching another.

### Ownership migration

- [AC-042] WHEN this migration is installed, THE SYSTEM SHALL expose manual `spawn` from Monkey Maestro and expose no `spawn` skill from Git Gremlin.
- [AC-043] WHEN the branch guard intercepts in-place branch creation, THE SYSTEM SHALL redirect to `monkey-maestro:spawn`.
- [AC-044] WHEN Git Gremlin is installed after the migration, THE SYSTEM SHALL contain no workspace orchestration hook or spawn contract.
- [AC-045] WHEN Maestro coordinates a Linear project, THE SYSTEM SHALL use native Superset CLI primitives without requiring another orchestration skill.
- [AC-046] WHEN independent temporary orchestration is invoked, THE SYSTEM SHALL remain usable without Maestro project state.

### Recovery

- [AC-047] WHEN coordinator context is lost, THE SYSTEM SHALL reconstruct project execution from Linear records and exact Superset task mappings without a private local queue.
- [AC-048] WHEN one exact workspace matches a missing execution record, THE SYSTEM SHALL repair the Linear record instead of redispatching.
- [AC-049] IF multiple runtime resources ambiguously claim one issue, THE SYSTEM SHALL block that issue and report every conflicting resource.
- [AC-050] IF recording to Linear fails after verified dispatch, THE SYSTEM SHALL preserve the runtime and report degraded traceability for explicit recovery.

### Durable orchestration

- [AC-051] WHEN Maestro activation succeeds, THE SYSTEM SHALL enter `monkey-maestro:orchestrate` without invoking full reconciliation first.
- [AC-052] WHEN orchestration starts without a valid coordinator table, THE SYSTEM SHALL hydrate one complete Linear graph/control/record snapshot and one correlated runtime snapshot before dispatch.
- [AC-053] WHEN hydration succeeds, THE SYSTEM SHALL construct a coordinator table containing task, dependencies, workspace, host, terminal, status, and result.
- [AC-054] WHEN multiple independent issues are ready and capacity is available, THE SYSTEM SHALL dispatch every ready issue up to configured concurrency before monitoring newly launched workers.
- [AC-055] WHEN project orchestration dispatches an issue, THE SYSTEM SHALL execute the verified workspace-and-agent primitive directly without invoking standalone `spawn`.
- [AC-056] WHEN a worker is launched, THE SYSTEM SHALL provide its objective, dependencies, scope, acceptance checks, verification, and DONE/BLOCKED envelope.
- [AC-057] WHEN workers are running, THE SYSTEM SHALL read every running terminal at a measured cadence and send follow-up context to the same terminal when required.
- [AC-058] WHEN a worker emits a result envelope, THE SYSTEM SHALL correlate it with the exact issue, workspace, terminal, and surrounding evidence without treating it as native Linear completion.
- [AC-059] WHEN a worker result may change dependency eligibility, THE SYSTEM SHALL refresh only the issue, its direct dependents, and decision-required blocker/status/relation/waiver facts.
- [AC-060] WHEN the coordinator table remains valid, THE SYSTEM SHALL advance issue transitions without reloading the complete Linear project or runtime inventory.
- [AC-061] IF targeted refresh detects baseline drift, ambiguous authority, or an uncorrelated runtime, THE SYSTEM SHALL mark the affected component reconcile-required, avoid automatic full reconciliation, and continue independent valid components.
- [AC-062] WHEN orchestration dispatches a batch or mutates control, THE SYSTEM SHALL hold the project lock only for that bounded mutation and release it before monitoring or human input.
- [AC-063] WHEN full reconciliation is explicitly requested, THE SYSTEM SHALL rebuild authoritative Linear, GitHub, and Superset state, repair reconstructable identities, produce an orchestration-ready handoff, and dispatch no work.
- [AC-064] WHEN coordinator context is lost, THE SYSTEM SHALL rebuild the coordinator table from Linear control/execution/result records and exact Superset task bindings without private durable state.
- [AC-065] WHEN an active coordinator session ends, THE SYSTEM SHALL leave existing workers and durable records intact and require explicit resume instead of hidden background polling.
- [AC-066] WHEN a worker result is accepted, THE SYSTEM SHALL persist its completed/blocked/failed evidence in a versioned Linear result record; a failed result write SHALL NOT authorize redispatch.
- [AC-067] WHEN an existing Coordinator table is considered for reuse, THE SYSTEM SHALL targeted-refresh every known task and approved blocker before deriving readiness, including when no row is running or ready.
- [AC-068] WHEN a healthy active Maestro project needs continued execution, THE SYSTEM SHALL route the handoff to `orchestrate`; `reconcile` SHALL remain reserved for explicit drift recovery or audit.
- [AC-069] WHEN manual spawn receives a project-less issue, THE SYSTEM SHALL skip project-control loading, require an absent/null task project binding, and revalidate the same absence under the `manual:<identifier>` lock before mutation.
- [AC-070] IF manual spawn observes invalid or ambiguous control authority, including a newer invalid control above an older valid revision, THE SYSTEM SHALL stop and require repair of malformed or conflicting Linear control records without recommending `start` or `reconcile`.

## Acceptance history

- [AC-013] retired 2026-08-30 — WHEN no `reconcile` invocation occurs, THE SYSTEM SHALL launch no project execution. — reason: active Maestro sessions now dispatch through `orchestrate`; full reconciliation is not required between issue transitions.
- [AC-026] retired 2026-08-30 — WHEN a dependency is added, THE SYSTEM SHALL adopt it automatically after validating the resulting DAG. — reason: targeted orchestration treats decision-baseline drift as reconcile-required instead of silently performing full validation.
- [AC-037] retired 2026-08-30 — WHEN `monkey-maestro:spawn` runs under an approved active project reconciliation, THE SYSTEM SHALL require no additional per-issue confirmation. — reason: project orchestration now executes the shared Superset primitive directly and keeps `spawn` manual-only.

## Testing approach

### Dependency graph and cascade tests

Table-driven fixtures cover valid DAGs, invalid edges, cycles, disconnected components,
canceled blockers, partial mutation, payload-hash binding, resume, and exact graph
verification.

### Coordinator contract tests

Static and behavioral tests prove:

- one full hydration per coordinator session;
- all ready independent issues launch before the first terminal monitoring pass;
- workspace create/verify precedes agent launch;
- the project path never invokes standalone spawn;
- the lock is released before reads, sends, worker waits, or human input;
- every worker prompt carries exact DONE/BLOCKED envelopes;
- targeted reads contain only the affected issue, direct dependents, and known blockers;
- Linear-waiting rows are reread in one targeted batch until delayed completion is
  observed, without a full reload or one request per row;
- worker DONE alone never unlocks a Linear dependency;
- drift yields reconcile-required without an automatic full reload;
- durable result records round-trip and preserve evidence.

### Resolver and recovery tests

Complete normalized snapshots cover concurrency, independent roots, native statuses,
waivers, exact task bindings, residual runtimes, partial/ambiguous resources, provider
unknowns, project movement, baseline drift, stopped controls, lock contention, record
repair, and coordinator handoff reconstruction.

### Manual spawn and branch-guard tests

Temporary repositories and Superset boundary doubles verify manual confirmation,
post-confirmation ownership revalidation, duplicate prevention, workspace-first order,
terminal capture, partial/degraded receipts, active-project redirection to orchestrate,
and branch-command interception.

### Repository gates

```text
bunx bun test linear-devotee/
bunx bun test monkey-maestro/
bunx bun test git-gremlin/
bun run test:meta
bun run check:runtime
bun run check:workflow
bun run check:codex-agents
bun run lint
bun run fmt:check
```

## Non-goals

- Run a hidden coordinator daemon or background polling process after the active session ends.
- Automatically create a scheduled Superset automation.
- Automatically launch full reconciliation after targeted drift.
- Distribute one project's executions across multiple Superset hosts.
- Replace Linear with a private Maestro queue, database, relay, or baton.
- Pass targeted partial snapshots to the full reconciliation resolver.
- Treat worker envelopes, terminal exit, canceled issues, or merged PRs as Linear completion.
- Repair, reverse, remove, or waive a dependency without explicit authority.
- Mark Linear issues completed directly from Maestro.
- Merge pull requests automatically.
- Terminate active agents or delete workspaces when Maestro stops.
- Automatically delete completed or partial workspaces.
- Invoke manual spawn once per project issue.
- Make Monkey Maestro depend on another orchestration workflow.
- Restore aliases for Git Gremlin spawn or the deleted sequential relay skills.
- Implement the feature work described by dispatched issues.
- Guarantee progress when Linear, GitHub, or Superset cannot provide trustworthy state.
