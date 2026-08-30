# quickstart — resilient-linear-first-maestro

## Setup

- Install dependencies: `bun install`.
- Prepare deterministic Linear and Superset adapter fixtures.
- Use a control v1 fixture containing deliberately malformed obsolete hashes.

## Walkthrough

1. Bootstrap a project once, then apply targeted status and relation refreshes.
   observe: no second full hydration; a changed edge affects the next frontier.
   covers: AC-001, AC-002, AC-003, AC-004
2. Plan terminal, ready, blocked, unknown, cyclic, and independent issues.
   observe: terminal issues bypass Superset; valid independent work remains ready.
   covers: AC-005, AC-006, AC-007
3. Plan several `started` issues without runtime and request a grouped force launch.
   observe: one confirmation covers named issues; hard safety refusals remain enforced.
   covers: AC-008, AC-009, AC-010, AC-011, AC-012
4. Inspect only selected candidates with zero, one, and multiple exact workspaces.
   observe: actions are create, reuse, and issue-scoped ambiguous.
   covers: AC-013, AC-014
5. Drive three independent issues through the production effect bridge while A fails and
   one mutation is ambiguous.
   observe: fresh invocation-bound effect ids reject forged/cross-invocation transcripts;
   B and C continue; the lock is reverified immediately before transport mutation; ambiguous
   creation is inspected exactly once.
   covers: AC-015, AC-016
6. Monitor exact active terminals, including a newly launched terminal, emit one worker
   event, then exhaust work.
   observe: monitoring begins only after lock release; cached dependents are derived from
   live frontier relations; targeted Linear refresh precedes promotion; idle exits
   immediately; GitHub is never called.
   covers: AC-017, AC-018, AC-019, AC-020
7. Start, inspect, and stop a project while Superset is unavailable.
   observe: control v2 is minimal, status is Linear-only, and stop writes `active:false`.
   covers: AC-021, AC-022, AC-023
8. Reconcile one runtime record and spawn one issue through the shared primitive.
   observe: reconcile never changes graph authority; invalid agent output is rejected.
   covers: AC-024, AC-025, AC-026
9. Read the malformed v1 control and recover stale, empty, and legacy locks.
   observe: operational fields remain usable and one concurrent lock owner wins.
   covers: AC-027, AC-028
10. Run the `NOT-549`/`NOT-550`/`NOT-554` regression fixture.
    observe: `NOT-550` dispatches despite completed runtime residue, unrelated unknown state, and unavailable GitHub.
    covers: AC-029

## Cleanup

- Release fixture locks through token-matched cleanup.
- Delete only temporary fixture directories.
