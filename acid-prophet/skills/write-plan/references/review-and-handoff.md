# Plan review and handoff

Read this before validating, revising, or handing off a plan.

## Review depth

Compare the source against tasks, contracts, and quickstart. Reject unknown or retired ids,
uncovered requirements, incompatible cross-task contracts, cycles, unjustified serialization,
impossible ordering, and checks that observe internals instead of required behavior. Confirm
source and plan versions agree.

For a new boundary, interacting tasks, or material failure/recovery behavior, dispatch a
fresh read-only agent with the spec, draft artifacts, repository root, and constitution
path. Ask it to walk the plan as the implementer and return evidence-backed blockers or an
explicit no-blocker result. Review a small conventional plan locally and report which mode
was used.

Fix evidenced defects and recheck affected relationships. After two failed correction
attempts on the same blocker, leave the draft with the missing evidence or decision.

Present one coherent review with links, choices, and risks. Use delegated technical-planning
authority when it remains inside approved behavior; otherwise obtain approval for the
concrete artifacts. Set `status: validated`, `validated-at`, and the exact source version
only after clean review and resolved decisions. Increment `plan-version` when revising a
previously validated plan.

## Named handoff fields

Return every field required by `../../../shared/plan-format.md`, verifying that each
non-`_none_` path exists and is readable. A draft cannot be handed off as validated.

When `RETURN_TARGET: linear-devotee:create-project` accompanies `SPEC_FILE`, return the
validated fields immediately without restarting its interview or mutating Linear.

For an already requested implementation, hand over the complete artifact set, repository
instructions, applicable `subroutine` discipline, and
`../../../shared/development-drift.md`. The implementer performs drift checkpoints after
each functional block and before a PR, and uses `moon-moth:verify` in a moon workspace.

For a requested Linear breakdown, use **REQUIRED SUB-SKILL:**
`linear-devotee:create-project` with the named artifact fields. Otherwise report the
validated plan and next useful action.
