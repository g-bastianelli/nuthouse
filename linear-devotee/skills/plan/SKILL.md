---
name: plan
description: Plan one Linear issue from its source and repository, review scope and observable verification, then prepare the authorized implementation handoff without implementing or changing Acceptance.
argument-hint: "[issue-id] [--fresh]"
model: opus
effort: high
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent
---

# linear-devotee:plan

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Resolve `PLUGIN_ROOT` to the absolute plugin directory from `${CLAUDE_PLUGIN_ROOT}` in Claude
Code or this skill's directory (`../..`) elsewhere. Read `${PLUGIN_ROOT}/shared/planning-context.md`
for source authority, discovery, questions, and artifact paths.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Establish the deliverable

1. Resolve the repository and issue from the request, current context, or branch. Read repository
   instructions. Ask for an issue id only when none is unambiguous.
2. Reuse a current issue brief or `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json` when it belongs to
   this issue and repository. `--fresh`, changed decisions, stale context, or missing Acceptance
   calls for `linear-devotee:issue-context`. Request full active criteria and decision sources;
   keep large Linear fetches in the scout. Use the runtime's plugin data directory when available;
   absent cache or Claude-specific environment variables must not prevent planning.
3. Resolve the spec and project plan using the shared rules. Reopen relevant code and tests.
   Establish this issue's Acceptance, integration points, current behavior, intended change,
   constraints, and real blockers. Do not turn every project AC into this ticket.
4. Read an existing `docs/linear-devotee/plan/<ISSUE_ID>.md` before writing. Preserve useful
   decisions, stable task ids, and verified completed work. Reopen a completed task only when
   new evidence invalidates it, explaining why. Never silently reset version 1 or erase progress.
   Reuse an already suitable plan with a current review instead of manufacturing a revision.

Before validating a plan, apply `../../shared/coordination-review.md`. Collect affected peer
bodies, decisions and dependency closure as `COORDINATION_CONTEXT`, or record none with a reason.
A required contract or missing Linear relation must be repaired upstream and read back before
implementation readiness; this skill can prepare the exact correction but cannot apply it.

## Write the complete plan

Before drafting, read [`references/plan-artifact.md`](references/plan-artifact.md).
Write `docs/linear-devotee/plan/<ISSUE_ID>.md` before final review. Scale detail to the
work, investigate ordinary code questions yourself, and keep consequential unknowns
visible.

## Review and resolve

Read [`references/review-and-handoff.md`](references/review-and-handoff.md), then perform
one risk-proportionate review, resolve supported findings, validate only clean authorized
artifacts, and emit the delivery packet. Planning never implements, mutates Linear,
commits, pushes, or rebases.
