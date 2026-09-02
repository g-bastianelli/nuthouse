---
name: greet
description: Use only at fresh session start when a Linear issue identifier is detected from the current branch or explicitly provided in the user's first prompt, and no Linear issue context is already available. Never use on resume or compaction, from an existing conversation summary, or on main/master/staging without an issue identifier. Delegates issue context to issue-context, resolves the source spec and project plan, writes greet context, then hands off to plan. Never writes implementation code.
argument-hint: "[issue-id] [--fresh]"
model: haiku
allowed-tools: Read, Glob, Agent, Bash(git branch --show-current), Bash(git rev-parse:*), Bash(cat:*)
---

# linear-devotee:greet

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid context gate. Match the user's language; keep technical identifiers unchanged.

> Silent gate: Run workflow step 1 before any user-visible output. If the gate closes, exit silently.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Session state: !`cat "${CLAUDE_PLUGIN_DATA}/state-${CLAUDE_SESSION_ID}.json" 2>/dev/null || echo "no state"`
- Branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`

## Workflow

1. Silent trigger gate and preconditions:
   - Accept a trigger only from `$ARGUMENTS`, the current branch on a fresh startup, or the user's current first prompt. Never extract a fresh trigger from a resumed/compacted conversation, an injected summary, prior turns, or an existing context brief.
   - Treat Linear context as already available when the session state says `greeted: true`, contains a non-empty `issue_context_brief`, or the conversation includes a summary/brief with the issue's goal and working context. Exit silently; do not dispatch voice, fetch Linear, print a report, or hand off.
   - On `main`, `master`, or `staging`, require an issue identifier in `$ARGUMENTS` or the user's current first prompt. The branch alone is never a trigger.
   - If none of the accepted fresh sources contains an issue identifier, exit silently.
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo (the `Branch` line in `## Context` shows `not a git repo` when outside one).
   - If `$ARGUMENTS` contains a Linear issue id (e.g. `ABC-123`), use it as `issue`.
   - Use the `Session state` JSON from `## Context`; extract `issue` (unless already set from `$ARGUMENTS`), `current_branch`, `needs_branch`. If it shows `no state`, treat the state file as absent and rely on `$ARGUMENTS`/the user prompt for the issue id.
   - Stop silently if `greeted: true` or no issue id.
   - Do not fetch full issue context in main context.
2. Delegate context:
   - Dispatch the logical `linear-devotee:issue-context` agent with:
     ```text
     ISSUE_ID: <id>
     PROJECT_ROOT: <git root>
     NEEDS_STATUS_METADATA: true
     ```
   - Present the returned SDD brief unchanged.
   - If issue does not exist, mark `greeted: true`, report `Brief: skipped`, and stop.
   - If the returned Linear status type is `completed` or `canceled`, mark `greeted: true`, report `Brief: skipped — issue already closed on Linear`, and stop.
   - Extract `linear_project_id` from the brief's required `Project ID` line for spec and plan traceability only. Do not read Maestro control; greet owns issue bootstrap regardless of how the workspace was launched.
3. Branch preparation when `needs_branch: true`:
   - In a Superset-managed project/worktree, never create a branch in place. Stop and route the user to `monkey-maestro:spawn`; a Maestro-spawned task workspace already has its provider branch and should normally arrive with `needs_branch: false`.
   - Build `<git-user>/<id-lowercase>-<kebab-title-trimmed-50char>`.
   - Ask before creating.
   - If dirty, ask stash or abort branch creation.
   - Optional `git pull --ff-only` only after asking.
   - Create or checkout existing branch.
   - Never push, commit, or rebase.
4. In Progress status:
   - Use `issue-context` status metadata.
   - If status type is not `started`, update Linear with the returned started `stateId`.
   - This flip is authorized by greet; no extra confirmation.
   - Greet is the sole owner of this transition. Monkey Maestro, Git Gremlin, and Moon Moth must never perform it.
5. Resolve the source spec:
   - Search `<PROJECT_ROOT>/docs/acid-prophet/specs/`.
   - Choose only unambiguous matches, in this priority order:
     1. An explicit repository-relative spec path named by the issue context or Linear
        issue, provided it resolves to an existing file inside the specs directory.
     2. A spec body containing the exact issue id.
     3. A spec whose `linear-project:` equals the issue project id.
     4. A body or filename matching the project slug/name.
   - Never let a project-id match override an explicit issue source.
   - Ask if multiple candidates; use `_none_` if none.
   - Never compare drift or patch specs here.
6. Resolve project plan authority:
   - Search `docs/acid-prophet/plans/**/plan.md` only for a plan whose frontmatter
     `spec:` is the exact repository-relative `spec_file`. Do not select a plan from a
     similar title, another issue plan, or acceptance-number overlap.
   - One exact match becomes `project_plan` and stays the architecture authority.
     Multiple exact matches are an architecture conflict and stop. When no exact match
     exists, record `_none_` instead of reconstructing a project plan from the source
     spec, prior issue plans, or conversation prose.
7. Write context:
   - Every artifact travels by absolute path. Require `spec_file` (when not `_none_`),
     `project_plan` (when not `_none_`), and every path in `RELEVANT_FILES` to exist and
     be readable at write time; a missing artifact blocks the write rather than producing
     a stale path.
   - Update state: `greeted: true`, `issue_context_brief`, `spec_file`, `project_plan`.
   - Write `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json`:
     ```json
     {
       "issue_id": "<ID>",
       "issue_title": "<title>",
       "linear_project_id": "<project id>",
       "issue_context_brief": "<markdown>",
       "spec_file": "<absolute path | _none_>",
       "project_plan": "<absolute path | _none_>",
       "relevant_files": ["<absolute path>"],
       "branch": "<current branch>",
       "status": "<status.name> (<status.type>)",
       "created_at": "<ISO 8601>"
     }
     ```
     Keep `spec_file` and `project_plan` path-valued; never replace a path with a prose
     summary.
   - Session store: if `$CLAUDE_SESSION_ID` is set, write to `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`:
     - Extract file paths from the `RELEVANT_FILES:` section of the `issue-context` brief (each line is an absolute path).
     - If `$ARGUMENTS` contains `--fresh`, skip reading any existing session data before writing.
     ```json
     {
       "spec_path": "<spec absolute path | empty string if _none_>",
       "project_plan": "<abs path | empty string if _none_>",
       "relevant_files": ["<abs path 1>"]
     }
     ```
     Deep-merge (do not replace the whole file if other keys exist). If `$CLAUDE_SESSION_ID` is absent or store write fails, continue silently.
8. Handoff:
   - Auto-chain to `plan` on the happy path. Print `linear-devotee:plan <ISSUE_ID>` and continue immediately — do not ask the user for confirmation. The user's only validation point is the plan's own `Validate this plan? (y / edit / stop)` gate.
   - On error paths after the silent gate (brief skipped, branch refused, status flip blocked), stop instead of chaining and report the reason. A closed silent gate returns before this step without a report.
   - Do not draft a plan or offer code.

## Final Report

```text
linear-devotee:greet report
  Issue:           <id> - <title>
  Status:          <current> (was <prior if changed>)
  Branch:          <current branch> (created: <new-branch> if applicable)
  Brief:           delivered (issue-context) | skipped (reason)
  Spec:            <path | _none_>
  Project plan:    <path | _none_>
  Context:         ${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json
  Hand-off:        plan | stop
```

**REQUIRED SUB-SKILL:** Use `linear-devotee:plan`

## Never

- Write implementation code.
- Draft or validate implementation plans; use `linear-devotee:plan`.
- Patch Acid Prophet specs.
- Re-greet a session.
- Mutate Linear except the authorized In Progress flip.
- Run `git push`, `git commit`, or `git rebase`.
