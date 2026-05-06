---
name: git-gremlin:commit
description: Use when staged changes are ready and you want to draft and execute a git commit — delegates diff reading and message writing to a subagent, keeping the diff off the main context.
effort: high
---

# git-gremlin:commit

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify staged files exist: `git diff --staged --name-only`. Abort with clear message if empty.
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
