---
name: greet
description: Use only at fresh session start when a Linear issue identifier is detected from the current branch or explicitly provided in the user's first prompt, and no Linear issue context is already available. Never use on resume or compaction, from an existing conversation summary, or on main/master/staging without an issue identifier. Delegates issue context to issue-context, binds the workflow decision and source authorities, writes greet context, then hands off to plan. Never writes implementation code.
argument-hint: "[issue-id] [--fresh]"
model: haiku
allowed-tools: Read, Glob, Agent, Bash(git branch --show-current), Bash(git rev-parse:*), Bash(cat:*), Bash(node:*)
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# linear-devotee:greet

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid context gate. Match the user's language; keep technical identifiers unchanged.

> Silent gate: Run workflow step 1 before any voice dispatch or user-visible output. If the gate closes, exit silently.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

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
5. Resolve workflow decision:
   - Capture a child-local `WORKFLOW_DECISION` handoff only when it contains exact
     `run_id`, absolute manifest `path`, and `content_hash` fields. Validate it through
     this plugin's install-local `lib/workflow/index.mjs` manifest consumer before using
     it. A valid child-local decision is authoritative and must not be reclassified.
   - Separately consume relay ancestry only when the prompt contains all three closed
     baton fields `WORKFLOW_RUN_ID`, `WORKFLOW_PROFILE`, and
     `WORKFLOW_DECISION_HASH`; require all three or none. Validate a safe run identifier,
     a known profile, and canonical `sha256:` hash, then retain them unchanged as
     `parent_workflow_baton`. A partial or malformed baton stops greet. The parent
     manifest is out-of-scope in the child worktree, so never synthesize its path or
     treat the baton as a child-local manifest handoff.
   - When no valid child-local handoff exists, resolve once through the install-local
     Codex or Claude explicit-skill adapter using the issue id, current branch, read-only
     Linear team metadata, project-owned configuration, normalized authoritative risk
     evidence, and the baton profile as the minimum requested profile when present.
     Persist the successful child decision before continuing.
   - Require `workflow: issue-delivery`, a non-blocked decision, and all immutable gates.
     Capture the exact closed manifest handoff as `workflow_decision` and capture the
     manifest's effective profile separately as `effective_profile`. Never add the
     profile or any other field to the three-field handoff accepted by
     `consumeManifestHandoff`. A
     missing, expired, out-of-scope, policy-drifting, or mismatched decision stops greet;
     never guess the profile or accept prompt-only relay metadata as local authority.
     When `parent_workflow_baton` exists, require the child workflow to remain
     `issue-delivery` and its effective profile to be not lower than `WORKFLOW_PROFILE`;
     preserve the parent run id and decision hash for traceability even though the child
     persists a new local run and decision hash.
   - Do not require Warden. It is an optional control surface and voice provider, never
     the resolver or a precondition for this step.
6. Resolve Acid Prophet spec:
   - Search `<PROJECT_ROOT>/docs/acid-prophet/specs/`.
   - Choose only unambiguous matches, priority:
     1. `linear-project:` equals issue project id.
     2. Spec body contains exact issue id.
     3. Body or filename matches project slug/name.
   - Ask if multiple candidates; use `_none_` if none.
   - Never compare drift or patch specs here.
7. Resolve project plan authority:
   - Search `docs/acid-prophet/plans/**/plan.md` only for a plan whose frontmatter
     `spec:` is the exact repository-relative `spec_file`. Do not select a plan from a
     similar title, another issue plan, or acceptance-number overlap.
   - One exact match becomes `project_plan`; compute its `sha256:` content hash and keep
     it as architecture authority. Multiple exact matches are an architecture conflict
     and stop. When no exact match exists, record `_none_` instead of reconstructing a
     project plan from the source spec, prior issue plans, or conversation prose.
8. Write context:
   - Compute canonical `sha256:` content hashes for the source spec, project plan when
     present, and every path in `RELEVANT_FILES`. A file that changed or disappeared
     after context loading stops the write rather than producing stale authority.
   - Update state: `greeted: true`, `issue_context_brief`, `spec_file`, `project_plan`,
     `workflow_decision`, and `parent_workflow_baton` when relay ancestry exists.
   - Write `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json`:
     ```json
     {
       "issue_id": "<ID>",
       "issue_title": "<title>",
       "linear_project_id": "<project id>",
       "issue_context_brief": "<markdown>",
       "spec_file": "<path | _none_>",
       "project_plan": { "path": "<absolute path>", "content_hash": "sha256:<hex>" },
       "workflow_decision": {
         "run_id": "<run id>",
         "path": "<absolute manifest path>",
         "content_hash": "sha256:<hex>"
       },
       "effective_profile": "<quick | standard | strict>",
       "parent_workflow_baton": {
         "workflow_run_id": "<parent run id>",
         "workflow_profile": "<parent effective profile>",
         "workflow_decision_hash": "sha256:<hex>"
       },
       "relevant_files": [{ "path": "<absolute path>", "content_hash": "sha256:<hex>" }],
       "branch": "<current branch>",
       "status": "<status.name> (<status.type>)",
       "created_at": "<ISO 8601>"
     }
     ```
     Use `"project_plan": "_none_"` when no exact project plan exists and
     `"parent_workflow_baton": "_none_"` outside relay mode. Keep
     `spec_file` as the path-valued compatibility field and store its hash beside the
     named handoff data; do not replace paths with prose summaries.
   - Session store: if `$CLAUDE_SESSION_ID` is set, write to `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`:
     - Extract file paths from the `RELEVANT_FILES:` section of the `issue-context` brief (each line is an absolute path).
     - If `$ARGUMENTS` contains `--fresh`, skip reading any existing session data before writing.
     ```json
     {
       "spec_path": "<spec absolute path | empty string if _none_>",
       "project_plan": "<abs path | empty string if _none_>",
       "workflow_decision": {
         "run_id": "<id>",
         "path": "<abs path>",
         "content_hash": "sha256:<hex>"
       },
       "effective_profile": "<profile>",
       "relevant_files": ["<abs path 1>"]
     }
     ```
     Deep-merge (do not replace the whole file if other keys exist). If `$CLAUDE_SESSION_ID` is absent or store write fails, continue silently.
9. Handoff:
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
  Workflow:        <run id> · <effective profile> · <content hash>
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
