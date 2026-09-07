---
name: plan
description: Use when planning implementation for a Linear issue after greet or from an issue id. Grounds an issue-scoped plan in source and code, reviews behavior and verification in proportion to risk, then prepares the authorized implementation handoff. Does not implement or silently change source Acceptance.
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

## Write the complete plan

Write `docs/linear-devotee/plan/<ISSUE_ID>.md` before requesting final review. Scale detail to the
work: one coherent change can be one task; multiple boundaries need explicit ownership and
ordering. Investigate ordinary code questions yourself. Ask focused product or architectural
questions when their answers change the plan; keep consequential unknowns visible.

```yaml
issue: <ISSUE_ID>
linear-project: <project id | _none_>
spec: <absolute path | _none_>
project-plan: <absolute path | _none_>
status: draft
plan-version: <1 for a new plan; previous version + 1 for a material revision>
acceptance-ids: [AC-001, AC-L001]
validated-at: _none_
```

A foundation-only issue uses an empty acceptance list and explains its source foundation reason
in Context. A material revision becomes draft and clears the old validation timestamp; keep its
revision number stable across corrections within the same review.

Include these sections:

- **Context** — intended outcome, observed behavior, issue/source references, approved decisions,
  and remaining consequential questions.
- **Files** — affected entry points, reuse, and paths marked existing/modified/new. Describe the
  integration, not just filenames.
- **Acceptance traceability** — each assigned id maps to tasks and observable verification.
  Copy exact criterion text or link its precise source. Explain shared-criterion contributions
  and who owns integrated verification.
- **Implementation steps** — stable task ids and checkboxes, `covers: <assigned ids>` or
  `covers: foundation` with a concrete reason; changes, dependencies, and completion evidence.
  Group by deliverable, not a compulsory database/backend/frontend sequence.
- **Verification** — commands or scenarios, expected success and failure behavior, and criteria
  proved. Distinguish reproduced failures, planned tests, and actual results. Use existing tools.
- **Risks** — material failure modes and dependencies, with their handling or unresolved decision.
- **Out of scope** — adjacent work excluded or owned by another issue.

## Review and resolve

Review the plan once at the appropriate depth. For a small conventional change with settled
behavior, apply the review criteria in `../../agents/plan-auditor.md` locally: issue scope,
source consistency, actual integration, and observable verification. Record the evidence and
findings as a local review; do not create a separate reviewer report or imply independence.

Use `linear-devotee:plan-auditor` for new boundaries, interacting tasks, changes to access/data
safety, material failure/recovery behavior, unresolved source conflicts, or a requested
independent review. Pass `PROJECT_ROOT`, the resolved absolute `PLUGIN_ROOT`, `PLAN_FILE`,
`SPEC_FILE`, `PROJECT_PLAN`, the full `ISSUE_CONTEXT_BRIEF`, and relevant existing paths.
Supply raw sources, not a rationale for
passing. Its review replaces a duplicate full walkthrough by the caller; inspect its findings
and check that the report covers the issue's active criteria.

For a delegated report, require `PLAN_REVIEW`, `SPEC_DRIFT_DETECTED`, `REVIEWED_ACCEPTANCE`,
`DRIFT_ITEMS`, and `BLOCKERS`. A pass with missing criteria, drift, blockers, or an incomplete
assessment needs correction. Reuse a prior review whose plan and relevant evidence remain
unchanged. Recheck only affected relationships after a correction, widening review when the
change affects the rest of the plan.

Fix supported findings and re-review the changed plan. After three unsuccessful rounds, stop
with the remaining evidence or decision needed. Reject unsupported style preferences with a
short explanation instead of inventing a compliance edit.

For source conflicts, first check whether the plan can satisfy both issue and source. If intended
behavior needs to change, present the concrete conflict and proposed resolution. Revise the
source through its owning workflow and the user's authorization, preserving AC identities and
updating its version, then rerun affected reviews. Never validate a plan and offer to patch away
its drift afterwards.

## Validate and hand off

Show the plan link, consequential decisions, and review result. When the user already approved
scope and delegated these technical choices or this validation, apply that authority without
another yes/no prompt. Otherwise request review of this complete plan. An audit proves readiness;
it does not decide unresolved product policy for the user.

Set `status: validated` and the actual `validated-at` timestamp only after a clean review and
authorized decisions. Keep blocked drafts explicit. Emit absolute, readable paths inside the repo:

```text
ISSUE_DELIVERY_PACKET:
  ISSUE: <ISSUE_ID>
  PLAN_FILE: <absolute issue-plan path>
  SPEC_FILE: <absolute source path | _none_>
  PROJECT_PLAN: <absolute project-plan path | _none_>
  RELEVANT_FILES: [<existing readable paths only>]
```

Continue into implementation when the user's request already includes it. If they requested only
a plan, finish with the artifact and readiness result. Do not insert a commit menu or another
permission for the same authorized step. This skill prepares the plan; the implementing agent
follows it and runs repository verification, including `moon-moth:verify` in moon workspaces.

Report the issue, plan version/path, source and project plan, audit result, and
`implementation_ready | blocked | stopped`. Do not implement, mutate Linear, commit, push,
or rebase as part of planning.
