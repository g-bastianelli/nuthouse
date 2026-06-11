---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Handles staged changes first and stages dirty changes only when the user explicitly asks to commit all/everything or stage changes. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: high
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Agent
---

# git-gremlin:commit

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
   - Gate on the `Staged` snapshot from `## Context`: it shows what is staged right now. Re-run `git diff --staged --name-only` only if the snapshot is empty or the tree may have changed since skill load.
   - If nothing is staged, check the `Working tree` snapshot for dirty files.
   - If dirty files exist and the user explicitly asked to commit all/everything or stage changes, run `git add -A`, then re-check staged files.
   - If staged files are still empty, abort with a clear message asking the user to stage files or say they want all changes staged.
2. Draft commit message:
   - Dispatch `git-gremlin:commit-drafter` with the staged diff as input.
   - Receive `{ message: string, files: string[] }`.
   - If the user asked only to draft, suggest, write, or review a commit message, display the proposed message and stop.
   - Otherwise, treat the user's commit request as explicit approval for this staged commit and continue immediately.
3. Execute commit:
   - Re-dispatch `git-gremlin:commit-drafter` with `action: execute`.
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
- Stage dirty files unless the user explicitly asked to commit all/everything or stage changes.
- Skip the staged files check.
- Retry silently after a pre-commit hook failure — surface stderr verbatim and stop.

## Subagent dispatch (Step 2)

This skill dispatches the `git-gremlin:commit-drafter` subagent. Run `/scaffold-agent` to scaffold it.

```
Agent({
  subagent_type: 'git-gremlin:commit-drafter',
  description: 'Read staged diff and propose a conventional commit message',
  prompt: `ACTION: draft
DIFF: <git diff --staged output>`,
})
```
