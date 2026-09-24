# Review an existing Linear project

Before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`. Use the existing-work
procedure in `${CLAUDE_PLUGIN_ROOT}/shared/coordination-review.md`.

1. Load current complete affected issue packets, decision sources, project metadata, and dependency
   closure as raw `LINEAR_CONTEXT`.
2. Dispatch `linear-devotee:project-drafter` in `MODE: review` with that snapshot as `DRAFT_FILE`.
   Preserve existing ids as stable draft keys and include repository root, authoritative brief or
   spec, exact active Acceptance register, and every named source artifact.
3. If the project lacks a register, extract active criteria from current issue bodies verbatim.
   Surface conflicting ids or text; do not invent or silently ratify a replacement source.
4. Return evidence-backed current-state findings and one exact correction preview. State plainly
   that corrections remain proposed.
5. Stop. Do not mint replacement refs, enter creation, modify issues/relations, or offer a Maestro
   handoff based on unapplied corrections.
