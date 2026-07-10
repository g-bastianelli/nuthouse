---
name: pr
description: Use automatically when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Delegates git log/diff reading and PR description writing to a subagent. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
effort: high
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(cat:*), Read, Agent, mcp__claude_ai_Linear__get_issue
---

# git-gremlin:pr

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.
> Autopilot scope: resolve the current branch's Linear issue and project. Take the **autopilot branch** below only when that project's `<git-common-dir>/nuthouse/relays/<project-id>/autopilot.json` is active, unexpired, and embeds the same project id; otherwise behave interactively. Never use another project's flag.

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
   - Verify `gh` is available and authenticated: `gh auth status`. Abort with `gh auth login` instruction if not.
   - Resolve the current issue id from the branch and project id from
     `docs/linear-devotee/plan/<ISSUE_ID>.md`'s `linear-project` field. If unavailable,
     fetch the issue from Linear. Read only the corresponding project flag before deciding
     whether autopilot may skip confirmation.
   - Infer base branch: `gh repo view --json defaultBranchRef` or fallback `main`.
   - Verify commits exist ahead of base: the `Commits vs main` snapshot in `## Context` covers the common case; re-run `git log <base>...HEAD --oneline` when the base is not `main` or the snapshot is empty. Abort if no commits exist ahead of base.
2. Draft PR title and description:
   - Dispatch `git-gremlin:pr-drafter` with branch + log + diff vs base as input.
   - Receive `{ title: string, body: string, base: string }`.
   - In autopilot: treat the drafted title/body as approved — print them for the record and proceed directly to step 3 without waiting. Otherwise: display the proposed title and description to the user and wait for confirmation or edit request.
3. Create PR:
   - On confirmation: re-dispatch `git-gremlin:pr-drafter` with `action: execute`.
   - Receive `{ url: string }`.
   - On rejection: offer to regenerate or cancel. Never create PR silently.
4. Report and hand off:
   - Return result.
   - In autopilot: auto-chain to `monkey-maestro:advance <ISSUE_ID>` — print that exact
     invocation and continue immediately so the maestro holds the per-feature acceptance
     gate. Otherwise: stop after the report.

## Final Report

```text
git-gremlin:pr report
  PR:    <url>
  Title: <pr title>
  Base:  <base branch>
```

## Never

- Run `gh pr create` directly from the skill (only via pr-drafter).
- Create a PR without explicit user confirmation (in autopilot, the armed relay flag is that standing confirmation).
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
BRANCH: <current branch>
LOG: <git log base...HEAD>
DIFF: <git diff base...HEAD>`,
})
```
