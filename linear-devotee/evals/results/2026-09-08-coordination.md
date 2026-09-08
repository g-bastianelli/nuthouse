# Coordination review — 2026-09-08

Candidate: local workspace changes based on `f1c9ac6f5c7f01de03d5a251c84ab8b1482aa558`.
An independent Codex subagent (`coordination_eval`, inherited model) received only the
[raw cases](../coordination-cases.md), local plugin instructions, and read-only constraints.
It did not receive the rubric, diff, expected verdicts, or earlier evaluation results.

## Observed decisions

| Case | Actual response                                                                                                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | `needs_changes`: mandatory agreement has no authoritative semantics or decision owner. Proposed fixing the contract or bounded contract discovery blocking both implementations; an arbitrary NOT-583 → NOT-582 edge alone is insufficient.              |
| B    | `pass`: approved D1/v1 and independently testable entry points justify zero edges. A semantic pass does not authorize dispatch or prove live creation.                                                                                                   |
| C    | `needs_changes` as supplied; corrected proposal passes after removing F-2 → F-1. Separate functions, invariants, and tests justify independence despite the common file.                                                                                 |
| D    | `needs_changes` as supplied; corrected ordering E-2 → E-1 passes. Consumer requires readHeader and actual encoded output. Producer owns codec checks; consumer owns integration/checksum verification.                                                   |
| E    | `needs_changes`: E-2 → E-1 → E-3 → E-2 closes a cycle. Reject arbitrary reversal/removal; regroup the mutually dependent scope or redesign responsibilities with evidence.                                                                               |
| F    | Current and proposed states remain `needs_changes` while owner approval is pending. Preserve NOT-582/583, criteria, and completed discovery. Preview both contract/body corrections; require authorized application and fresh readback before readiness. |
| G    | `needs_changes`: NOT-583 → NOT-582 remains necessary because Acceptance requires the actual absent producer, even with agreed v1.                                                                                                                        |
| H    | `needs_changes`: the edge is justified but cycle verification is unknown because pagination is incomplete. Return a labeled preview only.                                                                                                                |

All eight decisions meet the evaluator rubric. The evaluator found no substantive instruction
contradiction for these cases. It performed no provider calls, writes, tests, graph-helper
execution, or dispatches. These are synthetic coordination reviews, not full creation runs or
evidence that the real NOT-582/583 records were inspected or repaired.

A focused follow-up on F after clarifying early existing-project routing confirmed that the
review reaches a correction preview without creation metadata or invented source authority.
It retained `needs_changes`, preserved criteria/discovery, and did not import B's approval into F.

## Repository and structural checks

- `bun test .`: 164 passed, 0 failed (including project-graph and unchanged Maestro tests).
- `bun run test:scripts`: 14 passed, 0 failed.
- `bun run test:meta`: 105 passed, 0 failed.
- `bun test ./.claude/hooks/tests`: 24 passed, 0 failed.
- `bun run lint`, `bun run fmt:check`, `bun run check:runtime`, `bun run check:codex-agents`,
  `bun run check:workflow`, `bun run check:duplication`: passed.
- Both marketplace registries parsed; `git diff --check` passed.
- Direct assertions against `validateProjectGraph`: edge-free issues stay edge-free;
  E-2 → E-1 is retained; existing E-1 → E-3 → E-2 is acyclic; adding E-2 → E-1 throws `CYCLE`.
  The helper remains structural and does not judge coordination prose.

Canonical agent changes were regenerated only into this workspace's `.codex/agents` with
`bun run sync:codex-agents`; no installed agents or plugin caches were changed.

The generic `skill-creator/scripts/quick_validate.py` rejects this repository's existing
`model`, `effort`, and `argument-hint` frontmatter extensions. All four touched skills produce
the same diagnostic and exit code on the candidate and unmodified HEAD. Repository-specific
frontmatter tests pass; the generic validator incompatibility is not silently reported as a pass.

## Limits and handoff

This is one offline evaluation pass, not a reliability estimate or live provider integration
test. Semantic detection stays in upstream drafting/review instructions. No new runtime gate,
file lock, scheduling registry, or graph schema was added. Existing-project revisions produce
read-only correction previews; they do not automatically apply changes to Linear.

No Linear records, ticket dependencies, Maestro runtime, PLC agents, or installed caches were
changed. No push, merge, or release was performed. Human acceptance and manual merge remain
required.
