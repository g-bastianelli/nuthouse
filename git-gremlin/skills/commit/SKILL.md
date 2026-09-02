---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Commits an existing staged selection, or stages dirty changes automatically while preserving any explicit file scope. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: high
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git branch --show-current), Bash(git rev-parse:*), Bash(cat:*), Bash(node:*), Read, Agent, mcp__claude_ai_Linear__get_issue
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# git-gremlin:commit

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Commit intent is the approval gate. Match the user's language; keep technical identifiers unchanged.

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

- Staged: !`git diff --cached --stat | tail -20`
- Working tree: !`git status --short | head -20`

## Workflow

1. Preconditions:
   - Verify this is a git repository.
   - Resolve the workflow decision before applying any Git gate. When a named
     `WORKFLOW_DECISION` handoff exists, validate it through this plugin's install-local
     manifest consumer. When the handoff is missing, perform at most one authoritative
     local explicit-skill resolution from the current request, branch, Linear issue
     evidence, and repository configuration, persist the result, then validate its exact
     three-field handoff. An ambiguous, blocked, invalid, or policy-drifting resolution
     refuses the mutation; never treat absent session context as `direct-task`.
   - When the resolved workflow is `issue-delivery`, validate its exact `run_id`,
     manifest path, `content_hash`, workflow, effective profile, scope, and policy.
     Require the named
     `VERIFICATION_EVIDENCE`, re-hash its bytes, and require `status: clean` bound to the
     same workflow decision, immutable issue artifacts, and rebound mutable targets.
     Recompute its index-independent `WORKTREE_SNAPSHOT_HASH` from the current
     `HEAD_OID`, changed path set, file modes, and content hashes **before staging**.
     Require both values to equal the evidence. Missing, stale, mismatched, or failed
     evidence must refuse staging and commit; never substitute the user's commit request
     for verification. An issue-delivery operation with missing verification evidence
     must refuse the commit even when it entered this skill directly.
   - Resolve whether the user requested an actual commit or only a draft, suggestion, or review of a commit message. Draft-only intent never authorizes staging or committing.
   - Resolve the requested mutation scope before staging:
     - **Full tree:** the user explicitly said all/everything and did not also name a narrower file or directory scope.
     - **Explicit path scope:** the user unambiguously named one or more repository pathspecs, such as `README.md` or `src/`.
     - **Default:** the user requested a commit without expressing a narrower scope.
     - If the request appears narrower but cannot be converted to unambiguous pathspecs, stop and ask for the intended paths. Never fall back to the full tree.
   - Gate on the `Staged` snapshot from `## Context`: it shows what is staged right now. Re-run `git diff --staged --name-only` only if the snapshot is empty or the tree may have changed since skill load.
   - For an actual commit:
     - For **full tree** scope, run `git add -A` even when a partial staged selection already exists.
     - For **explicit path scope** with an existing staged selection, compute two path sets: `ALL_STAGED` from the unfiltered `git diff --staged --name-only`, and `IN_SCOPE_STAGED` from `git diff --staged --name-only -- <pathspec...>`. Require the sets to be exactly equal. If they differ, at least one staged path is outside the requested scope: stop without mutating the index and ask whether to include the staged selection or adjust it. Otherwise preserve the staged selection without widening it.
     - For **explicit path scope** with an empty index and a dirty working tree, run `git add -- <pathspec...>`. Pass each pathspec as a separately quoted argument after `--`; never use `eval` or shell-expanded globs.
     - For **default** scope, preserve any existing staged selection. If nothing is staged and the working tree is dirty, commit intent authorizes `git add -A`; run it automatically.
     - Re-check with `git diff --staged --name-only` after staging. If it is still empty, abort with a clear no-changes message.
     - Require every staged path/deletion to appear in the evidence `verified_files`.
       Read each index entry without changing it and compare its staged content, mode,
       and type with the verification evidence's `verified_content_hash`, mode, type, or
       deletion marker. Canonically map Git modes `100644`/`100755` to regular-file
       modes `0644`/`0755` and `120000` to a symlink; block unsupported index types.
       Any content, mode, or type mismatch blocks the commit, including an index-only
       executable-bit change made after verification.
   - For draft-only intent, use only an existing staged diff. If nothing is staged, stop without mutating the tree and ask the user to stage a selection or request an actual commit.
2. Draft commit message:
   - Read `git diff --staged` and `git diff --staged --name-only` directly.
   - Identify the change type from `feat`, `fix`, `chore`, `refactor`, `docs`,
     `test`, `style`, or `perf`, plus the narrowest useful module or component scope.
   - Draft `<type>(<scope>): <imperative description>` with a first line no longer
     than 72 characters. Omit the scope only when no meaningful scope exists. Do not
     invent changes that are absent from the staged diff.
   - Keep the exact proposed message and staged file list for the final report.
   - If the user asked only to draft, suggest, write, or review a commit message, display the proposed message and stop.
   - Otherwise, treat the user's commit request as explicit approval for this staged commit and continue immediately.
3. Execute commit:
   - Recompute `HEAD_OID` and `WORKTREE_SNAPSHOT_HASH` immediately before commit. If
     either differs from verification evidence, do not commit; require fresh
     `moon-moth:verify` evidence. Staging-only index changes do not alter the canonical
     snapshot, but any byte, path, mode, untracked-file, deletion, or commit change does.
   - Immediately repeat the complete staged path/content/mode/type comparison against
     `verified_files`; an index change made during message drafting invalidates the
     proposal and blocks execution.
   - Run `git commit -m "<MESSAGE>"` directly, passing the approved message as one
     quoted argument without `eval` or command interpolation.
   - If the command fails, surface stderr verbatim and stop without retrying.
   - On success, read the committed hash with `git rev-parse --short HEAD`.
4. Report:
   - Return result.

## Final Report

```text
git-gremlin:commit report
  Hash:     <commit hash>
  Message:  <commit message>
  Files:    <n files committed>
```

## Never

- Run `git push`, `git rebase`, or a force-push.
- Commit when the user only asked for a draft/message suggestion/review.
- Add unstaged changes to an existing staged selection unless the user explicitly asked to commit all/everything or stage all changes.
- Stage or commit a path outside an explicit file/directory scope.
- Treat an ambiguous narrow scope as authorization for `git add -A`.
- Stage anything for a draft-only request.
- Skip the staged files check.
- Retry silently after a pre-commit hook failure — surface stderr verbatim and stop.
- Treat `WORKFLOW_DECISION` as verification evidence or continue an issue-delivery
  commit when `VERIFICATION_EVIDENCE` is missing.
- Reuse verification after `HEAD_OID` or `WORKTREE_SNAPSHOT_HASH` changes.
