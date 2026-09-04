---
name: pr
description: Use automatically when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Drafts from branch history and, after confirmation, publishes the branch before creating the PR. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
effort: medium
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git remote:*), Bash(git config:*), Bash(git push:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(gh pr create:*), Read
---

# git-gremlin:pr

Draft, publish, create. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the line below still shows a raw,
> unexpanded dynamic-context command, run it manually before step 1.

- Branch: !`git branch --show-current`

## Workflow

1. Check the minimum preconditions.
   - Verify `gh` is available and authenticated with `gh auth status`.
   - Infer the base branch with `gh repo view --json defaultBranchRef`, falling back to
     `main`.
   - Stop on a detached `HEAD`, when the current branch is the base branch, or when no
     commits exist ahead of the base.
   - Capture the current branch and `HEAD_OID = git rev-parse HEAD`.
2. Read `git log <base>...HEAD --oneline` and `git diff <base>...HEAD`. Draft an
   imperative title no longer than 72 characters, preserving a useful conventional type or
   scope from the commits. Draft a body with `## Summary` and one to three bullets, then
   `## Test plan` with a checklist. Do not invent changes or verification absent from the
   inputs.
3. If the user asked only for PR text, display it and stop. Otherwise display the title,
   body, and `<branch> → <base>`, then wait for confirmation or edits. This is the only
   extra approval gate.
4. After confirmation, verify that the branch and `HEAD_OID` still match the proposal. If they
   changed, regenerate it and ask again.
5. Resolve the push remote in this order: `branch.<BRANCH>.pushRemote`,
   `remote.pushDefault`, `branch.<BRANCH>.remote`, `origin`, then the sole configured remote.
   Stop if the result is local (`.`), missing, or ambiguous.
6. Run `git push "<REMOTE>" "<HEAD_OID>:refs/heads/<BRANCH>"`. Never substitute a mutable
   branch ref or force-push. If it fails, surface stderr verbatim and do not retry or create
   the PR.
7. Run
   `gh pr create --head "<BRANCH>" --title "<TITLE>" --body "<BODY>" --base "<BASE>"`,
   passing every value as a separately quoted argument without `eval`. If it fails,
   surface stderr verbatim and do not retry. On success, capture the PR URL from stdout.

Hooks and CI own verification. This skill does not run checks, merge the PR, update issue or
project state, orchestrate follow-up work, or infer human acceptance unless the user asks for
that work separately.

## Final Report

```text
git-gremlin:pr report
  PR:     <url>
  Title:  <pr title>
  Base:   <base branch>
  Branch: <branch> published via <remote>
```

## Never

- Push during drafting or before the user confirms the displayed PR proposal.
- Push when the current branch or `HEAD` differs from the approved proposal.
- Push the base branch, force-push, or choose between ambiguous remotes.
- Create a PR without explicit user confirmation.
- Retry silently after `git push` or `gh pr create` failure.
- Run verification, merge, update external issue state, or invoke another workflow unless
  the user asks separately.
