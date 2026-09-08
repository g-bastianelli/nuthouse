# Planning from issue and repository evidence

For creation, revision, and plan review, read `coordination-review.md` in this directory and
apply its shared-contract and interdependent-change checks before reporting readiness.

## Source authority

The issue defines the deliverable being planned. Its active Acceptance section defines the
required criterion set for that issue, not every criterion in the project's spec. Read source
Acceptance, constraints, and the project plan to check consistency and dependencies; criteria
assigned to other issues stay outside this issue's implementation scope.

- Copy a source-backed `AC-###` criterion exactly from its active source register. A different
  meaning under the same id is a conflict, not a refinement. Never renumber or reuse ids.
- `AC-L###` denotes issue-local Acceptance when there is no source register. Keep it distinct
  from `AC-###`, including when their numeric suffixes match.
- A shared criterion can appear in several issues when its delivery crosses boundaries. Name
  each issue's contribution and the issue that owns final integrated verification; copying the
  same criterion everywhere does not establish coverage.
- An explicit foundation issue may have no source AC ids. Require its recorded foundation
  reason, the concrete deliverables it enables, and an observable verification of its own
  output. Do not manufacture a product criterion to satisfy a template.

Read the issue description and relevant comments with their author, date, and decision context.
A suggestion in a newer comment does not automatically replace approved Acceptance. Report
conflicting decisions with their sources and consequence; ask the person who can resolve them.
Distinguish stated requirements, observed code behavior, and proposed implementation choices.

## Repository discovery

Read applicable repository instructions, the affected entry point, its immediate callers and
boundaries, and relevant tests before proposing a change. Follow evidence outward only when it
changes the plan. A cached file list is a starting point, not proof that files or behavior remain
current.

Classify paths as existing, explicitly proposed new, or unresolved. An absent path claimed to
exist is unresolved; an explicitly proposed file need not exist yet. Confirm the parent module
and integration point for a new file. Keep only existing readable files in `RELEVANT_FILES`.

## Artifact resolution

Explicit source paths in the request or issue take precedence over cached associations. Verify
that they exist and belong to the intended issue/project; a missing explicit source is a blocker,
not permission to select another spec with a similar name.

Without an explicit source, inspect `docs/acid-prophet/specs/` for an exact issue reference, then
matching `linear-project` metadata. A project name/slug is a discovery hint, not authority. Ask
only if the remaining candidates cannot be distinguished from the issue's scope. If there is no
source, record `_none_` and use the issue's own Acceptance.

Find project plans under `docs/acid-prophet/plans/**/plan.md`. Resolve each frontmatter `spec`
path relative to the directory containing that plan, or directly when absolute. Compare the
resolved file with the selected spec, not the literal strings. For example,
`plans/invitations/plan.md` with `spec: ../../specs/invitations.md` references the sibling specs
directory. Require a validated plan for the current source version before treating it as approved
architecture. Multiple matching validated plans, or a named stale plan, require resolution.
An absent project plan does not prevent a bounded issue plan grounded in the source and code;
it does prevent pretending that new architecture has already been approved.

Handoff artifacts use absolute paths. Proposed new code files belong in the plan, not the list of
existing handoff artifacts. Re-read affected sources when a revision or new evidence makes a
prior review stale; matching Git HEAD alone says nothing about uncommitted changes.

Repository file references persisted in Linear descriptions use repository-relative paths
such as `src/invitations.mjs` and `docs/acid-prophet/specs/invitations.md`. The next engineer
resolves them against their own checkout. Keep absolute local paths for agent inputs and local
handoff artifacts, rather than embedding a temporary worktree location in a shared issue.

## Questions and review

Ask as many consequential questions as the task needs: outcome, user-visible behavior, failure
policy, access, data ownership, scope, acceptance, or a costly architectural choice. Explain
which decision the answer changes and recommend an option when evidence supports it. Do not
ask again for an explicit project, milestone, goal, or decision already provided.

Propose routine reversible implementation choices within the user's authorization. Label
proposals as proposals, not discovered facts. Optional labels, dates, and non-applicable template
sections can be `_none_` with a reason. An unresolved requirement stays `_unclear_` and blocks
readiness when it changes what would be built or written.

Review complete artifacts. Check that proposed behavior satisfies the criteria, each step has a
real integration point, and verification could fail if the required behavior were absent. A path
list, an AC mention, or a command that imports a module is not behavioral coverage. Keep planned
verification distinct from results actually observed.
