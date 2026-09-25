---
name: write-spec
description: Turn a feature or project request into a codebase-grounded spec with observable acceptance criteria and an independent audit. Use when a written spec is wanted before planning or Linear issue breakdown.
argument-hint: [feature-or-project-description]
model: opus
effort: max
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# acid-prophet:write-spec

Make consequential decisions clear enough that another engineer can implement the feature
without guessing its behavior. Scale discovery to uncertainty and impact.

Resolve `PLUGIN_ROOT` to this skill's plugin directory (`../..`). Before delegation, read
`${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` for the active runtime's agent name;
outside Claude Code, substitute the resolved `PLUGIN_ROOT`.

Read `../../persona.md`; it is canonical for user-facing output until the final report.

## Ground the request

1. Use the conversation and arguments as the brief. Establish the project root and read
   applicable instructions, the package manifest, and any supplied spec.
2. Trace the affected flow through source and tests: entry point, state/data owner, external
   boundary, validation, and errors. Delegate only bounded exploration and ask for paths,
   symbols, and conclusions rather than file dumps.
3. State a short working understanding before questions: user, current behavior, desired
   outcome, known constraints, and the most consequential uncertainty. Cite repository
   evidence and reuse it throughout the run.
4. For settled focused work, draft directly. For unclear behavior or a new boundary,
   investigate risky decisions first. Propose a useful first slice only when the request
   contains independently deliverable outcomes; never silently discard scope.

## Resolve decisions

- Separate what the user gave, what the repository proves, what you recommend, and what
  remains unresolved.
- Ask only about choices that change user-visible behavior, permissions, retention, scope,
  external commitments, or expensive boundaries. Resolve reversible implementation detail
  from repository conventions and record the reason.
- For an open consequential choice, explain its impact, recommend an option, and ask one
  focused question. Mark unresolved product policy exactly
  `[NEEDS CLARIFICATION: <decision needed>]`; a marked draft cannot be ratified.
- Compare alternatives only when a real trade-off exists. Include the simplest viable reuse,
  its decisive constraint, its cost, and the evidence that would change the recommendation.

## Draft the proposal

Read `../../shared/spec-format.md`, then write
`docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md` before final review.

- Cover one representative user journey and applicable failures in observable Acceptance:
  invalid input, authorization, repetition, conflict, dependency failure, or partial work.
- Explain what the caller observes and what state changes or remains intact.
- Record consequential choices and rejected alternatives with reasons.
- Cite existing integration points, mark proposed files `[new]`, and keep code examples
  contract-sized.
- Do not invent policy, performance targets, retries, or test infrastructure to fill a
  section.

When revising an existing spec or receiving named inputs from another workflow, read
[`references/revision-and-handoffs.md`](references/revision-and-handoffs.md) before editing.

## Audit and ratify

Before dispatching the auditor, read
[`references/audit-and-ratification.md`](references/audit-and-ratification.md) and follow
its complete gate. A clean audit proves readiness for review, not user approval.

## Continue authorized work

If the user already requested a plan or Linear breakdown, continue with the ratified artifact:

- plan → **REQUIRED SUB-SKILL:** `acid-prophet:write-plan` with the absolute spec path;
- Linear project → **REQUIRED SUB-SKILL:** `linear-devotee:create-project` with the absolute
  spec path.

Otherwise report the useful next step without a mandatory commit question or handoff menu.
Leave the artifact uncommitted unless a commit was requested; use the authorized commit
workflow when available.

## Completion

Report the actual spec path, `draft | ratified` status, active criterion count, audit
outcome, open decisions, and next action. A written draft is a valid partial artifact.
