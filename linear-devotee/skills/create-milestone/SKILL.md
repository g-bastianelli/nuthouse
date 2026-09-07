---
name: create-milestone
description: Use to add one milestone to an existing Linear project. Defines a meaningful delivery boundary and exit evidence, reuses supplied context, and creates the complete authorized milestone. Use create-project for cascade creation or recovery.
effort: high
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent, ToolSearch
---

# linear-devotee:create-milestone

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Find the plugin root from this skill's directory (`../..`) outside Claude Code. Read
`../../shared/provider-selection.md` and `../../shared/planning-context.md`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Draft the delivery boundary

Resolve the project and milestone intent from the request or current project context. Reuse an
explicit selection; list projects and ask only when the destination is ambiguous. Obtain the
selected project's scope, existing milestones, and related issues. A partial cascade belongs to
its own recovery workflow, not this standalone operation.

**REQUIRED SUB-SKILL:** Use `linear-devotee:create-project` for cascade recovery.

Dispatch `linear-devotee:milestone-drafter` with `PROJECT_ID`, `MILESTONE_HINT`, `PROJECT_ROOT`,
current raw `LINEAR_CONTEXT`, and any explicit parent draft. Review the proposed boundary, exit
evidence, existing issue contributions, suggested new issues, and true overlaps.

Clarify decisions that change delivery scope or its completion conditions. Recommend reuse if
an existing milestone already expresses the same outcome. A target date is optional; do not
invent one from the project deadline, or ask for one merely to fill a slot. Proposed issue titles
are planning context and are not approved issue creations or membership changes.

## Approve the complete milestone

Prepare the exact name, project id, description, and nullable target date. Mint one stable
`client_ref` and include `<!-- nuthouse-client-ref: <client_ref> -->` in the description before
showing the full preview, including scope and exit evidence.

Use explicit authorization already given for this milestone and its delegated choices. If that
authority is missing, ask for approval of this complete result. Apply edits before creation;
never shift a date, project, or scope after the approved preview without resolving the change.

## Create and verify

Call the available milestone creation operation with exactly the previewed fields. On an error
or ambiguous timeout, report the provider's actual response and stop. A retry first reloads the
exact marker in the selected project; reuse one match, stop on multiple matches, and create only
after confirmed absence. Do not fall back to a name match or silently adjust rejected fields.

Read back the milestone and compare its name, description, project, and date with the preview.
Report a discrepancy without automatically rewriting it. Finish with the milestone link,
verification result, and the proposed existing/new issue work. Continue to issue creation only
when the user has requested that next step; otherwise leave it as a recommendation.

**REQUIRED SUB-SKILL:** Use `linear-devotee:create-issue` for an authorized standalone issue.

Do not attach existing issues, create suggested issues, or alter project scope as an implicit
side effect of creating the milestone. Never commit, push, rebase, or blindly retry a write.
