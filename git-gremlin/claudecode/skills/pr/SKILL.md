---
name: git-gremlin:pr
description: Use automatically when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Delegates git log/diff reading and PR description writing to a subagent. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
effort: high
---

# git-gremlin:pr

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

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
