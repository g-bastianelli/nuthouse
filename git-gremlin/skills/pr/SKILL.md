---
name: pr
description: Use automatically when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Drafts from branch history and, after confirmation, publishes the branch before creating the PR. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
effort: high
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git remote:*), Bash(git config:*), Bash(git push:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(gh pr create:*), Bash(cat:*), Bash(node:*), Read, Agent, mcp__claude_ai_Linear__get_issue
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# git-gremlin:pr

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Voice

Read `../../persona.md` at the start of this skill. That persona is
canonical for all output of this skill. Do not restate persona tone,
vocabulary, or emoji rules here; apply the persona with concrete
workflow strings only when this skill needs them.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Branch: !`git branch --show-current`
- Commits vs main: !`git log --oneline origin/main..HEAD 2>/dev/null | head -20`

## Workflow

1. Preconditions:
   - Resolve the workflow decision before applying any Git gate. When a named
     `WORKFLOW_DECISION` handoff exists, validate it through this plugin's install-local
     manifest consumer. When the handoff is missing, perform at most one authoritative
     local explicit-skill resolution from the current request, branch, Linear issue
     evidence, and repository configuration, persist the result, then validate its exact
     three-field handoff. An ambiguous, blocked, invalid, or policy-drifting resolution
     refuses publication; never treat absent session context as `direct-task`.
   - When the resolved workflow is `issue-delivery`, validate the exact manifest handoff
     and re-hash the named
     `VERIFICATION_EVIDENCE`, require `status: clean`, and require it to bind the same
     decision plus immutable issue artifacts and rebound mutable targets. Evidence from
     before a commit is stale: require evidence `head_oid` to equal the current HEAD and
     require fresh verification whenever it does not. Recompute the index-independent
     `worktree_snapshot_hash` and require an exact match before PR drafting. Require the
     verified changed-path set to be empty: PR evidence must describe the committed
     `HEAD`, not uncommitted working-tree content. Missing, failed, stale, dirty, or
     mismatched verification must refuse PR drafting and publication. An issue-delivery
     operation with missing verification evidence must refuse the PR even when it
     entered this skill directly.
   - Verify `gh` is available and authenticated: `gh auth status`. Abort with `gh auth login` instruction if not.
   - Infer base branch: `gh repo view --json defaultBranchRef` or fallback `main`.
   - Abort on a detached `HEAD`; branch publication requires a named current branch.
   - Abort when the current branch equals the base branch. A PR source must be a distinct named branch.
   - Capture the full commit OID with `git rev-parse HEAD`. This `HEAD_OID` binds the displayed proposal to the exact source content that may later be published.
   - Verify commits exist ahead of base: the `Commits vs main` snapshot in `## Context` covers the common case; re-run `git log <base>...HEAD --oneline` when the base is not `main` or the snapshot is empty. Abort if no commits exist ahead of base.
2. Draft PR title and description:
   - Read `git log <base>...HEAD --oneline` and `git diff <base>...HEAD` directly.
   - Detect Linear issue ids with `/\b[A-Z][A-Z0-9]+-[0-9]+\b/`, preferring the
     branch, then the log, then the diff. When one id is unambiguous, suffix the title
     with ` [<id>]`; when several ids remain ambiguous, add no suffix.
   - Draft an imperative title no longer than 72 characters, including any Linear
     suffix. Preserve the best existing conventional type or scope marker from the
     branch commits, such as `(fix)`, `chore:`, or `feat(scope):`.
   - Draft the body with `## Summary` and one to three bullets, then `## Test plan`
     with a checklist. Append `Closes <id>` on its own line when one unambiguous Linear
     id was detected. Do not invent changes or verification absent from the inputs.
   - Bind the proposal to the captured base, branch, and `HEAD_OID`.
   - Immediately before displaying the proposal, re-run `git branch --show-current` and `git rev-parse HEAD`. If either differs from the captured branch or `HEAD_OID`, discard the stale proposal and restart step 2 with fresh log and diff.
   - Display the proposed title, description, branch, base, and exact `HEAD_OID`, then wait for confirmation or an edit request. State that confirmation authorizes publishing only that commit to the same-named branch on the resolved Git remote, then creating the PR. A Maestro project control record is not PR approval.
3. Create PR:
   - On confirmation, re-read `VERIFICATION_EVIDENCE`,
     recompute `HEAD_OID` and `WORKTREE_SNAPSHOT_HASH` from the current source state,
     and require exact equality with both the evidence and approved proposal. Any change
     requires fresh verification and a newly confirmed proposal; do not push.
   - Before any mutation, verify that the current branch and `git rev-parse HEAD` still
     equal the approved values. If either changed, return to step 2 with fresh context
     and require a new confirmation.
   - Resolve only the push remote. Consider configured remotes other than `.` and prefer,
     in order: `branch.<BRANCH>.pushRemote`, `remote.pushDefault`,
     `branch.<BRANCH>.remote`, `origin`, then the sole configured remote. Ignore
     `branch.<BRANCH>.merge`; if no unique remote can be resolved, stop before mutation.
   - Publish the immutable approved commit with
     `git push "<REMOTE>" "<HEAD_OID>:refs/heads/<BRANCH>"`. Never substitute symbolic
     `HEAD`, publish to a differently named branch, or force-push. If push fails, surface
     stderr verbatim and do not retry or create the PR.
   - After a successful push, configure the same-named upstream with
     `git config "branch.<BRANCH>.remote" "<REMOTE>"` and
     `git config "branch.<BRANCH>.merge" "refs/heads/<BRANCH>"`.
   - Run `gh pr create --head "<BRANCH>" --title "<TITLE>" --body "<BODY>" --base "<BASE>"`,
     passing every value as a separately quoted argument without `eval`. If it fails,
     surface stderr verbatim and do not retry. On success, capture the PR URL from stdout.
   - On rejected confirmation, offer to regenerate or cancel. Never create a PR silently.
4. Report and hand off:
   - Return result.
   - In issue-delivery relay mode, report `Human feature acceptance: pending
(mandatory)` unless explicit human acceptance evidence already exists. This gate is
     distinct from PR approval and can never be inferred from checklist generation,
     passing checks, review approval, or an open PR.
   - Always report `Merge: manual`. Manual merge remains mandatory; neither this skill,
     GitHub review state, nor Maestro may merge the PR. PR creation also does not
     authorize Linear completion.
   - Stop after the report. If the issue belongs to an active Maestro project, mention only this optional next action: after Linear records the issue completed, the user or a known workflow may invoke `monkey-maestro:orchestrate <project-id>`. Never invoke it automatically and never treat the PR as Linear completion. Reserve `monkey-maestro:reconcile <project-id>` for an explicit Superset runtime-correlation audit or telemetry repair.

## Final Report

```text
git-gremlin:pr report
  PR:     <url>
  Title:  <pr title>
  Base:   <base branch>
  Branch: <branch> published via <remote>
  HEAD:   <approved HEAD_OID>
  Human feature acceptance: pending (mandatory) | accepted (explicit human evidence)
  Merge:  manual
  Project execution: optional monkey-maestro:orchestrate <project-id> after Linear completion | n/a
```

## Never

- Push during drafting or before the user confirms the displayed PR proposal.
- Push when the current branch or `HEAD` differs from the approved proposal.
- Push the base branch or publish `HEAD` to any remote ref other than `refs/heads/<BRANCH>`.
- Force-push or choose between multiple ambiguous remotes.
- Create a PR without explicit user confirmation.
- Skip the `gh auth status` check.
- Retry silently after `git push` or `gh pr create` failure — surface stderr verbatim and stop.
- Automatically invoke `monkey-maestro`, accept a feature, merge, or claim Linear
  completion from PR creation, review state, verification, or checklist evidence.
- Treat a PR as Linear completion; Linear lifecycle remains external and explicit.
- Reuse pre-commit or otherwise stale verification when `head_oid` or
  `worktree_snapshot_hash` no longer matches the source being published.
