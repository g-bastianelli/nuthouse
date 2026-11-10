# Native code review

Read before publishing a draft PR or finishing an existing PR. The caller supplies the
repository, intended base, committed head, delivery scope, source Acceptance when present,
verification evidence, and repair authority. A request to publish a PR alone authorizes review,
not implementation changes; an authorized implementation handoff includes scoped corrections.

Fetch the intended base through its verified remote and record the base OID and local HEAD.
Require the relevant worktree to be clean: otherwise the native reviewer could assess changes
that will not ship. Preserve unrelated work and stop if it contaminates the review target.
Run one simplification pass per delivery, before its first full review, when implementation or
explicit cleanup authority exists. Preserve observable behavior and Acceptance; focus on reuse,
unnecessary complexity, and redundant work inside the delivery scope. Use the active runtime's
provider reference for execution. A PR-only or review-only request skips mutating cleanup and
reports that limit. Text-only drafting never starts this pass.

Inspect the simplifier's actual changes, discard unsupported suggestions, and verify any edits
with repository-required checks. Commit only authorized cleanup paths through
`git-gremlin:commit`, refresh head, source drift when applicable, and the PR proposal before
native review. If nothing changes, retain the existing commit and checks. Record completion or
the concrete failure; an incomplete requested pass blocks publication.

## Review target

The first review of a delivery covers the complete diff from the intended base. After that,
review only this delivery's commits after the last reviewed head, and review local commits
before pushing them: a defect found after the push costs another push, CI run, and external
review. Base integrations are not delivery commits. Review pending delivery commits before
integrating the base, so the later-commits range never spans a base merge. An empty
`git show --remerge-diff <merge>` proves a clean merge, which refreshes checks only; a
non-empty one, a changed delivery scope, or a last reviewed head that is no longer an ancestor
of HEAD (`git merge-base --is-ancestor`) makes the next review a full review against the base.

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

Return the simplification outcome, runtime, last reviewed head and base, scope, round count,
findings and dispositions, and repair/check results to the caller, and keep them in the
caller's ledger when one exists. Any later run or runtime uses this record to target its next
review, never to skip one: confirm the recorded head is an ancestor of HEAD, then review only
the delivery commits after it; without a record, run a full review. Review evidence grants no
merge authority.
