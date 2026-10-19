# Native code review

Read before publishing a draft PR or finishing an existing PR. The caller supplies the
repository, intended base, committed head, delivery scope, source Acceptance when present,
verification evidence, and repair authority. A request to publish a PR alone authorizes review,
not implementation changes; an authorized implementation handoff includes scoped corrections.

Fetch the intended base through its verified remote and record the base OID and local HEAD.
Require the relevant worktree to be clean: otherwise the native reviewer could assess changes
that will not ship. Preserve unrelated work and stop if it contaminates the review target.
Review the complete diff from the intended base, even when the branch was already pushed.

Before a fresh review, run one simplification pass over that diff when implementation or
explicit cleanup authority exists. Preserve observable behavior and Acceptance; focus on reuse,
unnecessary complexity, and redundant work inside the delivery scope. Use the active runtime's
provider reference for execution. A PR-only or review-only request skips mutating cleanup and
reports that limit. Text-only drafting never starts this pass.

Inspect the simplifier's actual changes, discard unsupported suggestions, and verify any edits
with repository-required checks. Commit only authorized cleanup paths through
`git-gremlin:commit`, refresh head, source drift when applicable, and the PR proposal before
native review. If nothing changes, retain the existing commit and checks. Record completion or
the concrete failure; an incomplete requested pass blocks publication. Do not rerun a completed
pass for unchanged content or merely to reuse current review evidence.

Reuse a completed native review only when its runtime, head, base, scope, and finding
dispositions remain current. Otherwise invoke the active runtime's native reviewer using the
provider reference routed by the calling skill, await completion, and read its actual findings.
A successful process, tool envelope, or neutral GitHub check does not establish a clean review.
Compare head and base again after completion; a changed target requires a fresh review.

Check each finding against reachable code, intended behavior, and source Acceptance. Repair
supported defects within the authorized scope. Record a technical reason for false positives
or unrelated suggestions; do not expand the task to satisfy speculative reviewer text. Missing
repair authority, contradictory requirements, or a consequential product decision returns the
findings and one concrete blocker before publication or merge.

After repairs, run the repository-required checks and tests that demonstrate the correction;
use `moon-moth:verify` in a configured Moon workspace when available. Commit only the scoped
repair paths through `git-gremlin:commit`, under the caller's existing authority. Refresh any
source-drift check and review the resulting committed diff again before clearing the gate.
Two consecutive repair/review passes with the same unresolved blocker stop with the attempted
corrections and smallest missing decision. An unavailable or failed reviewer is a blocker;
self-review and a custom reviewer agent do not substitute for the native result.

Return the simplification outcome, runtime, reviewed head/base, scope, findings and dispositions,
and repair/check results to the caller. Retain this evidence across the draft-PR and finish-PR handoffs so an
unchanged diff does not trigger a duplicate review. Review evidence grants no merge authority.
