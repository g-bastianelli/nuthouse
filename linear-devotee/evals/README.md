# Behavioral evaluations

Evaluate the agent's decisions and resulting artifacts, not the presence of phrases in a skill.
Use disposable repositories and a separate plugin snapshot. Supply a fresh agent only the raw
task, snapshot instructions, and fixture paths; keep the rubric and other runs out of its context.
Use no network services, Linear writes, commits, or publication. Never simulate a user answer.

These fixtures can be prepared with ordinary file tools. Keep baseline and candidate inputs
identical, except for the plugin snapshot and absolute directory roots. Record actual artifacts,
the snapshot revision, model/runtime if exposed, and limits of each observation.

## Issue-plan fixture

Create an ESM repository with no dependencies, `node --test` as its package test command, and
`src/invitations.mjs`:

```javascript
export function invite(actor, input) {
  if (actor.role !== "admin") return { status: 403, error: "forbidden" };
  if (!input.email?.includes("@")) return { status: 400, error: "invalid_email" };
  return { status: 201, invitation: { email: input.email, note: input.note ?? "" } };
}

export function validateNote(note) {
  return typeof note === "string" && note.length <= 240;
}
```

Write a ratified version-1 spec in `docs/acid-prophet/specs/invitations.md`, project `project-1`,
with these active criteria:

- [AC-001] WHEN an admin submits a valid email and a supplied non-string note or a note longer than 240 characters, THE SYSTEM SHALL return 400 with invalid_note and no invitation.
- [AC-002] WHEN an admin exports the invitation audit, THE SYSTEM SHALL return CSV with email and creation time columns.

The architecture assigns note validation to LD-12 and independent export to LD-13. Reuse the
existing validator after role/email guards, preserve response shapes, normalize an omitted note
to an empty string, and use JavaScript string length. Testing exercises the public entry point
for non-strings, 240/241 characters, omission, and guard precedence. No new dependency is needed.

Write a validated project plan at `docs/acid-prophet/plans/invitations/plan.md` with
`spec: ../../specs/invitations.md` and `spec-version: 1`. Give LD-12 only AC-001 and LD-13 AC-002,
with no dependency between them. The LD-12 brief copies AC-001 exactly in Acceptance and mentions
AC-002 only as excluded work owned by LD-13.

### audit-slice

Write an LD-12 plan with one pending task to integrate the validator after the existing guards.
Map only AC-001 to that task and to tests calling `invite`. Expected results include complete
400/invalid_note responses without invitation for supplied non-strings and 241 characters, and
unchanged success and guard precedence. Mark the absent test file as proposed new.

Ask the snapshot's plan auditor to review the plan using the full brief, spec, project-plan
path, and actual source. Supply both `PROJECT_PLAN` and, for comparison with the initial revision,
`PROJECT_PLAN_CONTEXT` pointing to the same raw plan.

### audit-verification

Use the same sources and plan, but make verification assert only `validateNote(null) === false`
and rejection of 241 characters. Explicitly import but never call `invite`. Ask for the same
review. The underlying entry-point bug remains present even though those assertions pass.

### plan-resume

Use a version-2 validated LD-12 plan with completed T0 discovery and pending T1 implementation.
Its test description lacks an explicit 241-character case. Supply a current greet snapshot in
the fixture's data directory with the exact brief/spec but `project_plan: _none_`.

Request: revise the existing plan to add that explicit entry-point regression, preserve valid
completed discovery, and validate the revision. Scope is approved; reversible technical choices
and validation are delegated. Finish at the implementation handoff, before implementation or any
external write. The project plan remains discoverable by its relative source reference.

## Project-decomposition fixture

Create nine existing connector modules named atlas, birch, cedar, delta, elm, fir, grove, hazel,
and iris. Each exports `normalizeEvent(input)` returning `{ name: input.name.trim() }`.
The approved release plan uses one independently owned issue per connector. For each connector,
provide a separate exact source criterion: a blank name produces
`{status: 400, error: 'invalid_name'}` without throwing. Blank means absent, non-string, or
whitespace-only. Preserve nonblank behavior, add no dependency or shared abstraction, and declare
the connector releases independent. Give a current raw workspace snapshot with one selected
team, a backlog status, and no labels or existing projects.

Ask `project-drafter` to produce the complete proposal using the spec, exact register, repository,
and supplied metadata. No project plan, contracts, quickstart, constitution, or codebase map is
provided. Do not supply an artifact inventory or expected decomposition to the evaluator beyond
the user's approved one-issue-per-connector release plan.

## Rubric — evaluator only

| Case                  | Assess the actual result                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| audit-slice           | Pass the coherent AC-001 slice; do not import AC-002 or reject a proposed new test file                                                                                                           |
| audit-verification    | Block helper-only evidence that cannot expose the broken entry point; keep AC-002 outside issue coverage                                                                                          |
| plan-resume           | Read the code, resolve the relative project plan, preserve completed T0, write version 3, review locally at this conventional boundary, and honor delegated validation without another permission |
| project-decomposition | Emit all nine complete packets, exact criteria, meaningful verification, and no fabricated blockers, deadlines, or inventory prerequisites                                                        |

Inspect written artifacts and source files, not just the final response. Planned tests must not
be reported as passing. Record a useful question separately from a repeated request for already
provided context. One successful run does not establish a success rate or general superiority.

See [recorded observations](results/2026-09-07.md). Live provider mutations and timeout recovery
need separate integration evidence; offline drafting does not verify them.

## Shared coordination and existing-project review

Give a fresh read-only evaluator [coordination-cases.md](coordination-cases.md) and the local
plugin instructions it names. Keep this rubric and prior results out of its context. The cases
use complete synthetic snapshots and forbid provider calls, writes, and dispatches. Assess the
actual decisions, including current-state versus proposed-correction readiness:

| Case | Required outcome                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------- |
| A    | Refuse unresolved mandatory ack agreement despite an empty graph; propose a concrete resolution.         |
| B    | Accept the agreed contract and independently verifiable contributions without an edge.                   |
| C    | Reject file-only serialization and justify independent edits in the same module.                         |
| D    | Require E-2 → E-1 for the concrete codec output, or justify coherent regrouping.                         |
| E    | Detect the cycle through the third existing issue; do not reverse/delete necessary edges arbitrarily.    |
| F    | Preserve ids, Acceptance and completed discovery; preview a repair without claiming it approved/applied. |
| G    | Retain the actual implementation prerequisite despite the fixed format.                                  |
| H    | Report incomplete dependency closure as unknown; no ready creation or execution handoff.                 |

Structural validation is separate: use the existing graph helper/tests for edge-free components,
consumer → producer ordering, and cycles through existing edges. Do not claim the helper detects
unresolved prose. See [the coordination review run](results/2026-09-08-coordination.md).
