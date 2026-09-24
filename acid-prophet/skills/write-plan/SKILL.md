---
name: write-plan
description: Turn a ratified spec into a repository-grounded implementation plan with ordered deliverables, necessary contracts, and observable Acceptance checks.
argument-hint: [spec-path]
model: opus
effort: xhigh
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# acid-prophet:write-plan

Produce a plan an engineer can execute and verify without rediscovering the project or
making unstated product decisions.

Resolve `PLUGIN_ROOT` from this skill's `../..` directory. Before dispatching an agent,
read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; outside Claude Code, use the
same path under the resolved `PLUGIN_ROOT`. Read `../../persona.md`; it governs
user-facing output until the final report.

## Resolve the source

1. Establish `PROJECT_ROOT`. Use a caller's `SPEC_FILE` exactly; otherwise use the
   argument, then a unique match under `docs/acid-prophet/specs/`. Ask when ambiguous.
2. Read the source and `../../shared/spec-format.md`. Require an approved status,
   positive `spec-version`, and no clarification marker. Route drafts through
   `acid-prophet:write-spec`; never override an audit gate.
3. Reuse a complete auditor report while its source and repository evidence remain
   current. Re-audit substantive changes or missing/incomplete evidence with
   `acid-prophet:spec-auditor`, then apply the shared Audit readiness rules.
4. Extract active Acceptance ids only from Acceptance. Read
   `docs/acid-prophet/constitution.md` when present; otherwise use `_none_`.

## Map before dividing

Read repository instructions and trace the paths, symbols, data owners, boundaries, and
tests the work depends on. Delegate only bounded exploration. Record verified paths and
proposed files distinctly in `codebase-map.md`.

Follow repository conventions unless a requirement prevents it. Resolve reversible
technical choices within delegated authority. Ask only when a choice changes approved
behavior, scope, external commitments, or an expensive boundary; source defects return to
the spec owner.

## Build the artifact set

Read `../../shared/plan-format.md`, then read
[`references/artifacts.md`](references/artifacts.md) before writing the plan, contracts,
quickstart, and progress ledger.

Core rules:

- Each task delivers behavior or a necessary enabling change with a concrete consumer.
- Order real dependencies and expose risky integration early enough to change the plan.
- Every task names files/symbols, intended change, `covers: AC-###` or justified
  `foundation`, a verification action, and its observable result.
- Use existing test tools. Do not paste the implementation or require a new framework.
- Create a typed contract only for a changed interface boundary.
- Write draft artifacts before requesting review.

## Review and hand off

Read [`references/review-and-handoff.md`](references/review-and-handoff.md) before
validating, revising, or handing off the plan. Every active criterion needs both an
implementation path and an observable check; planned verification is never a passing test.

## Completion

Report source and plan paths, actual status, deliverables, Acceptance coverage, review
performed, unresolved decisions, and handoff taken. Leave artifacts uncommitted unless a
commit was requested.
