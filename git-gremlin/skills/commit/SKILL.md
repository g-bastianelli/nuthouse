---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Handles staged changes first and may offer to stage dirty changes only after confirmation. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: high
---

# git-gremlin:commit

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Workflow

1. Preconditions:
   - Verify this is a git repository.
   - Verify staged files exist: `git diff --staged --name-only`.
   - If no staged files exist, check dirty files with `git status --short`.
   - If dirty files exist and the user explicitly asked to commit all/everything or stage changes, ask before running `git add -A`, then re-check staged files.
   - If staged files are still empty, abort with a clear message asking the user to stage files or say they want all changes staged.
2. Draft commit message:
   - Dispatch `git-gremlin:commit-drafter` with the staged diff as input.
   - Receive `{ message: string, files: string[] }`.
   - Display the proposed message to the user. Wait for confirmation.
3. Execute commit:
   - On confirmation: re-dispatch `git-gremlin:commit-drafter` with `action: execute`.
   - Receive `{ hash: string }`.
   - On rejection: offer to regenerate or cancel. Never commit silently.
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
- Commit without explicit user confirmation.
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
