---
name: next-issue
description: Use when a Linear issue is finished and the user wants the next issue, or asks which issue to take next in the project. Reads current statuses and blockers, distinguishes active work from available work, and recommends a startable issue without changing Linear.
argument-hint: "[issue-id]"
model: haiku
effort: medium
allowed-tools: Read, Glob, Bash, Agent, ToolSearch
---

# linear-devotee:next-issue

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Read-only next-work selection. Resolve the plugin root from this skill's directory (`../..`)
and read `../../shared/provider-selection.md`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Establish current work

Use the explicit issue/project or current conversation first, then the current branch and a
matching greet cache. Do not select the most recent cache from an unrelated project. Ask for the
issue or project only when it remains ambiguous.

If the user says the current issue is done, treat it as completed for this recommendation and
state that assumption when it affects the result. Do not update its Linear status. Fetch its
project context, then all candidate issues with status types, milestone/order, assignee, and
blocking relations. Paginate or scope further as needed; unknown blockers are not an empty list.
Resolve blocker statuses even when they belong to another project.

Use a bounded read-only scout for a large project fetch when it keeps the main context useful;
selection still belongs to this skill. No extra agent is needed for a small complete result.

## Choose from evidence

- Exclude the current issue and `completed`/`canceled` work. Show already `started` work separately
  rather than recommending a duplicate start; resuming it needs the user's requested ownership.
- A new candidate is startable when all its blockers are completed/canceled, including the
  current issue only under the user's explicit done assumption. An unresolved relation or
  unknown blocker state leaves readiness unknown until checked.
- Prefer the current milestone, then explicit milestone order, issue order, issue number in the
  same team, and creation time. Respect a user-supplied priority or ownership constraint first.
  An issue assigned elsewhere should be identified as such, not silently treated as free work.
- If several candidates remain equivalent, show up to three with a recommendation and reason.
  If none is startable, name the closest blocked work and what must finish or be clarified.
  If no open issues remain, say so without inventing a next step.

## Report

Give the current issue/project, any done assumption, and the next issue's title/link plus the
actual reason it is startable. Name unknowns that limit the recommendation. Include
`Start with: linear-devotee:greet <identifier>` only for an eligible candidate. This recommendation
is not authorization to change status, assignment, blockers, or start another workspace.

If the user's request also explicitly includes starting the selected work, hand it to the
appropriate delivery workflow with that existing authority; do not add another confirmation for
an already authorized step. Otherwise finish with the recommendation. Never mutate Linear,
commit, push, or rebase within this skill.
