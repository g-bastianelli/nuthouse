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
   - If an authoritative spec or issue Acceptance is available in the delivery context
     or `docs/acid-prophet/specs/`, resolve the applicable source and run the checkpoint
     below before drafting. An ambiguous source needs clarification. No source means
     drift assessment is unavailable, not a reason to invent requirements.

   **REQUIRED SUB-SKILL:** Use `acid-prophet:check-drift` when available, with the source,
   inferred base, and intended PR scope. Check `worktree` and `committed` separately.
   Follow its plugin's `shared/development-drift.md` for findings and existing repair
   authority. Do not publish with unresolved drift or ambiguous findings. Local fixes
   must enter HEAD through an authorized commit workflow before clearing committed drift.
   If the skill is unavailable, disclose that limitation without claiming a clean result.
   After any authorized repairs, refresh branch and `HEAD_OID` before drafting.

2. Read `git log <base>...HEAD --oneline` and `git diff <base>...HEAD`. Detect Linear
   issue ids with `/\b[A-Z][A-Z0-9]+-[0-9]+\b/`, preferring the branch, then the log, then
   the diff. When exactly one id is unambiguous, suffix the title with ` [<id>]`; when
   several ids remain ambiguous, add no suffix. Draft an imperative title no longer than
   72 characters including any Linear suffix, preserving a useful conventional type or
   scope from the commits. Draft a body with `## Summary` and one to three bullets, then
   `## Test plan` with a checklist, then `Closes <id>` on its own line when one unambiguous
   Linear id was detected. Do not invent changes or verification absent from the inputs.
3. If the user asked only for PR text, display it and stop. Otherwise display the title,
   body, and `<branch> → <base>`, then wait for confirmation or edits. This is the only
   extra approval gate.
4. After confirmation, verify that the branch and `HEAD_OID` still match the proposal. If they
   changed, regenerate it and ask again.
   Revalidate drift report inputs too: base, source (including remote Acceptance when used),
   recorded decisions, relevant worktree changes, and intended scope. Refresh affected
   comparisons if any changed during the approval wait; unresolved findings stop publication.
   If that changes the PR proposal, present the updated proposal for approval.
5. Resolve the push remote in this order: `branch.<BRANCH>.pushRemote`,
   `remote.pushDefault`, `branch.<BRANCH>.remote`, `origin`, then the sole configured remote.
   Stop if the result is local (`.`), missing, or ambiguous.
6. Run `git push --set-upstream "<REMOTE>" "HEAD:refs/heads/<BRANCH>"`. Never force-push.
   `--set-upstream` is what leaves the branch with an upstream: it is silently ignored on an
   OID refspec, and `push.autoSetupRemote` only covers a push with no refspec, so a branch
   pushed either of those ways has none and tooling that maps a branch to its PR finds
   nothing. If the push fails, surface stderr verbatim and do not retry or create the PR.
7. Verify what actually landed: `git rev-parse "<REMOTE>/<BRANCH>"` must equal `<HEAD_OID>`.
   On mismatch, stop without creating the PR and report both OIDs — the remote holds
   something the user never approved.
8. Run
   `gh pr create --head "<BRANCH>" --title "<TITLE>" --body "<BODY>" --base "<BASE>"`,
   passing every value as a separately quoted argument without `eval`. If it fails,
   surface stderr verbatim and do not retry. On success, capture the PR URL from stdout.

Hooks and CI own test execution; the source comparison above is the pre-PR drift checkpoint.
This skill does not run test suites, merge the PR, update issue or
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
- Run test suites, merge, update external issue state, or invoke unrelated workflows unless
  the user asks separately. The conditional drift checkpoint above is part of PR preparation.
