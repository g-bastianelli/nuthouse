---
name: greet
description: Use immediately at session start when a Linear issue identifier is detected from branch or first prompt. Delegates issue context to issue-context, optionally prepares branch/status, resolves source spec, writes greet context, then hands off to plan. Never writes implementation code.
argument-hint: "[issue-id] [--fresh]"
model: haiku
allowed-tools: Read, Glob, Agent, Bash(git branch --show-current), Bash(git rev-parse:*), Bash(cat:*)
---

# linear-devotee:greet

Rigid context gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.
> Autopilot scope: resolve the issue's Linear project first. Only the matching `<git-common-dir>/nuthouse/relays/<project-id>/autopilot.json` can enable relay behavior; never treat another project's flag in this repo as authority.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Session state: !`cat "${CLAUDE_PLUGIN_DATA}/state-${CLAUDE_SESSION_ID}.json" 2>/dev/null || echo "no state"`
- Branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo (the `Branch` line in `## Context` shows `not a git repo` when outside one).
   - If `$ARGUMENTS` contains a Linear issue id (e.g. `ABC-123`), use it as `issue`.
   - Use the `Session state` JSON from `## Context`; extract `issue` (unless already set from `$ARGUMENTS`), `current_branch`, `needs_branch`. If it shows `no state`, treat the state file as absent and rely on `$ARGUMENTS`/the user prompt for the issue id.
   - Stop if `greeted: true` or no issue id.
   - Autopilot guard: after Linear resolves the issue project, read only the matching
     project flag. Do **not** read any `relay-<relay_id>.json` file. The relay has no
     local issue queue; Linear is the authority. Continue unless the session state already
     says `greeted: true` or Linear later reports the issue is completed/canceled.
   - Do not fetch full issue context in main context.
2. Delegate context:
   - Dispatch `linear-devotee:issue-context` with:
     ```text
     ISSUE_ID: <id>
     PROJECT_ROOT: <git root>
     NEEDS_STATUS_METADATA: true
     ```
   - Present the returned SDD brief unchanged.
   - If issue does not exist, mark `greeted: true`, report `Brief: skipped`, and stop.
   - If the returned Linear status type is `completed` or `canceled`, mark `greeted: true`, report `Brief: skipped — issue already closed on Linear`, and stop. Do not let stale local relay files override Linear.
   - Extract `linear_project_id` from the brief's required `Project ID` line. Derive the
     project flag under `<git-common-dir>/nuthouse/relays/<linear_project_id>/autopilot.json`.
     It is the only relay flag this issue may read.
3. Branch preparation when `needs_branch: true`:
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
5. Resolve Acid Prophet spec:
   - Search `<PROJECT_ROOT>/docs/acid-prophet/specs/`.
   - Choose only unambiguous matches, priority:
     1. `linear-project:` equals issue project id.
     2. Spec body contains exact issue id.
     3. Body or filename matches project slug/name.
   - Ask if multiple candidates; use `_none_` if none.
   - Never compare drift or patch specs here.
6. Write context:
   - Update state: `greeted: true`, `issue_context_brief`, `spec_file`.
   - Write `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json`:
     ```json
     {
       "issue_id": "<ID>",
       "issue_title": "<title>",
       "linear_project_id": "<project id>",
       "issue_context_brief": "<markdown>",
       "spec_file": "<path | _none_>",
       "branch": "<current branch>",
       "status": "<status.name> (<status.type>)",
       "created_at": "<ISO 8601>"
     }
     ```
   - Session store: if `$CLAUDE_SESSION_ID` is set, write to `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`:
     - Extract file paths from the `RELEVANT_FILES:` section of the `issue-context` brief (each line is an absolute path).
     - If `$ARGUMENTS` contains `--fresh`, skip reading any existing session data before writing.
     ```json
     {
       "spec_path": "<spec absolute path | empty string if _none_>",
       "relevant_files": ["<abs path 1>", "..."]
     }
     ```
     Deep-merge (do not replace the whole file if other keys exist). If `$CLAUDE_SESSION_ID` is absent or store write fails, continue silently.
7. Handoff:
   - Auto-chain to `plan` on the happy path. Print `linear-devotee:plan <ISSUE_ID>` and continue immediately — do not ask the user for confirmation. The user's only validation point is the plan's own `Validate this plan? (y / edit / stop)` gate.
   - On error paths (no issue id, brief skipped, branch refused, status flip blocked), stop instead of chaining and report the reason.
   - Do not draft a plan or offer code.

## Final Report

```text
linear-devotee:greet report
  Issue:           <id> - <title>
  Status:          <current> (was <prior if changed>)
  Branch:          <current branch> (created: <new-branch> if applicable)
  Brief:           delivered (issue-context) | skipped (reason)
  Spec:            <path | _none_>
  Context:         ${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json
  Hand-off:        plan | stop
```

## Never

- Write implementation code.
- Draft or validate implementation plans; use `linear-devotee:plan`.
- Patch Acid Prophet specs.
- Re-greet a session.
- Mutate Linear except the authorized In Progress flip.
- Run `git push`, `git commit`, or `git rebase`.
