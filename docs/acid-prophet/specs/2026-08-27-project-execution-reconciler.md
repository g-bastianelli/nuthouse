---
id: project-execution-reconciler
status: ratified
spec-version: 1
linear-project: _none_
verified-by: spec-auditor
last-reviewed: 2026-08-27
---

# Linear project execution reconciler

## Problem & Why

Nuthouse can create dependency-aware Linear projects and relay one issue after another,
but the workflow does not yet operate as a reliable project-level execution system.

The current project cascade does not treat the approved dependency graph as a fully
verified post-mutation invariant. An incorrect, missing, reversed, or partially written
dependency can therefore cause work to start in the wrong order. Canceled blockers are
also currently treated as satisfied without explicit human approval.

Monkey Maestro follows a sequential baton model: it waits for one issue to finish before
selecting one successor. Independent issues cannot start concurrently, orchestration
state is partly local, and recovering the real project state requires knowledge of the
previous relay execution.

`git-gremlin:spawn` also combines workspace creation, agent selection, handoff, and
cleanup around a local single-agent workflow. It does not expose the terminal identity
needed for project-level reconciliation and cannot serve cleanly as a reusable execution
primitive.

The user needs to approve a Linear project and its dependency graph once, activate
Maestro once, and then request reconciliation whenever desired. Each reconciliation must
reconstruct project reality from Linear, GitHub, and Superset, safely fill available
execution slots, and remain recoverable without relying on an immortal agent session or
private issue queue.

## Solution

The delivery contains two subsystems with a strict ownership boundary.

### Verified project graph

`linear-devotee:create-project` owns the complete Linear project cascade. It validates
the dependency DAG before mutation, binds approval to the exact payload hash, creates
issues and relations recoverably, then reloads Linear and verifies exact graph
equivalence.

### Project execution reconciler

Monkey Maestro owns every project-execution entry point:

- `monkey-maestro:start` activates project orchestration after one approval defining the
  default agent and concurrency policy.
- `monkey-maestro:spawn` creates one task-linked Superset workspace and agent, then
  returns their `workspaceId` and `terminalId`.
- `monkey-maestro:reconcile` reloads Linear, GitHub, and Superset, identifies existing
  executions through `taskId`, and invokes `monkey-maestro:spawn` for eligible issues
  until available slots are filled.
- `monkey-maestro:stop` prevents future dispatches without terminating executions
  already in progress.
- Monkey Maestro's branch guard redirects forbidden in-place branch creation to
  `monkey-maestro:spawn`.

The migration deletes `git-gremlin:spawn` and moves its branch hook in the same release.
No alias or compatibility layer remains. Git Gremlin retains only Git delivery
responsibilities such as review, commit, and PR creation; this deletion is a boundary
cleanup, not a third subsystem.

Linear remains the durable project memory. Maestro has no private issue queue and runs
only when `reconcile` is invoked manually, by a known workflow transition, or through an
optional user-configured Superset automation.

`linear-devotee:greet` remains the sole owner of moving a launched issue to `In Progress`.
Canceled blockers remain unsatisfied until explicitly waived by a human.

## Architecture

### Ownership boundaries

`linear-devotee` owns project definition and dependency correctness.
`monkey-maestro` owns project execution and Superset resources. `git-gremlin` owns Git
delivery after implementation begins.

The existing `run / advance / halt` relay is replaced by `start / reconcile / stop`.
Persistent local relay flags and baton files are removed.

`superset-orchestrate` remains the coordinator for temporary parallel work that has no
durable Linear project lifecycle. Maestro uses Superset CLI primitives directly and does
not invoke or depend on that conversational skill.

### Durable control state

Each activated project has one versioned Maestro control comment in Linear containing:

```text
schema_version
run_id
active
repository
superset_project_id
target_host_id
default_agent
max_concurrency
decision_hash
revision
```

Each dispatched issue receives a versioned execution comment containing its `run_id`,
`workspaceId`, `terminalId`, branch, agent, and dispatch outcome. These records provide
traceability but never replace native Linear statuses or dependency relations.

Human waivers for canceled blockers are recorded explicitly on the dependent issue with
the blocker, reason, approver, and timestamp.

### Reconciliation lifecycle

A `reconcile` execution:

1. acquires a short-lived project lock on the configured host;
2. reloads the control record and authoritative Linear graph;
3. validates that the graph remains acyclic and internally consistent;
4. reloads GitHub PR state and Superset workspaces and terminals;
5. reconstructs in-flight executions through `taskId`;
6. calculates available capacity;
7. dispatches eligible issues in deterministic Linear order;
8. verifies every created workspace and terminal;
9. records execution identities in Linear;
10. releases the lock and exits.

The lock prevents concurrent reconciliations on the project's single configured host. It
is ephemeral coordination, not project memory. A failed run can be reconstructed from
Linear and Superset without the lock contents.

### Spawn lifecycle

`monkey-maestro:spawn` owns one issue dispatch. When called from an authorized active
project, it inherits the approved host, agent, and concurrency policy and requires no
additional confirmation. When called manually outside a project reconciliation, it
presents its own mutation gate.

The branch interception hook moves into Monkey Maestro and redirects in-place branch
creation to this manual spawn workflow.

After the Superset agent starts, `linear-devotee:greet` loads the issue context and
remains the sole owner of the `In Progress` transition.

## Components / data flow

- **Project cascade drafter:** produces the Linear project, milestones, complete issue
  packets, and proposed dependency DAG.
- **Graph validator:** rejects cycles, unknown targets, self-dependencies, reversed
  relations, duplicate edges, cross-project edges, and missing Acceptance coverage before
  mutation.
- **Cascade committer:** creates approved Linear entities in recoverable phases and maps
  draft identifiers to real Linear identifiers.
- **Graph verifier:** reloads the created project and compares the stored graph with the
  approved graph before allowing activation.
- **Control records:** `start` and `spawn` write the versioned Linear project and issue
  comments; `reconcile` and `stop` read and update them.
- **Project snapshot loader:** reads Linear issues, statuses, dependency relations,
  waivers, and deterministic ordering.
- **Runtime inspector:** reads GitHub PR state and Superset workspaces, agents, and
  terminals for the configured host.
- **Eligibility resolver:** derives startable issues from the verified graph, native
  Linear state, explicit waivers, existing executions, and remaining concurrency.
- **Spawn executor:** creates one task-linked workspace, starts its configured agent,
  verifies both identities, and records the dispatch.
- **Reconcile coordinator:** owns the short-lived lock, invokes the readers and resolver,
  fills available slots, and emits one structured report.
- **Branch guard:** prevents in-place branch creation inside Superset-managed repositories
  and redirects manual work to `monkey-maestro:spawn`.
- **Issue bootstrap:** `linear-devotee:greet` loads context, moves the issue to
  `In Progress`, and hands off to planning and implementation.

```text
approved spec or project request
  -> draft complete Linear cascade and dependency DAG
  -> validate and preview exact payload
  -> user approves once
  -> create project, issues, milestones, and relations
  -> reload and verify exact Linear graph
  -> activate Maestro control record
  -> reconcile Linear + GitHub + Superset
  -> resolve eligible issues and available slots
  -> spawn task-linked workspaces and agents
  -> greet -> plan -> implementation -> verification -> PR
  -> Linear/GitHub records completion
  -> next reconcile unlocks dependents
```

`superset-orchestrate` remains outside this flow. It coordinates temporary parallel work
that has no durable Linear project lifecycle.

## Error handling

The approved graph hash protects the initial project creation without freezing Linear
for the lifetime of the project. Every reconciliation reloads and validates current
Linear state.

- Linear title, description, priority, assignment, order, and status changes are adopted
  automatically.
- Workflow status names are never hard-coded; Maestro uses normalized status types and
  reloads workflow metadata.
- A dependency addition is adopted automatically after DAG validation because it reduces
  the set of startable issues.
- A change that can expand runnable work, including a removed or reversed dependency or a
  newly startable issue, requires confirmation before the affected dispatch.
- A canceled blocker remains unsatisfied until an explicit human waiver is recorded.
- An invalid graph component and its descendants are quarantined while independent valid
  components remain eligible.
- An issue moved out of the project is no longer managed, but its active execution is not
  terminated automatically.
- An issue added to the project enters the next validated snapshot.
- An unknown Linear response, missing API field, or unrecognized status representation
  blocks only decisions that require the missing data.
- Temporary Linear unavailability prevents new dispatches while existing executions
  continue.
- Partial creations, orphaned workspaces, and missing terminals are reconstructed by
  `taskId` before any retry decision.
- A concurrent reconciliation exits without mutation when the project lock is held.
- A stale lock requires explicit recovery after verifying that its owning terminal no
  longer exists.
- A workspace created without a successfully launched agent is recorded as a partial
  execution and never duplicated automatically.
- A failed Linear write after a verified Superset dispatch is reported as degraded
  traceability and repaired from runtime identity on the next reconciliation.
- A workspace whose issue remains unclaimed is inspected and reported instead of
  relaunched.
- A merged GitHub PR does not satisfy a blocker until Linear records the blocker as
  completed.
- Exhausted capacity completes as a successful no-op.
- An inactive or invalid Maestro control record permits no external mutation.
- Unreliable Linear, GitHub, or Superset state permits no new dispatch decision.

No failure deletes an existing workspace, terminates an active agent, marks an issue
completed, or silently rewrites the dependency graph.

## Acceptance

### Project graph creation

- [AC-001] WHEN a Linear project cascade is drafted, THE SYSTEM SHALL produce the complete normalized dependency DAG before any external mutation.
- [AC-002] IF the proposed DAG contains a cycle, unknown target, self-edge, duplicate edge, cross-project edge, or invalid direction, THE SYSTEM SHALL refuse mutation and identify the exact relation.
- [AC-003] WHEN the cascade is previewed, THE SYSTEM SHALL display every project, milestone, issue, dependency, and the normalized payload hash.
- [AC-004] WHEN the user approves the cascade, THE SYSTEM SHALL bind that approval to the exact previewed payload hash.
- [AC-005] WHEN a partially committed cascade resumes, THE SYSTEM SHALL retry only operations not confirmed by Linear.
- [AC-006] WHEN all approved entities and relations have been written, THE SYSTEM SHALL reload the complete graph from Linear and compare it with the approved graph.
- [AC-007] IF the reloaded graph differs from the approved graph, THE SYSTEM SHALL mark the project unverified and refuse Maestro activation.

### Maestro activation and control

- [AC-008] WHEN Maestro is activated for a project, THE SYSTEM SHALL persist a versioned Linear control record containing its `run_id`, repository, Superset project, host, agent, concurrency, decision hash, and revision.
- [AC-009] WHEN no concurrency value is supplied, THE SYSTEM SHALL configure four simultaneous executions.
- [AC-010] IF requested concurrency exceeds ten, THE SYSTEM SHALL reject the configuration.
- [AC-011] WHEN Maestro is stopped, THE SYSTEM SHALL prevent every future dispatch for that project.
- [AC-012] WHEN Maestro is stopped while executions are active, THE SYSTEM SHALL leave those executions running.
- [AC-013] WHEN no `reconcile` invocation occurs, THE SYSTEM SHALL launch no project execution.
- [AC-014] WHEN the user configures a Superset automation, THE SYSTEM SHALL allow that automation to invoke the same `reconcile` workflow.

### Reconciliation and eligibility

- [AC-015] WHEN reconciliation begins, THE SYSTEM SHALL acquire an exclusive short-lived lock for the project on its configured host.
- [AC-016] IF another reconciliation owns the project lock, THE SYSTEM SHALL exit without external mutation.
- [AC-017] WHEN reconciliation holds the lock, THE SYSTEM SHALL reload Linear, GitHub, and Superset before resolving eligibility.
- [AC-018] WHEN an execution already exists for a Linear `taskId`, THE SYSTEM SHALL count it as in flight and refuse a duplicate dispatch.
- [AC-019] WHEN capacity is available, THE SYSTEM SHALL select eligible issues in deterministic Linear order until the configured limit is reached.
- [AC-020] WHEN concurrency capacity is exhausted, THE SYSTEM SHALL complete reconciliation as a no-op and report the active executions.
- [AC-021] WHEN an issue is evaluated, THE SYSTEM SHALL consider it eligible only when every blocker is completed in Linear or covered by a valid explicit waiver.
- [AC-022] IF a blocker is canceled without an explicit waiver, THE SYSTEM SHALL keep the dependent issue blocked.
- [AC-023] WHEN a valid waiver is recorded, THE SYSTEM SHALL satisfy only the named blocker-to-dependent relation.
- [AC-024] IF GitHub reports a merged PR while Linear has not completed the blocker, THE SYSTEM SHALL keep the dependent issue blocked.

### Linear evolution and resilience

- [AC-025] WHEN Linear issue metadata, ordering, assignment, priority, or status changes, THE SYSTEM SHALL adopt the fresh values without requiring graph approval.
- [AC-026] WHEN a dependency is added, THE SYSTEM SHALL adopt it automatically after validating the resulting DAG.
- [AC-027] WHEN a Linear change expands the set of runnable issues, THE SYSTEM SHALL require confirmation before dispatching the newly runnable work.
- [AC-028] IF a graph component becomes invalid, THE SYSTEM SHALL quarantine its affected issues and descendants.
- [AC-029] WHEN one graph component is quarantined, THE SYSTEM SHALL continue reconciling independent valid components.
- [AC-030] WHEN an issue is added to the active Linear project, THE SYSTEM SHALL include it in the next validated snapshot.
- [AC-031] WHEN an issue leaves the active Linear project, THE SYSTEM SHALL stop managing it without terminating an existing execution.
- [AC-032] IF Linear is unavailable or required Linear data is unknown, THE SYSTEM SHALL launch no new execution.
- [AC-033] IF Linear changes a required API field or workflow representation, THE SYSTEM SHALL block only decisions whose required data cannot be normalized.

### Spawn and issue ownership

- [AC-034] WHEN Maestro dispatches an eligible issue, THE SYSTEM SHALL create exactly one task-linked workspace on the project's configured Superset host.
- [AC-035] WHEN the workspace is verified, THE SYSTEM SHALL launch the project-configured agent and capture its `workspaceId` and `terminalId`.
- [AC-036] WHEN a dispatch is verified, THE SYSTEM SHALL record its execution identity in a versioned Linear issue comment.
- [AC-037] WHEN `monkey-maestro:spawn` runs under an approved active project reconciliation, THE SYSTEM SHALL require no additional per-issue confirmation.
- [AC-038] WHEN `monkey-maestro:spawn` runs as a standalone manual workflow, THE SYSTEM SHALL require an explicit mutation confirmation.
- [AC-039] IF workspace creation succeeds but agent launch fails, THE SYSTEM SHALL record the partial execution and refuse automatic duplicate workspace creation.
- [AC-040] WHEN a spawned agent claims an issue, THE SYSTEM SHALL leave the `In Progress` transition exclusively to `linear-devotee:greet`.
- [AC-041] IF a workspace exists while its issue remains unclaimed, THE SYSTEM SHALL inspect and report that execution instead of launching another one.

### Ownership migration

- [AC-042] WHEN this migration is installed, THE SYSTEM SHALL expose `spawn` from Monkey Maestro and expose no `spawn` skill from Git Gremlin.
- [AC-043] WHEN the branch guard intercepts in-place branch creation, THE SYSTEM SHALL redirect the user to `monkey-maestro:spawn`.
- [AC-044] WHEN Git Gremlin is installed after the migration, THE SYSTEM SHALL contain no workspace orchestration hook or spawn contract.
- [AC-045] WHEN Maestro reconciles a Linear project, THE SYSTEM SHALL use Superset CLI primitives without requiring the `superset-orchestrate` skill.
- [AC-046] WHEN `superset-orchestrate` is invoked independently, THE SYSTEM SHALL remain usable for temporary parallel work without Maestro project state.

### Recovery

- [AC-047] WHEN reconciliation restarts after interruption, THE SYSTEM SHALL reconstruct project execution from Linear records and Superset `taskId` mappings without a private local issue queue.
- [AC-048] WHEN one exact workspace matches a missing execution record, THE SYSTEM SHALL repair the Linear record instead of redispatching the issue.
- [AC-049] IF multiple runtime resources ambiguously claim one issue, THE SYSTEM SHALL block that issue and report every conflicting resource.
- [AC-050] IF recording to Linear fails after a verified dispatch, THE SYSTEM SHALL preserve the runtime execution and report degraded traceability for repair on the next reconciliation.

## Acceptance history

- None.

## Testing approach

### Dependency graph contract tests

Table-driven fixtures cover valid DAGs, cycles, self-edges, duplicate edges, unknown
issues, reversed relations, cross-project relations, disconnected components, and
canceled blockers. Every failure identifies the exact offending relation.

### Cascade mutation and recovery tests

A controlled Linear boundary simulates successful creation, partial issue creation,
partial relation creation, timeouts after successful writes, duplicate retry attempts,
and post-write graph drift. Tests prove that approval remains bound to one payload hash
and that resume never duplicates confirmed entities.

### Reconciliation state-machine tests

Normalized Linear, GitHub, and Superset snapshots cover:

- zero, partial, and exhausted concurrency;
- multiple independent startable roots;
- completed, canceled, waived, started, and unknown blockers;
- existing workspaces and terminals matched by `taskId`;
- partial and ambiguous runtime resources;
- safe Linear metadata changes;
- dependencies added or removed after activation;
- newly runnable work requiring confirmation;
- invalid components quarantined beside valid components;
- stopped projects and concurrent reconciliations.

Each fixture asserts the selected issues, blocked reasons, required confirmations,
dispatch order, and final report.

### Spawn integration tests

Temporary Git repositories and Superset boundary doubles verify branch naming, one host
per project, task-linked workspace creation, agent launch, `workspaceId` and `terminalId`
capture, partial failure recording, and duplicate prevention.

Standalone spawn tests require confirmation. Project-authorized spawn tests prove that
the existing project approval is sufficient.

### Hook migration tests

The branch guard test suite moves to Monkey Maestro and continues covering
`git checkout -b`, `git switch -c`, and `git branch <new>`. Static tests reject remaining
`git-gremlin:spawn` references, skills, agents, hook messages, and manifest entries.

### Resilience and compatibility tests

Fixtures remove or rename optional Linear response fields, change workflow status names,
simulate temporary API failures, move issues between projects, and interrupt
reconciliation between every external operation. The system must either normalize fresh
state, quarantine only affected decisions, or stop dispatch safely.

### Repository gates

Final verification runs the affected plugin suites and repository-wide contracts:

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

- Run Maestro continuously or enable periodic reconciliation by default.
- Automatically create a scheduled Superset automation.
- Distribute one project's executions across multiple Superset hosts.
- Replace Linear with a private Maestro issue queue or database.
- Emulate arbitrary Linear custom fields.
- Accept cross-project dependency edges.
- Repair, reverse, remove, or waive a dependency without explicit authority.
- Mark Linear issues completed directly from Maestro.
- Merge GitHub pull requests automatically.
- Terminate active agents or delete workspaces when Maestro is stopped.
- Automatically delete completed workspaces during reconciliation.
- Replace `superset-orchestrate` for temporary ad hoc parallel work.
- Make Monkey Maestro depend on the `superset-orchestrate` skill.
- Preserve aliases for `git-gremlin:spawn` or the former sequential relay skills.
- Automatically migrate historical relay flags, baton files, or active relay sessions.
- Implement the feature work described by the dispatched Linear issues.
- Guarantee progress when Linear, GitHub, or Superset cannot provide trustworthy state.
