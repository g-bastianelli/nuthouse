# acid-prophet

![acid-prophet](./assets/banner.png)

The spec oracle for Claude Code and Codex. Ground the prophecy in the code.

Acid Prophet turns a request into a reviewed spec, then an executable implementation
plan. It investigates existing behavior before asking questions, separates product
decisions from reversible technical choices, and checks whether the resulting behavior
is coherent and observable. Stable `AC-###` ids carry the same acceptance criteria
through plans, contracts, quickstarts, Linear issues, checklists, and drift reports.

## Skills

| Skill                             | Purpose                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `acid-prophet:write-spec`         | Investigate a feature, resolve consequential decisions, write a draft, and independently audit it before ratification     |
| `acid-prophet:audit-spec`         | Review behavior, acceptance, architecture, and repository evidence in an existing spec                                    |
| `acid-prophet:write-plan`         | Turn an approved spec into dependency-ordered deliverables, necessary contracts, a codebase map, and acceptance scenarios |
| `acid-prophet:write-constitution` | Ratify project-specific governing articles that later audits enforce                                                      |
| `acid-prophet:write-checklist`    | Derive an open QA checklist preserving the source acceptance ids                                                          |
| `acid-prophet:check-drift`        | Compare planned work or branch changes with the authoritative spec                                                        |

## Discovery and review

For a focused change with settled requirements, discovery can go directly from the
affected code to a compact draft. New boundaries or unclear behavior receive deeper
investigation. Questions target decisions whose answers change behavior, scope, or
expensive commitments. Technical choices grounded in existing conventions can proceed
within the user's delegated authority.

The user reviews one coherent document. An independent `spec-auditor` reads the spec
and relevant source/tests without receiving the writer's desired verdict. Behavioral
contradictions, unobservable requirements, and missing consequential decisions block
readiness. Optional improvements remain warnings. Abstractions are judged by their
purpose and cost; component and consumer counts are not pass/fail thresholds.

The complete audit reports `simplicity`, `anti-abstraction`, `behavior-consistent`,
`acceptance-defined`, `acceptance-traceable`, `clarifications-resolved`, and `constitution`.
The calling skill reads the complete report, checks that its findings and counts agree,
and requests correction when the assessment is incomplete or contradictory. An asserted
`handoff-eligible: yes` cannot override a failed gate or a blocker in the actual findings.

Readiness does not ratify a spec. The final product intent must be approved, and accepted
ids must stay stable. A draft can contain `[NEEDS CLARIFICATION: ...]`; a ratified spec
cannot. Spec and plan creation leave artifacts uncommitted unless a commit is requested.
Follow-up planning or Linear work continues when it was already requested.

## Planning and handoff

`write-plan` preserves the approved spec's behavior and version. Tasks describe concrete
deliverables, dependencies, files/symbols, acceptance coverage, verification, and expected
results. Contracts exist only where an interface needs one. Quickstart scenarios include
the relevant failure paths as well as success; planned checks are never reported as test
results. Complex plans receive an independent walkthrough, while small conventional plans
can be reviewed locally.

Reuse an applicable spec audit across the spec-to-plan handoff or a resumed session. New
substantive changes or unresolved findings justify another review; moving to the next skill
does not by itself require repeating it.

```text
write-spec → independent audit → ratification
                                  │
                                  ├→ write-plan → implementation or Linear breakdown
                                  └→ Linear breakdown

write-constitution: project constraints used throughout
write-checklist / check-drift: acceptance guidance and change review
```

Specs live under `docs/acid-prophet/specs/`. Plans live under
`docs/acid-prophet/plans/<slug>/{plan.md, codebase-map.md, quickstart.md, contracts/}`.
The exact [spec contract](shared/spec-format.md) and [plan contract](shared/plan-format.md)
are shared by their producers and reviewers. Linear receives the full artifact paths;
Acid Prophet itself makes no Linear mutation.

## Verification

The [behavioral evaluation procedure](evals/README.md) describes isolated fixture
repositories and requests for fresh agents, with separate outcome rubrics and recorded
observations. Review actual decisions and generated artifacts, including how callers
handle an incomplete or contradictory audit report.

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install acid-prophet@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `acid-prophet`.

Skills and the auditor use the same prose contracts in both runtimes. Each skill reads
`persona.md` directly for its voice; the auditor's structured report is neutral.
