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

Report the issue, plan version/path, source and project plan, audit result, and
`implementation_ready | blocked | stopped`.
