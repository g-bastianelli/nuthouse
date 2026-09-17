# Development drift checkpoints

Carry these instructions into implementation when an authoritative spec or issue
Acceptance is available. Keep its absolute path or issue id and the current deliverable
in the implementation context; on resume, recover them from the plan before coding.
No source means report that drift cannot be assessed, not invent a spec or block an
unrelated direct task. If a known source cannot be read, keep the assessment unresolved.

After a functional block and its relevant checks are complete, when a decision departs
from the source, and before preparing a PR:

**REQUIRED SUB-SKILL:** Use `acid-prophet:check-drift` with the source, base, completed
block/issue scope, and `--scope worktree`.

Run without a permission prompt. Reuse a report only while source, decisions, relevant
code, and assessed scope remain unchanged. Do not run after every file edit or label
future work outside the completed block as a regression. Before a PR, also check
`--scope committed` against the intended PR scope: uncommitted fixes are not in a PR.

For DRIFT or AMBIGUOUS findings during authorized implementation:

**REQUIRED SUB-SKILL:** Use `acid-prophet:reconcile-drift` with the complete report,
source, related plan/checklist paths, and decisions already made by the user.

A request only to inspect drift remains read-only. A request only to publish a PR
does not authorize new product decisions or automatic commits. Keep unresolved
findings explicit, continue independent work, and resolve affected findings before
declaring the block complete or publishing the PR. If fixes remain uncommitted,
report them and use the commit workflow only when committing is authorized.

These are instructions for the active agent, not a background watcher. They run when
the implementation or PR workflow reaches a checkpoint.
