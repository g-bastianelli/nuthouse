# Native code review

Read before publishing a draft PR or finishing an existing PR. The caller supplies the
repository, intended base, committed head, delivery scope, source Acceptance when present,
verification evidence, and repair authority. A request to publish a PR alone authorizes review,
not implementation changes; an authorized implementation handoff includes scoped corrections.

Fetch the intended base through its verified remote and record the base OID and local HEAD.
Require the relevant worktree to be clean: otherwise the native reviewer could assess changes
that will not ship. Preserve unrelated work and stop if it contaminates the review target.
The full review covers the complete diff from the intended base, even when the branch was
already pushed.

Run one simplification pass per delivery, before its first full review, when implementation or
explicit cleanup authority exists. Preserve observable behavior and Acceptance; focus on reuse,
unnecessary complexity, and redundant work inside the delivery scope. Use the active runtime's
provider reference for execution. A PR-only or review-only request skips mutating cleanup and
reports that limit. Text-only drafting never starts this pass.

Inspect the simplifier's actual changes, discard unsupported suggestions, and verify any edits
with repository-required checks. Commit only authorized cleanup paths through
`git-gremlin:commit`, refresh head, source drift when applicable, and the PR proposal before
native review. If nothing changes, retain the existing commit and checks. Record completion or
the concrete failure; an incomplete requested pass blocks publication. Repairs, feedback fixes,
and a later `finish-pr` run do not rerun a completed pass.

Each run of `pr` or `finish-pr` makes at most two native reviews: one full review of the
complete diff, then one confirmation of every commit after the last reviewed head. A third pass
costs more than it finds: a nondeterministic reviewer reports new findings on already-reviewed
code each pass, so review/fix cycles do not converge on their own. Evidence stays current while
reviews cover every commit up to the current head for the same delivery scope; a later run
reuses it and spends only its confirmation on newer commits. A changed delivery scope needs a
new full review. A clean base integration needs refreshed checks only and becomes the last
reviewed head; a conflict resolution in this delivery's own code makes the next review a full
review against the new base.

Invoke the active runtime's native reviewer using the provider reference routed by the calling
skill, await completion, and read its actual findings. A successful process, tool envelope, or
neutral GitHub check does not establish a clean review. Compare head and base again after
completion; commits that landed meanwhile are not covered yet.

Check each finding against reachable code, intended behavior, and source Acceptance. A blocking
finding is a reachable defect in this delivery's changes: wrong or unsafe behavior (including
security, data loss, resource or performance regressions, and accessibility) or an Acceptance
violation. Repair it. Style, naming, speculative design, and pre-existing or unrelated code are
non-blocking: fold a trivial in-scope one into the same repair commit, otherwise record a
technical reason or a follow-up. Missing repair authority, contradictory requirements, or a
consequential product decision returns the findings and one concrete blocker before publication
or merge.

After repairs, check each original blocking finding against the repaired code and run the
repository-required checks and tests that demonstrate the correction; use `moon-moth:verify` in
a configured Moon workspace when available. Commit only the scoped repair paths through
`git-gremlin:commit`, under the caller's existing authority, and refresh any source-drift check.
Then spend the confirmation with the provider reference's confirmation command; `finish-pr`
spends it once, after its last feedback round and before the merge request, not after each push.
The confirmation blocks on a blocking defect in the confirmed commits. When it still reports
one, return `blocked` with the attempted corrections and the smallest missing decision instead
of starting a third review. An unavailable or failed reviewer is a blocker; self-review and a
custom reviewer agent do not substitute for the native result.

Return the simplification outcome, runtime, last reviewed head/base, scope, findings and dispositions,
and repair/check results to the caller. Retain this evidence across the draft-PR and finish-PR handoffs so an
unchanged diff does not trigger a duplicate review. Review evidence grants no merge authority.
