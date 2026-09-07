---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Commits an existing staged selection, or stages dirty changes automatically for an actual commit while preserving explicit file scope. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: high
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git rev-parse:*), Read
---

# git-gremlin:commit

Prepare and commit the intended selection. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw,
> unexpanded dynamic-context commands, run them manually before step 1.

- Staged: !`git diff --cached --stat | tail -20`
- Working tree: !`git status --short | head -20`

## Workflow

1. Verify this is a Git repository and distinguish an actual commit request from a request
   to draft or review a message. Draft-only intent never authorizes staging or committing.
2. Resolve the selection:
   - Read `git status --short` and `git diff --staged --name-only`.
   - For both commits and message drafts, if the user names explicit paths and any staged
     path is outside that scope, report the mismatch and stop without changing the index.
   - If the user requests only staged changes, use exactly the existing index and proceed
     directly to step 3. If it is empty, report that there are no staged changes and stop,
     even when the working tree is dirty. This applies to commits and message drafts.
   - For draft-only intent, use the existing staged selection when present. Otherwise inspect
     the unstaged diff within any explicit path scope, plus relevant untracked files with
     `Read`, without changing the index. If that selection is empty, report that there is
     nothing to describe and stop.
   - Everything below applies only to an actual commit.
   - If the user explicitly asks for all changes with no narrower path scope, run `git add -A`.
   - If the user names explicit paths and the index is empty, run
     `git add -- <pathspec...>`, passing each pathspec as a separately quoted argument after
     `--`. Never use `eval` or a shell-expanded glob.
   - If the user names explicit paths and the index already contains files, preserve the
     existing staged selection; its scope was checked above.
   - With no explicit scope, preserve a non-empty index. If the index is empty and the tree
     is dirty, the commit request authorizes `git add -A`.
   - Re-read `git diff --staged --name-only`. If it is still empty, report that there is
     nothing to commit and stop.
3. Read the resolved diff (`git diff --staged` for an actual commit) and draft
   `<type>(<scope>): <imperative description>` from that exact selection. Choose from
   `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, or `perf`;
   keep the first line at 72 characters or fewer and omit the scope when none is useful.
   Never describe a change absent from the diff. For draft-only intent, display the message
   and stop.
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

- Run `git push` or `git rebase`.
- Commit when the user only asked for a draft, suggestion, or review.
- Stage anything for a draft-only request.
- Stage anything for a staged-only request, including when the index is empty.
- Add unstaged changes to a non-empty index unless the user explicitly asks for all changes.
- Commit a staged path outside an explicit scope.
- Retry silently after a pre-commit hook failure, or bypass it with `--no-verify`.
