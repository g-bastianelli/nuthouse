# Spec artifact contract

Read this when writing, revising, or auditing a spec. These fields carry requirements
between Acid Prophet, planning, and Linear. They do not prescribe interview length.

## File and metadata

Default path: `docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md`.

```yaml
---
id: <slug>
status: draft
spec-version: 1
linear-project: _none_
verified-by: _none_
last-reviewed: <today YYYY-MM-DD>
---
```

All keys are required and non-empty. `spec-version` is a base-10 positive integer.
`_none_` is valid for `linear-project` and `verified-by`; it is not missing data.
Set version 1 when creating a spec. When revising accepted requirements, advance the
version once for the revision and return the spec to draft until reviewed and approved.
Do not infer approval from metadata alone. Missing version in an existing spec requires
checking its history before assigning one, not inventing a default in the auditor.

## Sections

Use headings beginning with `Problem`, `Solution`, `Architecture`, `Components`,
`Error handling`, `Testing`, and `Non-goals`; heading suffixes are fine. Use exact
`Acceptance` and `Acceptance history` headings to distinguish active and retired criteria.
Add Constraints, Decisions, or Evidence when they carry useful information. No section
needs filler: explain briefly when a concern does not apply.

The Problem names the actor and outcome. Solution describes behavior. Architecture and
Components explain boundaries, reuse, and data ownership with repository evidence;
mark proposed files `[new]` and distinguish them from paths claimed to exist. Error
handling describes observable outcomes and side effects. Testing identifies how the
behavior can be demonstrated, including relevant failures. Non-goals preserve scope.

## Acceptance identity and meaning

Each active bullet has one stable id and one observable criterion:

```markdown
- [AC-001] WHEN <trigger>, THE SYSTEM SHALL <observable behavior>
- [AC-002] IF <condition>, THE SYSTEM SHALL <observable behavior>
```

Keep those structural keywords and identifiers even when the surrounding text is in
another language. Read active Acceptance only until the next heading of the same or
higher level; exclude history, code examples, and ids mentioned elsewhere.

An id matches `AC-###` (exactly three digits). Start new specs at AC-001. Never renumber
or reuse an accepted id, including one retired from the active list. Allocate the next
unused id above the highest active or retired id. A material behavior change remains
explicit in the revision; do not silently rewrite what an accepted id means.

Syntax is insufficient: the criterion must distinguish success from failure for the
intended actor and conditions. "Return quickly" or "handle errors gracefully" without
an observable bound/outcome is unresolved behavior. Derive checks from user intent and
existing policies; do not invent targets to make a vague sentence look measurable.

Retire an accepted criterion by removing it from Acceptance and recording:

```markdown
- [AC-007] retired 2026-09-07 — WHEN <former trigger>, THE SYSTEM SHALL <former behavior> — reason: <non-empty reason>
```

Use the actual ISO retirement date and preserve the former criterion verbatim. Active
and retired ids are each unique and disjoint. With no retired criteria, write `- None.`
under Acceptance history. Plans, contracts, quickstarts, checklists, and Linear issues
reference active ids; they never create substitute ids or resurrect retired ones.

## Uncertainty

Use `[NEEDS CLARIFICATION: <specific decision>]` for missing behavior or a consequential
choice without sufficient authority/evidence. Keep it next to the affected statement.
Document a justified reversible implementation choice as a decision with its evidence;
it is not automatically an unresolved product requirement. A draft may carry open
markers. A ratified spec carries none.

## Audit readiness

The caller reads the complete report against the [auditor's gate and output contract](../agents/spec-auditor.md).
Every gate and the verdict must appear once with a permitted
value. Finding sections and the summary must be present, with counts matching the actual
findings. Harmless formatting differences do not change the decision.

Readiness requires an explicit `handoff-eligible: yes`, zero actual blockers, and every
gate passing; only an absent constitution permits `constitution: n/a`. An explicit `no`
remains blocked. Read the evidence too: a reported contradiction, unresolved consequential
decision, or missing essential evidence cannot become ready through a passing label or
a zero in the summary. Return such discrepancies to the auditor for correction.

An incomplete, duplicate, unreadable, or internally inconsistent assessment cannot support
ratification or planning. Preserve the actual report and explain what needs correction.
An empty auto-fix section or a no-candidates marker proposes no change. Audit readiness
assesses the proposal; it never supplies the user's approval or authority to mutate.
