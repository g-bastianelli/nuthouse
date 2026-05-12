---
name: linear-devotee:plan
description: Use in Codex when planning implementation for a Linear issue after greet or from an issue id. Loads/rebuilds greet context, resolves source spec, audits a plan, flags drift, writes a validated plan artifact, then syncs accepted spec drift only after validation. Never writes implementation code.
---

# Linear Devotee Plan for Codex

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, ask the cheapest available delegation path for one decorative line via `linear-devotee/shared/persona-line-contract.md` with `SUMMARY: <≤15 words, in the user's language>`; otherwise skip. Never block.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions:
   - Verify git repo. Capture `PROJECT_ROOT = $(git rev-parse --show-toplevel)`.
   - Ensure `${PROJECT_ROOT}/docs/linear-devotee/plan/`.
   - Detect issue id from argument, branch, or recent greet context; ask if absent.
3. Load context:
   - Prefer `linear-devotee/data/greet-<ISSUE_ID>.json`.
   - If missing, rebuild via read-only issue-context delegation with issue id, repo root, and `NEEDS_STATUS_METADATA: true`.
4. Resolve source spec:
   - Use greet `spec_file` if it exists.
   - Otherwise search `docs/acid-prophet/specs/` with priority: `linear-project:` project id, exact issue id, project slug/name.
   - Ask if ambiguous; use `_none_` if none.
5. Draft/update `${PROJECT_ROOT}/docs/linear-devotee/plan/<ISSUE_ID>.md`:
   ```markdown
   ---
   issue: <ISSUE_ID>
   spec: <SPEC_FILE | _none_>
   status: draft
   plan-version: 1
   validated-at: _none_
   spec-synced-at: _none_
   ---

   # Plan — <ISSUE_TITLE> (<ISSUE_ID>)

   ## Context

   ## Files

   ## Steps

   ## Verify

   ## Risks

   ## Out of scope
   ```
   AI-agent-optimized format. Each section serves a distinct consumer:
   - **Context** — 1–3 sentences linking issue + spec, read by user + reviewer.
   - **Files** — bulleted paths + one-line role each, used by reviewer for existence-grep and by implementing agent for edit scope.
   - **Steps** — atomic verifiable actions as `- [ ]` checkboxes; each step is one edit + an inline verify command when possible.
   - **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
   - **Risks** — uncertainty surfaced for the reviewer.
   - **Out of scope** — negative oracle preventing implementing-agent drift.

   Planning state only — never implementation code.
6. Review:
   - Delegate to cheap read-only reviewer when available, passing repo root, spec file, issue brief, project context, and plan markdown.
   - Required result: `PLAN_REVIEW`, `SPEC_DRIFT_DETECTED`, `DRIFT_ITEMS`, `BLOCKERS`.
7. Iterate:
   - Revise plan and re-review until pass or user-decision blocker.
   - Ask blockers one at a time.
   - Show drift; do not patch spec before validation.
   - Ask `Validate this plan? (y / edit / stop)`.
8. After validation:
   - Set `status: validated`, `validated-at`, and version.
   - If accepted drift exists and spec exists, preview patch summary and ask `sync accepted drift into the Acid Prophet spec? (y / skip)`.
   - On `y`, patch spec once, update `last-reviewed`, set `spec-synced-at`, and run `acid-prophet:scry` if available.
9. Handoff:
   - Never start implementation.
   - End as implementation-ready, blocked, or stopped.

## Final Report

```text
linear-devotee:plan report
  Issue:           <id>
  Plan artifact:   <path>
  Spec:            <path | _none_>
  Plan review:     pass | needs_changes | skipped
  Drift:           yes | no
  Spec sync:       applied | skipped | n/a
  Hand-off:        implementation_ready | blocked | stopped
```

## Never

- Write implementation code.
- Mutate Linear.
- Patch specs before explicit plan validation.
- Hide drift.
- Run `git push`, `git commit`, or `git rebase`.
