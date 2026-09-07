---
name: write-spec
description: Turn a feature or project request into a codebase-grounded spec with observable acceptance criteria and an independent audit. Use when a written spec is wanted before planning or Linear issue breakdown.
argument-hint: [feature-or-project-description]
model: opus
effort: max
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# acid-prophet:write-spec

Make the consequential decisions clear enough that another engineer can implement the
feature without guessing its behavior. Scale discovery to uncertainty and impact.

Resolve `PLUGIN_ROOT` to this skill's plugin directory (`../..`). Before delegation,
read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` for the active runtime's agent
name; outside Claude Code, substitute the resolved `PLUGIN_ROOT` for that variable.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Start from the request and the code

Use the conversation and arguments as the brief. Establish the project root; outside
a repository, continue with the available context and report what could not be checked.
Read applicable `AGENTS.md` / `CLAUDE.md`, the package manifest, and an existing spec
when supplied. Then trace the affected flow through actual source and relevant tests:
entry point, state/data owner, external boundary, existing validation and errors.
Delegate a bounded exploration when needed; request paths, symbols, and conclusions,
not file dumps. An absent implementation is a fact to record, not permission to invent one.

Before asking questions, state a short working understanding: user, current behavior,
desired outcome, constraints already known, and the most consequential uncertainty.
Cite the files behind technical claims. Reuse discoveries throughout the run.

- For a focused change with settled behavior, write a compact spec directly.
- For a new boundary or unclear behavior, investigate the risky decisions first.
- When the request contains independently deliverable goals, propose a useful first
  slice and the relationship to later slices. Component count alone is not a reason
  to split one coherent user journey. Do not silently discard requested scope.

## Resolve decisions, not a questionnaire

Separate what is **given by the user**, **observed in the repository**, **recommended**,
and **unresolved**. Never present a recommendation as an existing requirement.

Ask about choices that change user-visible behavior, permissions, data retention,
scope, external commitments, or costly architectural boundaries. Resolve reversible
implementation details using repository conventions and the user's delegated authority;
record the choice and its reason. Do not ask the user to rediscover facts the code answers.

For a consequential open question, explain why the answer matters, give a recommendation,
and ask one focused question. Continue independent exploration while awaiting it.
For a material technical uncertainty, use a bounded read-only investigation or a disposable
experiment when authorized; record the observation and its limit. Do not turn speculation
into an architectural commitment. Unknown product policy gets a literal
`[NEEDS CLARIFICATION: <decision needed>]` at the affected requirement. A marked draft
can be reviewed but cannot be ratified.

Compare alternatives only where there is a real trade-off. Include the simplest viable
approach or reuse of the current design. Explain the decisive constraint, the cost of the
recommendation, and what evidence would change it. One obvious conventional solution
does not need two invented competitors.

## Draft a coherent proposal

Read `../../shared/spec-format.md` for the artifact and acceptance identity contract.
Write the draft under `docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md` before requesting
final review. Keep each section proportional to what it needs to communicate; a
straightforward feature may need only a sentence per section.

Work through one representative user journey and the failures that can change its outcome.
Choose relevant cases: invalid input, unauthorized actor, repeated action, conflicting
state, dependency failure, or partial completion. Cover the applicable cases in observable
Acceptance criteria. Explain in Error handling what the caller sees and what changes or
stays intact. Do not add policies, performance targets, retries, or test infrastructure
merely to fill a section.

Record consequential choices and rejected alternatives with their reasons. Cite existing
integration points and mark proposed files `[new]`. Keep implementation examples short
enough to explain a contract; a complete implementation belongs in the later work.

## Review the behavior before ratification

Dispatch the logical `acid-prophet:spec-auditor` with only the artifact paths and raw project
context; do not coach it with the desired verdict:

```text
SPEC_PATH: <absolute spec path>
PROJECT_ROOT: <absolute project root>
PLUGIN_ROOT: <absolute plugin root>
MODE: report-only
```

Read the complete returned report using Audit readiness in `../../shared/spec-format.md`.
Check the findings against its gates and verdict before calling the draft ready for
ratification. Preserve the actual report; missing or contradictory assessments need
correction and cannot count as a clean audit.

Fix defects whose resolution follows from approved intent or repository evidence. For a
decision that belongs to the user, explain the conflicting outcomes and ask the focused
question. Re-audit after substantive edits. If a malformed report or the same unresolved
finding persists after two correction attempts, leave a draft and explain the exact
remaining issue; do not loop indefinitely or relabel it as a pass.

Present the complete, audited proposal once: artifact link, meaningful decisions, acceptance
summary, and any remaining warnings with their consequences. Avoid asking for approval
of each heading. Honor authorization already given for concrete content. General authority
to investigate or draft does not approve an unseen product policy. When ratification is
still needed, ask for review of this document and wait.

After approval and a clean audit, set `status: ratified`, `verified-by: spec-auditor`, and
`last-reviewed` to today's ISO date. Keep source version and accepted ids accurate under
the format contract. Metadata-only ratification does not require repeating the same audit.
Leave the artifact uncommitted unless a commit was requested; use `git-gremlin:commit`
when that action is authorized and available.

## Continue the authorized work

If the user already requested a plan or Linear breakdown, continue that work with the
ratified artifact. Otherwise report the spec and the useful next step without a mandatory
commit question or handoff menu.

When a plan is requested:

**REQUIRED SUB-SKILL:** Use `acid-prophet:write-plan` with the absolute spec path.

When a Linear project is requested:

**REQUIRED SUB-SKILL:** Use `linear-devotee:create-project` with the absolute spec path.

When invoked from `linear-devotee:create-project`, accept these named inputs:

```text
SPEC_FILE: <absolute candidate path | _none_>
ACCEPTANCE_REGISTER: <absolute upstream register path | _none_>
RETURN_TARGET: linear-devotee:create-project
```

Read every supplied non-`_none_` path. Reconcile the existing candidate and register,
preserving accepted ids; do not restart the upstream interview or select another spec.
Audit and ratify through the same process. Return the absolute ratified spec path and its
active ids to `RETURN_TARGET` immediately. A blocked draft returns its blockers, never a
success handoff. This skill performs no Linear mutation and writes no session store.

## Completion

Report the actual spec path, `draft | ratified` status, number of active criteria,
audit outcome, open decisions, and next action taken. A written draft is a valid partial
artifact; an eligible audit proves readiness for review, not the user's approval.
