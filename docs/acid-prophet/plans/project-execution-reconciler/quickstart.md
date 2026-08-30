# quickstart — project-execution-reconciler

> Historical v1 walkthrough. Its repeated reconciliation steps are retained for release
> traceability and are superseded by the spec-version 2 orchestration contract.

## Setup

- Install dependencies: `bun install`.
- Prepare a Linear test project fixture with two independent roots, one dependent issue, one canceled blocker, and one malformed disconnected component.
- Prepare Superset boundary fixtures for zero, one, and multiple workspace matches by `taskId`.

## Walkthrough

1. Draft the complete project cascade, normalize it with `linear-devotee/scripts/project-graph.mjs validate`, and preview every entity plus the returned hash.
   observe: invalid cycles, unknown targets, self-edges, duplicates, cross-project edges, reversed relations, and missing Acceptance coverage identify the exact item before any mutation.
   covers: AC-001, AC-002, AC-003
2. Approve the displayed hash, simulate an interrupted cascade, resume it, then compare the reloaded Linear snapshot with the approved payload.
   observe: only unconfirmed operations retry; an exact graph becomes verified and any missing, extra, or reversed relation produces an unverified receipt that blocks activation.
   covers: AC-004, AC-005, AC-006, AC-007
3. Run `monkey-maestro:start` against the verified project without specifying concurrency, then inspect the Linear control comment and Superset runtime.
   observe: the versioned record contains the run, repository, Superset project, host, default agent, decision/graph hashes, revision, and `maxConcurrency: 4`; a value above ten is rejected; after releasing the activation lock, one complete reconciliation pass dispatches eligible work without a second ordinary gate.
   covers: AC-008, AC-009, AC-010
4. After the initial pass exits, do not invoke reconciliation again, then invoke it manually and from a user-configured Superset automation fixture.
   observe: no additional workspace appears without another invocation; both later invocations use the same workflow.
   covers: AC-013, AC-014
5. Hold the project lock in one fixture and start two reconciliations; release it and run again with fresh Linear, GitHub, and Superset snapshots.
   observe: the second run exits without mutation while locked; the unlocked run reads all providers before resolving.
   covers: AC-015, AC-016, AC-017
6. Reconcile with two existing task-linked executions and four configured slots.
   observe: existing executions count as in flight, no duplicate is selected, two eligible roots are selected in deterministic Linear order, and a full-capacity fixture reports a successful no-op.
   covers: AC-018, AC-019, AC-020
7. Evaluate dependents whose blockers are completed, canceled, explicitly waived, and represented only by a merged GitHub PR.
   observe: only Linear completion or the exact human waiver satisfies an edge; canceled and GitHub-only completion remain blocked.
   covers: AC-021, AC-022, AC-023, AC-024
8. Change titles, priority, assignment, order, and status metadata; add a safe dependency; then remove or reverse an edge so new work becomes runnable.
   observe: metadata and constraining dependencies are adopted automatically, while dispatch created by an expanding graph change requires confirmation.
   covers: AC-025, AC-026, AC-027
9. Reconcile a graph with one invalid component and descendants beside an independent valid root.
   observe: the invalid component and descendants are quarantined while the independent root remains dispatchable.
   covers: AC-028, AC-029
10. Add one issue to the project, move one running issue out, rename workflow statuses, remove a required response field, and simulate Linear unavailability.
    observe: the added issue enters the next snapshot; the moved issue stops being managed without termination; normalized fields continue, and only unknowable decisions block with no new dispatch during outage.
    covers: AC-030, AC-031, AC-032, AC-033
11. Dispatch one eligible issue through authorized reconciliation.
    observe: the exact opaque Linear identifier resolves to one Superset task, exactly one workspace is created on the configured host with that internal Superset `taskId`, the configured agent launches, both identities plus workspace/terminal identities are recorded in a versioned issue comment, and no per-issue approval is requested.
    covers: AC-034, AC-035, AC-036, AC-037
12. Invoke `monkey-maestro:spawn` manually, deny then grant its mutation gate, and simulate agent launch failure plus an existing unclaimed workspace.
    observe: denial creates nothing; approval dispatches once; failure records a partial workspace without duplication; existing unclaimed work is inspected; only `linear-devotee:greet` can set `In Progress`.
    covers: AC-038, AC-039, AC-040, AC-041
13. Inspect installed plugin inventories and trigger each guarded branch command.
    observe: Monkey Maestro exposes `spawn` and owns the guard redirect; Git Gremlin exposes neither spawn nor orchestration hooks; `git checkout -b`, `git switch -c`, and `git branch <name>` all redirect to `monkey-maestro:spawn`.
    covers: AC-042, AC-043, AC-044
14. Reconcile without the `superset-orchestrate` skill installed, then invoke `superset-orchestrate` independently for a temporary task.
    observe: Maestro uses only Superset CLI primitives and the independent orchestration workflow remains usable without Maestro state.
    covers: AC-045, AC-046
15. Interrupt after workspace creation, remove its Linear execution comment, and reconcile zero, one, then multiple runtime matches for the same `taskId`.
    observe: state is reconstructed without a private queue; one exact match repairs the comment; multiple matches block only that issue and enumerate conflicts.
    covers: AC-047, AC-048, AC-049
16. Fail the Linear comment write after a verified dispatch, then reconcile again.
    observe: the runtime is preserved, degraded traceability is reported, and the next run offers repair rather than redispatch.
    covers: AC-050
17. Run `monkey-maestro:stop` while a fixture execution is active, then reconcile again.
    observe: the control revision becomes inactive, the execution keeps running, and no future dispatch is emitted.
    covers: AC-011, AC-012

## Cleanup

- Remove only the temporary Linear/Superset fixtures created for the walkthrough; do not delete active user workspaces.
- Release any test lock through its token-aware cleanup path.
