# Development and PR drift

## Contents

- Resolve the source
- Collect the effective change
- Analyze drift
- Optional publication

## Resolve the source

Verify Git and choose `worktree` by default or `committed` for the actual PR payload. Prefer an
explicit readable spec. Otherwise scan `docs/acid-prophet/specs/` in this order: matching
`linear-project`, project id in body, branch issue id in body, close filename slug. Ask if still
ambiguous. If needed, use the branch issue only to resolve its project and retry.

When no local spec exists, use supplied issue Acceptance. An automatic checkpoint with no source
reports unavailable; an explicit check asks for the source. Once selected, a spec remains primary
over later Linear context.

From a spec, extract the active Acceptance section only, excluding history, plus Goal/Problem,
Solution, Constraints, Non-goals, and Edges. From Linear fallback, use a bounded read-only agent to
load project details and complete issue Goal/Acceptance/Constraints. Capture unresolved
`[NEEDS CLARIFICATION: ...]` markers with lines.

## Collect the effective change

Resolve base from `--base`, PR base, default branch, then existing `main`. Require a readable base
and merge base; failure is unavailable comparison, not clean.

Capture HEAD, short status, and merge-base-to-HEAD diff. In `worktree`, also inspect staged,
unstaged, and relevant untracked source/tests without modifying the index. Exclude secrets,
generated output, and unrelated user files; unreadable relevant data is missing evidence. Judge the
effective tracked state once and retain provenance so local corrections are not mistaken for
committed fixes.

In `committed`, use only merge-base-to-HEAD and files at HEAD. A local-only spec cannot bless older
committed behavior. Inspect source history and recorded decisions when requirements changed; do not
compare changed code only against changed expectations. No changes in scope is not full acceptance.

## Analyze drift

Dispatch a read-only agent with reference, effective change, selected scope, and implementation
block/issue. For every criterion and constraint return source path/id, classification, expected
versus observed behavior, and file/line evidence. An untouched criterion is not automatically
clean. Assess regressions and affected cross-cutting constraints; missing evidence inside scope is
ambiguous.

Record counts, source version, base, HEAD, scope, and unresolved decisions. A clean result describes
only this comparison.

## Optional publication

Print findings inline and return them to the caller. Only an explicit publication request enables a
PR comment. Confirm the concrete comment unless already authorized, write it to a temporary file,
and call `gh pr comment --body-file`. Surface failures and offer manual copy; do not retry silently.
