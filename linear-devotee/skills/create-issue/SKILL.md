---
name: create-issue
description: Use to add one coherent Linear issue to an existing project. Reuses supplied context, drafts exact Acceptance and observable verification, resolves consequential questions, and creates the complete authorized payload. Use create-project to resume a project cascade.
effort: high
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent, ToolSearch
---

# linear-devotee:create-issue

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Resolve the plugin root from this skill's directory (`../..`) when runtime variables are absent.
Read `../../shared/provider-selection.md` and `../../shared/planning-context.md`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Establish context

Resolve the repository, intended deliverable, project, and optional milestone from the request
and current context. Fetch only missing metadata. A named project does not need another project
picker; an absent optional milestone can remain unset unless attachment changes scope. Ask when
project identity or the intended outcome is genuinely ambiguous.

A partial project cascade must resume through its approved preview and recovery path.

**REQUIRED SUB-SKILL:** Use `linear-devotee:create-project` for cascade recovery.

Read the authoritative source spec/register, prioritizing an explicit path and then project
associations. A project's own approved Acceptance register can be the source when no local spec
exists. Pass exact active ids and text, not ids alone. Resolve conflicting source candidates;
never merge them or invent a source criterion. Capture selected team metadata, the milestone's
project membership, and exact existing label names/ids before preparing the final payload.

## Draft and resolve

Dispatch `linear-devotee:issue-drafter` with `PROJECT_ROOT`, `PROJECT_ID`, `MILESTONE_ID`,
`ISSUE_HINT`, `SOURCE_ACCEPTANCE`, and current raw `LINEAR_CONTEXT`. Include an explicit parent
packet when supplied. The scout returns the full SDD body, verification, overlap evidence, and
consequential questions.

Check that the issue is a coherent deliverable and its criterion wording matches the source.
Ask decision-changing questions, using supplied answers and recommendations. Do not ask for every
optional blank. A consequential `_unclear_` remains a blocker; the user may resolve or explicitly
defer a decision into a bounded discovery issue with its own completion conditions, but an
unresolved implementation policy cannot be labeled ready just by saying “ship as is”.

Inspect proposed duplicates and dependencies before preview. Resolve each actual blocking
relation to a specific issue and explain why its output is necessary. Milestone membership must
match the project. Resolve labels to exact ids now; omit an unsupported suggestion with an
explanation before preview, or resolve an explicitly requested label with the user. Never drop
an approved label during the write.

## Preview and create

Mint a stable `client_ref`; include `<!-- nuthouse-client-ref: <client_ref> -->` in the exact
proposed description. Show the complete title/body, team, project, nullable milestone, labels,
and any blocking relations together. A local preview file is useful for a long description;
do not add session machinery merely to hold a single draft.

Apply existing explicit authorization for this content and any delegated choices. Otherwise ask
for approval of this complete preview. Resolve requested edits before the write; a prior approval
of a different payload does not authorize a rewritten one.

Create the issue with exactly those fields through the selected provider. If a requested relation
is unsupported by that provider, resolve the available operation before creating; do not silently
drop the relation. On timeout or error, report the actual error and stop. Before retrying, reload
by the exact marker: one match is reused, multiple matches are ambiguous, and only confirmed
absence permits creation. A title match is not an idempotency key.

Read back the created issue and check title/body, project/milestone, labels, and requested
relations against the preview. Report discrepancies without overwriting them automatically.

Finish with the issue link, its scope, source Acceptance, verification status, and any unresolved
write outcome. Recommend `linear-devotee:greet <identifier>` when creation is verified; continue
there only if issue delivery was already requested. Creating this issue does not by itself
start implementation. Never commit, push, rebase, create labels implicitly, or write unrelated
Linear resources.
