# Native code review

Read the simplification section before final implementation checks, and the review sections
before publishing a draft PR or finishing an existing PR. The caller supplies the
repository, intended base, committed head, delivery scope, source Acceptance when present,
verification evidence, and repair authority. A request to publish a PR alone authorizes review,
not implementation changes; an authorized implementation handoff includes scoped corrections.

## Implementation simplification

Run one simplification pass after the authorized implementation is settled, before its final
repository checks and implementation commit. Preserve observable behavior and Acceptance;
focus on reuse, unnecessary complexity, and redundant work inside the delivery scope. Supply
the exact allowed paths and changes: scoped staged and unstaged diffs, untracked implementation
files (`git ls-files --others --exclude-standard -- <paths>`), and the relevant committed
base-to-HEAD diff when implementation already spans commits. A committed range alone omits
the work that is about to ship. Preserve unrelated paths and changes within shared files.
Read only the active runtime's provider reference for execution.

Inspect actual changes and discard unsupported suggestions, then run final required checks and
commit the implementation and accepted cleanup together through `git-gremlin:commit`. Record
the completed scope, source context, and outcome, including no useful changes. `pr` and
`finish-pr` reuse that completion; committing, pushing, or making scoped review repairs does
not itself call for another simplification pass. New implementation scope or changed Acceptance
requires reassessing the affected completion. If an authorized implementation arrives committed
without a completed pass, run it before the next checks/commit and first native review; verify
and commit only accepted cleanup paths, retaining current checks and HEAD if nothing changed.
A PR-only or review-only request skips mutating cleanup and reports that limit. Text-only
drafting never starts it. An incomplete requested pass blocks publication.

## Review target

Fetch the intended base through its verified remote and record the base OID and local HEAD.
Require the relevant worktree to be clean: otherwise the native reviewer could assess changes
that will not ship. Preserve unrelated work and stop if it contaminates the review target.

The first review covers the complete committed diff from the intended base. After that,
review only uncovered delivery commits, locally before pushing: a defect found after the push
costs another push, CI run, and external review. Keep the actual last reviewed head separate
from a coverage anchor, initially that same head. Use the anchor as the later-commits review
base. Confirm its ancestry with `git merge-base --is-ancestor` and inspect intervening commits
and parents with `git log --first-parent --format='%H %P' <anchor>..HEAD`.
If a recorded anchor differs from the actual reviewed head, revalidate the clean-integration
chain connecting them before using it; a ledger entry alone does not prove that coverage.

Review pending delivery commits before integrating the base. A clean base merge can advance
the anchor without another native review only when its first parent is the current anchor,
its sole other parent belongs to the fetched intended-base history, and
`git show --format= --remerge-diff <merge>` has no output. Prove each link for consecutive
merges; this excludes a hidden unreviewed delivery commit or an unrelated merged branch.
Refresh checks and applicable source drift for the integration. Keep the actual reviewed head
and review base unchanged: for reviewed `R`, clean integration `M`, and later repair `F`,
the next target is `M..F`; `M` was not itself reviewed. Never use `R..F` and sweep base commits
into that delta. Unreviewed commits before an already-created merge, conflict-resolution edits,
changed scope or Acceptance, rewritten ancestry, or an unprovable merge chain require a full
review against the fetched intended base.

When no delivery commits remain after the validated anchor, reuse completed review evidence
and run no native review, including across runtimes. This zero-delta path still requires current
scope/source, clean relevant worktree, valid ancestry, and disposition of all blocking findings.
Base movement requires refreshed checks/drift, not relabeling an older review's base. Missing or
invalid review evidence requires a full review. A completed native review with a stable target
updates both the actual reviewed head and anchor to its captured HEAD.

Invoke the active runtime's native reviewer using the provider reference routed by the calling
skill, await completion, and read its actual findings. A successful process, tool envelope, or
neutral GitHub check does not establish a clean review. Compare HEAD again after completion;
commits that landed meanwhile are not covered yet.

## Findings

Check each finding against reachable code, intended behavior, and source Acceptance. A blocking
finding is a reachable defect that this delivery introduces or makes reachable: wrong or unsafe
behavior (including security, data loss, resource or performance regressions, and
accessibility) or an Acceptance violation. Repair it. Style, naming, speculative design, and
unrelated code are non-blocking: fold a trivial in-scope one into a repair commit the round
already needs, otherwise record a technical reason or a follow-up. A round without blocking
findings ends the loop, so its non-blocking findings become follow-ups rather than a new commit
to review. Missing repair authority, contradictory requirements, or a consequential product
decision returns the findings and one concrete blocker before publication or merge.

After repairs, check each original blocking finding against the repaired code and run the
repository-required checks and tests that demonstrate the correction; use `moon-moth:verify` in
a configured Moon workspace when available. Commit only the scoped repair paths through
`git-gremlin:commit`, under the caller's existing authority, refresh any source-drift check,
and review the repair commits as later commits. An unavailable or failed reviewer is a blocker;
self-review and a custom reviewer agent do not substitute for the native result.

## Stop rule

A round is one review, native or an external reviewer's feedback on the latest push, plus its
repairs. Two consecutive rounds that each report a new blocking finding return `blocked` with
the open findings and the smallest missing decision. A nondeterministic reviewer reports new
findings on already-reviewed code each pass, so review/fix cycles do not converge on their own;
this rule is what ends them. After the user decides, that decision dispositions the open
finding, and only the resulting commits are reviewed.

## Evidence

Return the simplification outcome, runtime, actual last reviewed head and base, coverage anchor
with any clean-merge evidence, source/scope, round count,
findings and dispositions, and repair/check results to the caller, and keep them in the
caller's existing ledger when one exists. Revalidate those notes against Git and current source
on resume, then select full review, uncovered delta, or zero-delta reuse above. Do not create a
separate state store. Review evidence grants no merge authority.
