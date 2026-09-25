---
name: check-folder-shape
description: Review TypeScript folder ownership, cohesive subtrees, orphans, and shared-code placement. Use after the last file creation/move/deletion or ownership change and before verification, completion, or PR preparation.
effort: high
argument-hint: "[task-start-commit-or-merge-base]"
---

# check-folder-shape

## Voice

Read `../../persona.md`; it is canonical for this skill's output and its scope
ends with the final report. The collar holds the whole folder this time.

## Language

Match the user's language. Keep paths, symbols and command arguments unchanged.

## Checkpoint obligation

**REVIEW THE TREE AFTER THE LAST MOVE.** Per-file compliance and a passing
compiler do not establish cohesive ownership. Complete this check before PR
preparation too; an earlier review is stale after another structural edit.

| Excuse                               | Reality                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| Every edited file follows the rules. | Unchanged siblings and orphan folders are part of the resulting tree. |
| Typecheck passes.                    | Import validity does not prove correct ownership.                     |

## Workflow

1. **Establish the scope.** Run from the target Git repository. Use the supplied
   base, the task's recorded starting commit, or the merge-base with the known
   PR target branch, in that order. Resolve the merge-base with `git merge-base`
   before passing it to the inventory. Never guess `main` or use today's `HEAD`
   if task changes have already been committed. If the base is unknown, ask for
   it and report the checkpoint incomplete. Existing dirty changes may belong
   to another task: include them in the observed tree but preserve their edits.
2. **Inventory the settled tree.** Resolve `scripts/inventory.mjs` relative to
   this installed SKILL.md, then run it by absolute path from the target repo:

   ```sh
   node /absolute/path/to/check-folder-shape/scripts/inventory.mjs --base <base>
   ```

   The JSON contains the resolved base, all changed paths (committed, staged,
   unstaged and non-ignored untracked), direct file counts and names per touched
   folder, its nearest surviving entry-point ancestor, child folder names,
   removed entry points with surviving files, and Git-detected moves out.
   NUL-delimited Git output preserves spaces and unusual filenames.
   An empty scope means no changes against that base, not proof of good design.
   A nonzero exit means the inventory failed; do not report a completed review.

3. **Read conventions and ownership.** For each reported folder, read its nearest
   `AGENTS.md` and applicable ancestor instructions; inspect conventions inside
   child folders too. The `convention` field is a discovery hint, limited to Git
   inventory within the repository. Also check ignored instructions and ones
   above the Git root. Read the complete resulting tree and relevant source,
   including unchanged siblings. Apply `../code-organisation/SKILL.md` and, for
   React owners, `../react-rules/SKILL.md` against those local conventions.
   - **Cohesion:** identify parent components/workflows and their private forms,
     components, hooks, logic and tests. Read importers and render/composition
     sites to determine ownership. A cohesive workflow belongs under its owner;
     for React, the parent's `index.tsx` composes its children. A count such as
     33 is a review cue, never a maximum or a reason to split unrelated leaves.
   - **Orphans:** inspect every removed entry point with survivors. Do the
     remaining files still share an owner? Move unrelated survivors to their
     actual owners; do not restore a meaningless barrel to silence the signal.
     An `index.ts` to `index.tsx` replacement may be legitimate.
   - **Moves and sharing:** for each move, find current sibling consumers of
     both old and new paths. Inspect deletions paired with additions/untracked
     files too: Git may not recognize an edited or unstaged move. Search symbol
     references and follow re-exports, aliases and test imports, not just literal
     relative paths. Code consumed by different subtrees belongs at their lowest
     common ancestor. A predicate used by both modes must not stay private to one.

   Reuse a dependency analyzer only if the repo already configures it, with its
   TypeScript resolution settings. Otherwise use code search plus source reads.
   Do not install a tool or generate an import parser for this review. The
   inventory does not infer clusters, resolve imports, or decide architecture.

4. **Resolve and recheck.** Within the authorized task, correct structural drift,
   update imports and preserve behavior. If ownership is ambiguous, name the
   alternatives and the missing evidence instead of moving files speculatively.
   After any correction, rerun the inventory with the same base and revisit
   affected owners and consumers. The checkpoint precedes the repo's normal
   typecheck/lint/tests; return to that verification flow after the final move.

## Final Report

Keep it short, with an evidence-based disposition for each reviewed owner:

- Base and folders reviewed, with the applicable convention paths.
- Structural fixes or reasons to retain the current layout; cite concrete files
  and consumers, including any shared code deliberately kept at the ancestor.
- Unresolved ownership questions and skipped/unreadable scope. Say **incomplete**
  when a required folder or consumer could not be inspected.
- Verification still to run after the last move. Exit 0 from the inventory is
  only successful fact collection, never an architectural pass.

## Never

- Commit, push, rebase, or modify external services from this skill.
- Treat file counts, filenames, a missing index, or a search with no matches as
  sufficient proof of ownership or lack of consumers.
- Claim full coverage of symlinks, submodules, ignored/generated files, or paths
  outside the repository: these are excluded from the inventory; name relevant
  omissions and inspect them separately when the task needs them.
- Add folders or barrels merely to satisfy a numerical or aesthetic preference.
