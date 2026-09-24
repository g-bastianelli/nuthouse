# Quick-fix-mode spawn

Quick-fix mode starts from a free-form objective. Do not dispatch `linear-reader`: there is no
Linear issue, task, project control, or capacity calculation in this mode.

1. Use the complete free-form objective as source of truth. Remove recognized transport flags and
   `--quick` but preserve the objective's wording.
2. Normalize by trimming and collapsing whitespace to ASCII spaces. For identity, lowercase,
   apply Unicode NFKD, remove combining marks, replace every run outside `a-z0-9` with hyphens, trim,
   take 48 characters, and trim again. Fall back to `quick-fix` when empty.
3. Calculate the first eight hex characters of SHA-256 over the normalized objective with Node.
   Use branch `quick/<slug>-<digest>` and workspace `quick-<slug>-<digest>`.
4. Set `bindingArgs = --branch <branchName> --skip-branch-prefix`. The stable digest lets an identical
   objective recover its workspace without colliding with another objective sharing a slug.
5. The worker prompt must not invoke `linear-devotee:greet`; it starts directly with the exact objective, reads repository instructions before
   edits, scopes ownership to this fix/workspace, runs appropriate checks, and forbids reverting
   others, merging, pushing, changing dependencies, or changing Linear. It reads no Linear project,
   so it names no sibling. End with a concise `DONE`/`BLOCKED` handoff.
6. For launch failure, report the exact workspace. A later identical spawn must repeat workspace
   and terminal inspection before recovery.
