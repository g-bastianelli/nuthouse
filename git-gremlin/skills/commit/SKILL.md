---
name: git-gremlin:commit
description: Use automatically in Codex when the user asks to commit changes, create a commit, write a commit message, commit staged changes, commit everything, run git commit, "fais le commit", "commit mes changements", or "crée un commit". Handles staged changes first and may offer to stage dirty changes only after confirmation. Do not use for plain git status, diff, log, push, rebase, or PR creation.
---

# Git Gremlin Commit for Codex

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions:
   - Verify this is a git repository.
   - Check staged files with `git diff --staged --name-only`.
   - If none are staged, check dirty files with `git status --short`.
   - If dirty files exist and the user explicitly asked to commit all/everything or stage changes, ask before running `git add -A`, then re-check staged files.
   - If staged files are still empty, stop and ask the user to stage files or say they want all changes staged.
3. Draft:
   - Prefer keeping raw diffs out of user-visible output.
   - Use the staged diff, staged file list, and diff stat to draft one conventional commit message.
   - First line format: `<type>(<scope>): <imperative description>`, max 72 chars.
   - Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`.
4. Approval:
   - Show the proposed message and staged file count.
   - Ask for confirmation, edits, regenerate, or cancel.
   - Never commit without explicit confirmation.
5. Execute:
   - On confirmation, run `git commit -m "<approved message>"`.
   - If it fails, surface stderr and stop; do not retry silently.
6. Report:
   - Return the short commit hash, final message, and file count.

## Final Report

```text
git-gremlin:commit report
  Hash:     <commit hash>
  Message:  <commit message>
  Files:    <n files committed>
```

## Never

- Never run `git push`, `git rebase`, or `gh pr create`.
- Never stage files unless the user explicitly asked for all/everything or confirms the staging prompt.
- Never commit without explicit user confirmation.
- Never paste the raw diff to the user unless they ask for it.
- Never retry silently after a pre-commit hook failure.
