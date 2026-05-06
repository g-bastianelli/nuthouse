---
name: git-gremlin:pr
description: Use when a branch is ready for review and you want to create a GitHub PR — delegates diff reading and description writing to a subagent, keeping the diff off the main context.
effort: high
---

# git-gremlin:pr

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify `gh` is available and authenticated: `gh auth status`. Abort with `gh auth login` instruction if not.
   - Infer base branch: `gh repo view --json defaultBranchRef` or fallback `main`.
   - Verify commits exist ahead of base: `git log <base>...HEAD --oneline`. Abort if empty.
2. Draft PR title and description:
   - Dispatch `git-gremlin:pr-drafter` with log + diff vs base as input.
   - Receive `{ title: string, body: string, base: string }`.
   - Display the proposed title and description to the user. Wait for confirmation or edit request.
3. Create PR:
   - On confirmation: re-dispatch `git-gremlin:pr-drafter` with `action: execute`.
   - Receive `{ url: string }`.
   - On rejection: offer to regenerate or cancel. Never create PR silently.
4. Report:
   - Return result.

## Final Report

```text
git-gremlin:pr report
  PR:    <url>
  Title: <pr title>
  Base:  <base branch>
```

## Never

- Run `gh pr create` directly from the skill (only via pr-drafter).
- Create a PR without explicit user confirmation.
- Skip the `gh auth status` check.
- Retry silently after `gh pr create` failure — surface stderr verbatim and stop.

## Subagent dispatch (Step 2)

This skill dispatches the `git-gremlin:pr-drafter` subagent. Run `/scaffold-agent` to scaffold it.

```
Agent({
  subagent_type: 'git-gremlin:pr-drafter',
  description: 'Read git log and diff vs base, propose PR title and description',
  prompt: `ACTION: draft
BASE: <base branch>
LOG: <git log base...HEAD>
DIFF: <git diff base...HEAD>`,
})
```
