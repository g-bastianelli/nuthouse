---
name: write-plan
description: Turn an approved spec into an implementation plan grounded in repository code, with dependency-ordered deliverables, necessary contracts, and observable acceptance checks. Use before implementing a ratified Acid Prophet spec.
argument-hint: [spec-path]
model: opus
effort: xhigh
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# acid-prophet:write-plan

Produce a plan an implementing engineer can execute and verify without rediscovering
the project or making unstated product decisions.

Resolve `PLUGIN_ROOT` from this skill's `../..` directory. Before dispatching the spec
auditor, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` in Claude Code, or the
same file under the resolved `PLUGIN_ROOT` in other runtimes.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Resolve the source

Establish `PROJECT_ROOT` from the repository. Use a caller's `SPEC_FILE` exactly; otherwise
use the argument path, then a unique matching spec under `docs/acid-prophet/specs/`.
Ask when selection remains ambiguous. Do not reconstruct a supplied path from conversation.

Read the source and `../../shared/spec-format.md`. Require an approved source status
(`ratified | approved | ready | implementing`), a positive `spec-version`, and no open
clarification markers. If the source is still a draft, route it through
`acid-prophet:write-spec` for reconciliation and ratification; do not offer an override
that is immediately contradicted by an audit gate.

Reuse a complete passing auditor report when its spec content and relevant project evidence
still apply, including a report from the preceding skill or a resumed session. Read the source
and prior findings; a skill/session boundary or metadata-only ratification is not a reason to
repeat the audit. Re-audit when the report is missing, substantive source changes or relevant
code changes invalidate it, or a consequential finding remains unresolved. Then dispatch
`acid-prophet:spec-auditor` with
`SPEC_PATH`, `PROJECT_ROOT`, `PLUGIN_ROOT`, and `MODE: report-only`. Read its actual output
using Audit readiness in `../../shared/spec-format.md`; require a complete, consistent
assessment whose findings support handoff. Request one correction for a missing or
contradictory assessment. If readiness remains unconfirmed, report the problem and keep
planning blocked; never silently use another spec or invent ids.

Extract active `SOURCE_AC_IDS` only from Acceptance, excluding history and examples.
Read `docs/acid-prophet/constitution.md` when present; otherwise set `CONSTITUTION_FILE`
to `_none_`. A planning request never creates a constitution implicitly.

## Map the implementation before dividing the work

Read applicable instructions and trace the source paths, symbols, and tests the feature
depends on. Reuse recent evidence when still current. Delegate a bounded exploration
when useful, asking for existing utilities, state owners, integration seams, test commands,
and unresolved evidence. Distinguish verified paths from proposed new files.

Record the result in `codebase-map.md`. Follow established conventions unless a concrete
requirement prevents it. Resolve reversible technical details within delegated authority
and explain consequential choices. Ask only when the choice changes approved behavior,
scope, external commitments, or an expensive boundary. Do not fill a contract with
guessed product policy. Source defects go back to the spec owner for an explicit revision.

## Build deliverables with evidence

Read `../../shared/plan-format.md` for the artifact shapes and handoff fields.

- Each task delivers a behavior or a necessary enabling change with a concrete consumer.
  Group setup with the deliverable it serves. Split tasks where one outcome can be
  implemented and verified independently; avoid a separate task for every command.
- Order dependencies explicitly. Put the riskiest unproven integration early enough
  to change the plan before the bulk of implementation. For data migrations or partial
  writes, specify ordering/recovery only where the feature needs them.
- Give each task files/symbols, intended change, `covers: AC-###` (or `foundation` with a
  reason), verification command or manual check, and the expected observable result.
  An id alone does not prove a task implements that criterion.
- Use existing testing tools. For a regression, identify the failing behavior to reproduce
  first; for new behavior, name the success and relevant failure checks. Do not require
  a new framework, full implementation pasted into the plan, or TDD for a prose-only edit.
- Create a typed contract only for a changed data/interface boundary. Document producers,
  consumers, invariants, and errors using actual repository conventions. A single consumer
  is sufficient when the boundary has a concrete purpose. Keep `contracts/` empty when no
  contract is needed, and say why in the plan.
- Make `quickstart.md` an executable scenario or a set of focused scenarios that cover
  every active AC, including applicable negative paths. State preconditions, actions,
  expected outcomes, and cleanup. These are planned checks, not results already obtained.

Write the draft artifacts before asking anyone to review them. For multi-turn work, keep
only the current step, artifact paths, and unresolved decisions in
`.nuthouse/plan-<slug>/progress.md`; resume by reading that ledger and the artifacts.

## Review the whole plan

Compare the spec against tasks, contracts, and quickstart. Every active id needs a real
implementation path and an observable check. Reject unknown/retired ids, uncovered
requirements, incompatible types, impossible task ordering, or tests that only assert
an internal detail instead of the required behavior. Check source and plan versions agree.

For a plan with a new boundary, interacting tasks, or material failure/recovery behavior,
dispatch a fresh read-only agent with the spec, draft artifacts, repository root, and
constitution path. Ask it to walk the plan as the implementing engineer: identify concrete
missing decisions, contradictions, unavailable integration points, unverified acceptance,
or dependency problems. Request evidence and consequences, or an explicit no-blocker
result. Do not send your own desired verdict. A small conventional plan can use the same
walkthrough locally; report which review was performed.

Fix evidenced defects, then recheck the affected relationships. After two unsuccessful
correction attempts on the same blocker, leave the draft with the reason and decision
needed. Report coverage, meaningful findings, and any check that could not be confirmed.

Present one coherent review with links, important choices, and risks. If the user delegated
the technical planning and the plan remains within approved behavior, complete validation
after these checks. Otherwise obtain the outstanding approval on the concrete artifacts.
On validation, set `status: validated`, `validated-at` to the current ISO timestamp, and
the exact source version. Increment `plan-version` when revising a previously validated
plan. An unresolved marker or blocker prevents validation.

## Handoff

Return every named path in `../../shared/plan-format.md`, checking that each non-`_none_`
path exists and is readable. A draft can be reported but cannot be handed off as validated.

When `RETURN_TARGET: linear-devotee:create-project` accompanies `SPEC_FILE`, return the
validated artifact fields to that caller immediately; do not restart its interview or
mutate Linear. When the user already requested implementation, hand the full artifact set
to the implementing turn: read it before coding, follow repository instructions, use
applicable `subroutine` discipline, and finish with `moon-moth:verify` in a moon workspace.

When a Linear breakdown is requested:

**REQUIRED SUB-SKILL:** Use `linear-devotee:create-project` with the named artifact fields.

Otherwise report the validated plan and next useful action. Leave artifacts uncommitted
unless a commit was requested; use the available commit workflow for that authorized action.

## Completion

Report source and plan paths, actual status, deliverables, AC coverage, review performed,
unresolved decisions, and handoff taken. Never label planned verification as passing tests.
