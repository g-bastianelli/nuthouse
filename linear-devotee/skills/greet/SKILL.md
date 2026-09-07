---
name: greet
description: Use only at fresh session start when an issue identifier comes from the current branch or first user prompt and no issue context is already available. Never retrigger from resume, compaction, or a conversation summary. Fetches a sourced brief, resolves spec/project-plan authority, and hands authorized delivery to plan. Never implements.
argument-hint: "[issue-id] [--fresh]"
model: haiku
allowed-tools: Read, Glob, Bash, Write, Agent, ToolSearch
---

# linear-devotee:greet

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Run the trigger gate before user-visible output. After it opens, resolve the plugin root from
this skill's directory (`../..`) and read `../../shared/planning-context.md` and
`../../shared/provider-selection.md`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Fresh-session trigger

Accept an issue only from explicit arguments, the current branch on fresh startup, or the user's
current first prompt. A resumed/compacted conversation, injected summary, or earlier turn is not
a fresh trigger. If an issue brief is already available, or session state says `greeted: true`,
exit silently without fetching, reporting, changing status, or chaining. On `main`, `master`, or
`staging`, require an explicit issue id.

Read the runtime's available session state and current branch; Claude Code may provide
`${CLAUDE_PLUGIN_DATA}/state-${CLAUDE_SESSION_ID}.json`. If that state or those variables are
absent, resolve the fresh id directly from the accepted sources. Absence of Claude-specific
state must not lose a valid branch trigger. Explicit current intent wins over cached ids.

## Gather context

Verify the repository and Linear access. Delegate the bounded fetch to `linear-devotee:issue-context`
with `ISSUE_ID`, `PROJECT_ROOT`, and `NEEDS_STATUS_METADATA: true` for delivery or `false` for
read-only context. Present
the sourced brief, preserving exact Acceptance and unresolved decisions.

A not-found issue, unavailable context, or `completed`/`canceled` status stops delivery with a
specific reason. A provider error must not be reported as a missing issue. If the user requested
only a read-only brief or review, finish with that context; do not start delivery as a side effect.

For delivery, resolve the spec and validated project plan with the shared artifact rules.
In particular, compare the plan's resolved relative `spec` path, not its raw frontmatter string.
Do not compare drift, rewrite sources, or draft implementation here.

## Prepare authorized delivery

Use an existing issue worktree/branch when it already matches. In a Superset-managed workspace,
never create a replacement branch in place; unresolved workspace setup belongs to
`monkey-maestro:spawn`. Outside Superset, prepare an issue branch when the delivery request
includes that work, preserving current changes. Never discard, reset, or stash user work to
make checkout succeed. Ask only when ownership or a conflicting branch needs a decision;
network updates are not a prerequisite for a brief.

Greet owns the documented In Progress transition for a delivery invocation. When status is not
already `started`, use a confirmed started state id from this issue's team. Do not guess among
multiple states, reopen a closed issue, or mutate status during read-only work. If the update is
ambiguous or fails, report it and resolve current status before proceeding.

## Retain useful context

Verify that selected source artifacts and `RELEVANT_FILES` exist and are readable. Proposed new
code paths remain in the brief, not the existing-file list. Retain the brief in the conversation
and, when plugin data storage is available, write `greet-<ISSUE_ID>.json` there:

```json
{
  "issue_id": "<ID>",
  "issue_title": "<title>",
  "linear_project_id": "<project id | _none_>",
  "issue_context_brief": "<markdown>",
  "spec_file": "<absolute path | _none_>",
  "project_plan": "<absolute path | _none_>",
  "relevant_files": ["<absolute existing path>"],
  "project_root": "<absolute repository root>",
  "branch": "<current branch>",
  "status": "<name> (<type>)",
  "created_at": "<actual ISO timestamp>"
}
```

Update existing runtime session state with `greeted: true` and the resolved context, preserving
unrelated fields. Keep this one cache; do not mirror it into another session store. A missing
cache is recoverable from the current brief and authoritative sources, not an excuse to restart
an interview after compaction.

## Handoff

For authorized issue delivery, show the issue/branch, status result, source paths, and any
remaining questions, then continue to planning without a second permission for the same work.
The plan workflow owns implementation decisions and its complete review. Stop on an unresolved
setup/status/source conflict with the specific reason.

**REQUIRED SUB-SKILL:** Use `linear-devotee:plan`.

Never implement, validate a plan, patch a spec, commit, push, or rebase here. No Linear mutation
other than the documented started transition for authorized issue delivery.
