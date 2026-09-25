# Plan artifact set

Read this before drafting. The canonical field names and shapes remain in
`../../../shared/plan-format.md`.

## Tasks

Group setup with the deliverable it enables. Split only when outcomes can be implemented
and verified independently; do not create one task per command or enforce a generic
database/backend/frontend sequence.

For each task include:

- files and symbols, marking proposed files `[new]`;
- intended behavior and dependencies;
- `covers: AC-###`, or `foundation` with a concrete consumer and reason;
- a verification command or manual scenario;
- the expected observable result.

For regressions, identify the failing behavior to reproduce first. For new work, name the
success case and relevant failures.

## Contracts

Create a typed contract only for a changed data or interface boundary. Identify producers,
consumers, invariants, and errors using repository conventions. A single consumer is enough
when the boundary has a concrete purpose. Keep `contracts/` empty when none is needed and
say why in the plan.

## Quickstart

Make `quickstart.md` an executable scenario or focused scenario set covering every active
Acceptance id, including applicable negative paths. State preconditions, actions, expected
outcomes, and cleanup. These are planned checks, not results.

## Progress ledger

For multi-turn work, keep only the current step, artifact paths, and unresolved decisions
in `.nuthouse/plan-<slug>/progress.md`. Resume by reading the ledger and artifacts instead
of reconstructing state from memory.
