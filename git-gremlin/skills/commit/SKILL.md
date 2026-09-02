---
name: commit
description: Use automatically when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Commits an existing staged selection, or stages dirty changes automatically while preserving any explicit file scope. Do not use for plain git status, diff, log, push, rebase, or PR creation.
effort: high
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Bash(git branch --show-current), Bash(git rev-parse:*), Read
---

# git-gremlin:commit

Commit intent is the approval gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Staged: !`git diff --cached --stat | tail -20`
- Working tree: !`git status --short | head -20`

## Workflow

1. **Resolve intent and scope.**
   - Verify this is a git repository.
   - Decide whether the user asked for an actual commit or only a draft, suggestion, or
     review of a message. Draft-only intent never authorizes staging or committing.
   - Resolve the mutation scope:
     - **Full tree** — the user said all/everything and named no narrower scope.
     - **Explicit paths** — the user named one or more pathspecs, such as `README.md` or `src/`.
     - **Default** — a commit was requested with no narrower scope expressed.
     - If the request sounds narrower but yields no unambiguous pathspecs, stop and ask.
       Never fall back to the full tree.
   - Gate on the `Staged` snapshot above. Re-run `git diff --staged --name-only` only if
     that snapshot is empty or the tree may have moved since skill load.

2. **Stage.** Draft-only intent skips this step entirely: use the existing staged diff
   and stage nothing. If the index is empty, stop and ask the user to stage a selection or
   request a real commit. Everything below applies to an actual commit only.
   - **Full tree:** run `git add -A`, even over a partial staged selection.
   - **Explicit paths, index already populated:** compare the unfiltered
     `git diff --staged --name-only` against the same command filtered by the pathspecs.
     If the two sets differ, a staged path sits outside the requested scope: stop without
     touching the index and ask whether to include it. Otherwise commit the selection as-is,
     without widening it.
   - **Explicit paths, empty index:** run `git add -- <pathspec...>`, each pathspec a
     separately quoted argument after `--`. Never `eval`, never a shell-expanded glob.
   - **Default:** preserve any staged selection. If nothing is staged and the tree is dirty,
     commit intent authorizes `git add -A`; run it.
   - Re-check `git diff --staged --name-only`. Still empty means nothing to do — say so and stop.

3. **Draft the message.**
   - Read `git diff --staged` and `git diff --staged --name-only`.
   - Pick the type from `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`,
     plus the narrowest useful scope.
   - Write `<type>(<scope>): <imperative description>`, first line ≤72 characters. Drop the
     scope when none is meaningful. Never describe a change absent from the staged diff.
   - Draft-only intent: display the message and stop here.
   - Otherwise the user's commit request is the approval. Continue.

4. **Commit.**
   - Run `git commit -m "<MESSAGE>"`, passing the message as one quoted argument.
   - On failure, surface stderr verbatim and stop. Never retry a pre-commit hook failure,
     never bypass it with `--no-verify`.
   - On success, read the hash with `git rev-parse --short HEAD`.

## Verification is not optional

**A COMMIT THAT CLOSES ISSUE-DELIVERY WORK NEEDS A VERIFICATION THAT ACTUALLY RAN.**

| Excuse                                                | Reality                                            |
| ----------------------------------------------------- | -------------------------------------------------- |
| "The user asked me to commit, that's approval enough" | Approval to commit is not evidence the code works. |
| "Checks passed earlier in the session"                | Earlier is before the last edit. Re-run them.      |
| "It's a one-line change"                              | One-line changes break builds.                     |

When this commit closes work that came through `linear-devotee:plan`, require a
`moon-moth:verify` clean flight on the current tree. If none ran, or edits landed after
it, say so and run it before committing.

## Final Report

```text
git-gremlin:commit report
  Hash:     <commit hash>
  Message:  <commit message>
  Files:    <n files committed>
```

**REQUIRED SUB-SKILL:** when the branch is ready for review, hand to `git-gremlin:pr`.

## Never

- Run `git push`, `git rebase`, or a force-push.
- Commit when the user only asked for a draft, suggestion, or review.
- Add unstaged changes to an existing staged selection unless the user asked for all/everything.
- Stage or commit a path outside an explicit scope.
- Treat an ambiguous narrow scope as authorization for `git add -A`.
- Stage anything for a draft-only request, including `git add -A` on a dirty tree.
- Skip the staged-files check.
- Retry silently after a pre-commit hook failure, or bypass it with `--no-verify`.
