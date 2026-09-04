---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Drafts a conventional message from the current staged diff and, when requested, commits exactly that selection. Never stages files. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: low
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git commit:*), Bash(git rev-parse:*), Read
---

# git-gremlin:commit

Commit exactly the current index. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the line below still shows a raw,
> unexpanded dynamic-context command, run it manually before step 1.

- Staged: !`git diff --cached --stat | tail -20`

## Workflow

1. Verify this is a Git repository and distinguish an actual commit request from a request
   to draft or review a message. Draft-only intent never authorizes a commit.
2. Read `git diff --staged --name-only` and `git diff --staged`. If the index is empty,
   stop and ask the user to stage the intended selection. Never stage files on their behalf.
   When the user names explicit paths, stop if the staged set includes anything outside that
   scope.
3. Draft `<type>(<scope>): <imperative description>` from the staged diff. Choose from
   `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, or `perf`;
   keep the first line at 72 characters or fewer and omit the scope when none is useful.
   Never describe a change absent from the staged diff. For draft-only intent, display the
   message and stop.
4. For an actual commit request, run `git commit -m "<MESSAGE>"`, passing the message as
   one quoted argument. The user's request is the approval gate.
   - On failure, surface stderr verbatim and stop. Never retry a pre-commit hook failure or
     bypass it with `--no-verify`.
   - On success, read the hash with `git rev-parse --short HEAD`.

## Final Report

```text
git-gremlin:commit report
  Hash:     <commit hash>
  Message:  <commit message>
  Files:    <n files committed>
```

## Never

- Run `git add`, `git push`, or `git rebase`.
- Commit when the user only asked for a draft, suggestion, or review.
- Commit a staged path outside an explicit scope.
- Retry silently after a pre-commit hook failure, or bypass it with `--no-verify`.
