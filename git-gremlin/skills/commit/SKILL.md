---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Commits an existing staged selection, or stages dirty changes automatically while preserving any explicit file scope. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: high
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git log:*), Bash(git branch --show-current), Bash(git rev-parse:*), Bash(cat:*), Read, Agent, mcp__claude_ai_Linear__get_issue
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
   - For draft-only intent, use only an existing staged diff. If nothing is staged, stop without mutating the tree and ask the user to stage a selection or request an actual commit.
2. Draft commit message:
   - Dispatch the logical `git-gremlin:commit-drafter` agent with the staged diff as input.
   - Receive `{ message: string, files: string[] }`.
   - If the user asked only to draft, suggest, write, or review a commit message, display the proposed message and stop.
   - Otherwise, treat the user's commit request as explicit approval for this staged commit and continue immediately.
3. Execute commit:
   - Re-dispatch the same agent with `action: execute`.
   - Receive `{ hash: string }`.
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

- Run `git push`, `git commit` directly from the skill (only via commit-drafter).
- Commit when the user only asked for a draft/message suggestion/review.
- Add unstaged changes to an existing staged selection unless the user explicitly asked to commit all/everything or stage all changes.
- Stage or commit a path outside an explicit file/directory scope.
- Treat an ambiguous narrow scope as authorization for `git add -A`.
- Stage anything for a draft-only request.
- Skip the staged files check.
- Retry silently after a pre-commit hook failure — surface stderr verbatim and stop.

## Subagent dispatch (Step 2)

This skill dispatches the logical `git-gremlin:commit-drafter` agent. Its canonical
definition is `git-gremlin/agents/commit-drafter.md`.

```
Agent({
  subagent_type: 'git-gremlin:commit-drafter',
  description: 'Read staged diff and propose a conventional commit message',
  prompt: `ACTION: draft
DIFF: <git diff --staged output>`,
})
```
