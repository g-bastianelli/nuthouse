---
name: pr
description: Use automatically when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Drafts from branch history and, after confirmation, publishes the branch before creating the PR. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
effort: high
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(cat:*), Read, Agent, mcp__claude_ai_Linear__get_issue
---

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
   - Verify `gh` is available and authenticated: `gh auth status`. Abort with `gh auth login` instruction if not.
   - Infer base branch: `gh repo view --json defaultBranchRef` or fallback `main`.
   - Abort on a detached `HEAD`; branch publication requires a named current branch.
   - Abort when the current branch equals the base branch. A PR source must be a distinct named branch.
   - Capture the full commit OID with `git rev-parse HEAD`. This `HEAD_OID` binds the displayed proposal to the exact source content that may later be published.
   - Verify commits exist ahead of base: the `Commits vs main` snapshot in `## Context` covers the common case; re-run `git log <base>...HEAD --oneline` when the base is not `main` or the snapshot is empty. Abort if no commits exist ahead of base.
2. Draft PR title and description:
   - Dispatch the logical `git-gremlin:pr-drafter` agent with branch + `HEAD_OID` + log + diff vs base as input.
   - Receive `{ title: string, body: string, base: string, headOid: string }`; require `base` and `headOid` to equal the captured values.
   - Immediately before displaying the proposal, re-run `git branch --show-current` and `git rev-parse HEAD`. If either differs from the captured branch or `HEAD_OID`, discard the stale proposal and restart step 2 with fresh log and diff.
   - Display the proposed title, description, branch, base, and exact `HEAD_OID`, then wait for confirmation or an edit request. State that confirmation authorizes publishing only that commit to the same-named branch on the resolved Git remote, then creating the PR. A Maestro project control record is not PR approval.
3. Create PR:
   - On confirmation: re-dispatch the same agent with `action: execute`, including the approved base, branch, `HEAD_OID`, title, and body.
   - Before any mutation, the agent must verify that the current branch and `git rev-parse HEAD` still equal the approved values. If either changed, return to step 2 with fresh context and require a new confirmation.
   - The agent must publish the approved commit to `refs/heads/<BRANCH>` before `gh pr create`; this is part of the confirmed mutation, not a separate prompt.
   - Receive `{ url: string, branch: string, headOid: string, remote: string }`.
   - On rejection: offer to regenerate or cancel. Never create PR silently.
4. Report and hand off:
   - Return result.
   - Stop after the report. If the issue belongs to an active Maestro project, mention only this optional next action: after Linear records the issue completed, the user or a known workflow may invoke `monkey-maestro:orchestrate <project-id>`. Never invoke it automatically and never treat the PR as Linear completion. Reserve `monkey-maestro:reconcile <project-id>` for an explicit Superset runtime-correlation audit or telemetry repair.

## Final Report

```text
git-gremlin:pr report
  PR:     <url>
  Title:  <pr title>
  Base:   <base branch>
  Branch: <branch> published via <remote>
  HEAD:   <approved HEAD_OID>
  Project execution: optional monkey-maestro:orchestrate <project-id> after Linear completion | n/a
```

## Never

- Run `gh pr create` directly from the skill (only via pr-drafter).
- Push during drafting or before the user confirms the displayed PR proposal.
- Push when the current branch or `HEAD` differs from the approved proposal.
- Push the base branch or publish `HEAD` to any remote ref other than `refs/heads/<BRANCH>`.
- Force-push or choose between multiple ambiguous remotes.
- Create a PR without explicit user confirmation.
- Skip the `gh auth status` check.
- Retry silently after `git push` or `gh pr create` failure — surface stderr verbatim and stop.

## Subagent dispatch (Steps 2-3)

This skill dispatches the logical `git-gremlin:pr-drafter` agent. Its canonical definition
is `git-gremlin/agents/pr-drafter.md`.

```
Agent({
  subagent_type: 'git-gremlin:pr-drafter',
  description: 'Read git log and diff vs base, propose PR title and description',
  prompt: `ACTION: draft
BASE: <base branch>
BRANCH: <current branch>
HEAD_OID: <git rev-parse HEAD>
LOG: <git log base...HEAD>
DIFF: <git diff base...HEAD>`,
})
```

After confirmation, re-dispatch with the complete approved mutation:

```
Agent({
  subagent_type: 'git-gremlin:pr-drafter',
  description: 'Publish the branch and create the approved PR',
  prompt: `ACTION: execute
BASE: <approved base branch>
BRANCH: <approved current branch>
HEAD_OID: <approved git commit OID>
TITLE: <approved PR title>
BODY: <approved PR body>`,
})
```
