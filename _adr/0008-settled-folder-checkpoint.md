# 0008 — Review folder ownership after structural changes

## Status

Accepted (2026-09-18).

## Context

In notom-platform, an EquipmentObjectInspector task ended with 33 flat files,
including a cohesive 15-file wiring workflow. A StandardObjectConfiguration
folder survived the deletion of its index with unrelated children, and a
predicate consumed by two modes remained inside one mode's module. Both
`react-rules` and `code-organisation` had been active. The ownership rule existed;
no checkpoint applied it to the settled tree, including unchanged siblings.

## Evidence and interpretation

- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)
  recommends freedom for contextual decisions, reusable scripts for repeated
  mechanical logic, and a work/validate/fix loop. Our application: automate the
  Git inventory, leave semantic ownership to a source-based review.
- [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide) distinguishes
  deterministic command hooks from model judgment. Agent hooks can inspect files,
  but are experimental and the guide prefers command hooks in production.
  [Stop semantics](https://code.claude.com/docs/en/hooks) concern a finished response,
  not a known task boundary, and require guarding repeated continuations.
- [Dependency-cruiser options](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md)
  describe TypeScript configuration, path resolution and pre-compilation dependencies.
  Our inference: a small regex import graph is insufficient evidence that a cluster
  has no outside consumers. Use a repository's existing analyzer or inspect source.
- [Git diff](https://git-scm.com/docs/git-diff) documents NUL-delimited name/status
  records and similarity-based rename detection. These are appropriate mechanical
  facts, with deletion/addition pairs still requiring review.

These sources support the separation of mechanics and judgment; none prescribes
this particular plugin layout or guarantees that an agent follows a skill handoff.

## Decision

Add a canonical cross-runtime `subroutine:check-folder-shape` workflow skill.
`code-organisation` requires it after the last structural change and before
verification, completion or PR preparation. `react-rules` refers to that checkpoint.
The existing session digest discovers its description; it has no edit `paths`, so
its workflow is not packed into every file-edit injection.

Bundle one dependency-free ESM inventory script beside the skill. It reads an
explicit task-start commit or resolved merge-base, the settled tracked tree and
non-ignored untracked files. Report direct counts/names, nearest entry-point
owners, convention hints, removed entry points with survivors, and rename endpoints.
Use NUL-delimited Git output; do not mutate the index, infer a default branch,
parse imports, classify architecture, or introduce a file-count threshold.

The agent reads local conventions and all relevant owner/sibling sources, traces
consumers, fixes authorized structural drift, repeats the checkpoint, then returns
to repository-native verification. Record retained layouts with concrete reasons;
unknown ownership or incomplete inspection is not a pass.

## Alternatives

| Placement                    | Assessment                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| More per-file rules only     | Repeats the already-present rule without a separately named settled-tree review. Keep only timing and a required handoff in the ambient contract.                                                    |
| Dedicated verification skill | Chosen: portable, explicit task boundary, focused source review and a repeatable inventory.                                                                                                          |
| Stop command hook            | Reliable event delivery, but a finished response can be a question or partial task; branch/base attribution and deduplication would require extra state. A count cannot decide semantic correctness. |
| Stop prompt/agent hook       | A prompt alone cannot inspect the final sources; agent hooks add experimental behavior and a model call at every stop. Not adopted.                                                                  |
| Moon-only verification step  | Misses non-Moon repos and makes an independent discipline depend on another plugin.                                                                                                                  |
| Custom dependency parser     | Adds approximate resolution and maintenance without proving semantic ownership. Reuse configured tools when present.                                                                                 |

## Consequences

No new dependency, hook state, workflow kernel, or mandatory external analyzer.
Only the fact collection is deterministic. The timing remains an explicit skill
obligation, not guaranteed runtime enforcement; a skipped handoff remains possible.
This is a deliberate limitation, documented rather than disguised as a hard gate.

Script tests exercise real temporary Git repositories and filesystem changes.
Semantic regression scenarios live beside those tests for review/evaluation;
they are not string assertions that freeze skill wording. Both plugin manifest
patch versions advance together; marketplace SHA pins wait until after merge.
