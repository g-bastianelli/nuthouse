# Issue plan review and handoff

Read this after drafting and before validation or implementation handoff.

## Choose review depth

For a small conventional change with settled behavior, apply the criteria in
`../../../agents/plan-auditor.md` locally: issue scope, source consistency, actual
integration, observable verification, and coordination. Record evidence without implying
independence.

Before delegated review, resolve the logical agent through
`${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` (using the resolved `PLUGIN_ROOT`
outside Claude Code). Use `linear-devotee:plan-auditor` for new boundaries, interacting tasks, access/data-safety
changes, material failure/recovery behavior, unresolved source conflict, or a requested
independent review. Pass raw `PROJECT_ROOT`, `PLUGIN_ROOT`, `PLAN_FILE`, `SPEC_FILE`,
`PROJECT_PLAN`, `ISSUE_CONTEXT_BRIEF`, `COORDINATION_CONTEXT`, and existing paths.

Require `PLAN_REVIEW`, `SPEC_DRIFT_DETECTED`, `REVIEWED_ACCEPTANCE`, `DRIFT_ITEMS`,
`BLOCKERS`, `COORDINATION_REVIEW`, and `COORDINATION_EVIDENCE`. Missing criteria, drift,
blockers, failed coordination, or an incomplete assessment cannot pass. Reuse a current
review and recheck only affected relationships unless the correction widens scope.

Fix supported findings. After three failed rounds on the same issue, stop with the missing
evidence or decision. Reject unsupported style preferences. A source conflict must be
resolved through its owning workflow and authorization before validation; never validate
first and promise to patch drift later.

## Validate and hand off

Show the plan link, consequential decisions, and review result. Reuse already delegated
technical authority; otherwise request review of the concrete artifacts. Set
`status: validated` and the actual `validated-at` only after a clean review and authorized
decisions.

Emit readable absolute paths:

```text
ISSUE_DELIVERY_PACKET:
  ISSUE: <ISSUE_ID>
  PLAN_FILE: <absolute issue-plan path>
  SPEC_FILE: <absolute source path | _none_>
  PROJECT_PLAN: <absolute project-plan path | _none_>
  RELEVANT_FILES: [<existing readable paths only>]
```

Continue to implementation only when already requested. The implementer reads the
installed Acid Prophet `shared/development-drift.md`, retains source/issue identity, checks
after each functional block and before a PR, and runs `moon-moth:verify` in a moon workspace.
If Acid Prophet is unavailable, report the limit instead of claiming the checks ran.

Once the implementation is complete and its verification passes, deliver it without asking.
Deliver only from a feature branch: on the base branch or a detached `HEAD`, report the work as
uncommitted and stop. Pass `git-gremlin:commit` the exact paths the implementation created,
changed, or deleted, never "all changes", so unrelated work in the tree stays out.

**REQUIRED SUB-SKILL:** Use `git-gremlin:commit` for missing verified implementation changes.

When `linear-devotee:deliver` supplied an existing matching PR, commit only missing authorized
changes and return its URL, branch, local head, and verification to that caller instead of
invoking `pr` again. Its `finish-pr` handoff publishes the scoped commits and verifies the
remote head before review. If no commit is missing, reuse the existing commit. This avoids a
second PR or duplicate publication during recovery.

Otherwise continue the authorized implementation handoff with a draft PR. Pass the intended
base, exact implementation scope, source Acceptance, current verification, and scoped repair
authority to `pr`. It first simplifies the scoped diff without changing behavior, verifies and
commits any cleanup, then completes native code review, corrects supported defects, verifies and
commits the repairs, and reviews the resulting diff before publication. Passing tests, plan
review, and source-drift checks do not replace this code review.

**REQUIRED SUB-SKILL:** Use `git-gremlin:pr` when no matching PR was supplied by `deliver`.

If a required Git Gremlin skill is unavailable, report the actual commit/publication state and
missing capability instead of delivering it by hand.

Report the issue, plan version/path, source and project plan, audit result, and
`implementation_ready | blocked | stopped`, plus the draft PR URL and completed native-review
evidence when implementation ran. A failed/unavailable reviewer or unresolved supported
finding returns `blocked` with the recoverable commit and concrete next action; no draft is published.
With a `deliver` caller, return control and evidence there; an open draft is an intermediate
result, not completed full delivery. Without that caller, stop at this requested handoff and
do not add PR finishing, merge, or Linear completion authority.
