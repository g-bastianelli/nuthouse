---
name: git-gremlin:pr
description: Use automatically in Codex when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Drafts a PR title/body from git log and diff, then runs gh pr create only after confirmation. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
---

# Git Gremlin PR for Codex

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions:
   - Verify this is a git repository.
   - Verify `gh` is available and authenticated with `gh auth status`; if not, stop with a concise `gh auth login` instruction.
   - Infer the base branch with `gh repo view --json defaultBranchRef`, fallback to `main`.
   - Verify commits exist ahead of base with `git log <base>...HEAD --oneline`; if empty, stop.
3. Draft:
   - Prefer keeping raw diffs out of user-visible output.
   - Use `git log <base>...HEAD --oneline`, `git diff <base>...HEAD --stat`, changed file names, and the diff as needed.
   - Draft a PR title, max 72 chars, imperative, no issue prefix unless it is clearly present in the branch/log.
   - Draft the body:
     ```markdown
     ## Summary
     - <what changed and why>

     ## Test plan
     - <verification performed or recommended>
     ```
4. Approval:
   - Show the proposed title and body.
   - Ask for confirmation, edits, regenerate, or cancel.
   - Never create the PR without explicit confirmation.
5. Execute:
   - On confirmation, run `gh pr create --title "<title>" --body "<body>" --base "<base>"`.
   - If it fails, surface stderr and stop; do not retry silently.
6. Report:
   - Return the PR URL, title, and base branch.

## Final Report

```text
git-gremlin:pr report
  PR:    <url>
  Title: <pr title>
  Base:  <base branch>
```

## Never

- Never run `git commit`, `git push`, or `git rebase`.
- Never create a PR without explicit user confirmation.
- Never paste the raw diff to the user unless they ask for it.
- Never skip `gh auth status`.
- Never retry silently after `gh pr create` fails.
