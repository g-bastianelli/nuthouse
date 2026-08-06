# ADR 0005 — Stable Acceptance IDs join specs, plans, and issues

- **Status**: Accepted
- **Date**: 2026-08-05
- **Scope**: `acid-prophet` and `linear-devotee`

## Context

The two plugins already had strong human gates, codebase-aware audits, recoverable Linear writes,
and dependency-aware next-work selection. Their weakest seam was the handoff itself:

- `write-spec` required an Acceptance gate but did not explicitly author the Acceptance section;
- an approved spec stayed `draft`, which made the next planning stage warn on its own output;
- plans, checklists, and drift findings joined criteria by prose rather than stable identity;
- `create-project` previewed issue titles, then drafted full issue bodies inside the post-approval
  Linear mutation phase.

The last point meant the user had not actually approved the Acceptance criteria that reached Linear.
It also made partial resume dependent on regenerating prose from thin title-only state.

Current external workflows point in the same direction:

- [GitHub Spec Kit](https://github.github.com/spec-kit/reference/agentic-sdd.html) generates
  dependency-ordered tasks and sends inconsistencies back to their source artifact before
  implementation.
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) keeps proposal, requirements/scenarios,
  design, and tasks as an explicit artifact chain reviewed before code.
- [Superpowers](https://github.com/obra/superpowers/blob/main/RELEASE-NOTES.md) added plan-scoped
  state and a pre-flight plan read after observing cross-plan contamination.
- [Beads](https://github.com/gastownhall/beads) demonstrates durable dependency graphs and
  ready-work detection for long-running agent workflows.
- [Linear coding sessions](https://linear.app/changelog/2026-06-11-coding-sessions) can now run
  Claude Code or Codex directly from issue context, increasing the value of a complete issue body.

## Decision

1. Every active Acid Prophet Acceptance criterion has a unique, stable `[AC-###]` id and EARS body.
   Ratified ids are never renumbered or reused. Retirement moves the criterion from `## Acceptance`
   to `## Acceptance history` as
   `[AC-###] retired YYYY-MM-DD — <former EARS text> — reason: <reason>`; active and retired id sets
   must remain disjoint.
2. `spec-auditor` adds the hard `acceptance-traceable` gate.
3. Plans, contracts, quickstarts, checklists, and drift reports preserve those ids. Plan pre-flight
   rejects missing or unknown coverage and labels infrastructure-only work as `foundation`.
4. `write-spec` ratifies frontmatter only after both the auditor and user approve. Commits of generated
   repository artifacts are separate explicit choices.
5. `project-drafter` emits complete issue packets before Linear mutation. Each packet contains a stable
   draft key, dependencies, Acceptance references, constraints, files, and the exact future issue body.
6. `create-project` validates exhaustive Acceptance coverage and an acyclic dependency graph before its
   single approval gate. The mutation phase persists and replays the approved `sdd_body` verbatim.
7. Partial resume never regenerates approved issue prose. Legacy title-only state must return through an
   explicit standalone draft/preview path.
8. `AC-###` is reserved for source specs and approved project Acceptance registers. Standalone Linear
   issues use the disjoint `AC-L###` namespace. When a source register exists, issue drafting may only
   preserve its ids; new behavior must return to the source rather than mint a local id.
9. Every spec carries a positive integer `spec-version`. Auditing and planning fail closed when it is
   absent or invalid; downstream artifacts preserve the exact source value without fallback.

## Consequences

### Positive

- Traceability is deterministic across spec → plan → issue → QA → drift instead of fuzzy prose matching.
- The Linear approval gate now covers the material issue content that will actually be written.
- Partial failures resume from stable bodies and dependencies without semantic drift.
- Native Linear Agent coding sessions receive self-contained issues suitable for Claude Code or Codex.

### Negative

- Specs written before this ADR can fail `acceptance-traceable` until their criteria are assigned ids.
- Pre-ADR specs commonly lack both `spec-version` and `## Acceptance history`; the auditor now
  reports both as BLOCKERs instead of silently treating them as version 1 or folding retired
  criteria into active coverage.
- Full cascade previews are longer because they contain approval-ready issue bodies.
- Vibe mode must establish and approve a compact Acceptance register before decomposition.

### Migration for pre-ADR specs

1. Run `acid-prophet:audit-spec` and assign stable `AC-###` ids to active criteria without
   renumbering any id already referenced downstream.
2. Choose `spec-version: 1` only after a human confirms the artifact has no earlier version ledger;
   otherwise preserve or reconstruct the real positive version. This field is never auto-fixed.
3. Add `## Acceptance history` with `- None.` only when no retired criterion is known. Otherwise
   reconstruct each retirement using the exact grammar in this ADR before the spec becomes eligible.

### Rejected alternatives

- **Add another SDD framework as a runtime dependency** — duplicates ownership and weakens the plugins'
  self-contained dual-runtime contract.
- **Generate ids in Linear after project creation** — too late; plans and the approval preview need them.
- **Keep title-only previews and add per-issue gates during mutation** — destroys the single global approval
  contract and makes recovery harder to reason about.
