---
name: linear-devotee:plan
description: Use when planning implementation for a Linear issue after greet or from an issue id. Loads or rebuilds greet context, resolves source spec, drafts and audits a plan, flags drift, writes a validated plan artifact, then syncs accepted spec drift only after validation. Never writes implementation code.
allowed-tools: Read, Glob, Grep
---

# linear-devotee:plan

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `linear-devotee:devotee` with `SUMMARY: <≤15 words, in the user's language>` and print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify git repo. Capture `PROJECT_ROOT = $(git rev-parse --show-toplevel)`.
   - Ensure `${PROJECT_ROOT}/docs/linear-devotee/plan/`.
   - Detect issue id from argument, branch, state file, or recent greet context. Ask if absent.
   - Verify Linear access only when greet context must be rebuilt.
2. Load context:
   - Prefer `${CLAUDE_PLUGIN_ROOT}/data/greet-<ISSUE_ID>.json`.
   - If missing, dispatch `linear-devotee:issue-context` with issue id, git root, `NEEDS_STATUS_METADATA: true`.
   - Do not fetch full Linear context in main context unless delegation fails.
3. Resolve source spec:
   - Use `spec_file` from greet context if it still exists.
   - Otherwise search `docs/acid-prophet/specs/`, choosing only unambiguous matches:
     1. `linear-project:` equals issue project id.
     2. Spec body contains exact issue id.
     3. Body or filename matches project slug/name.
   - Ask if multiple candidates; use `_none_` if none.
4. Draft plan artifact at `${PROJECT_ROOT}/docs/linear-devotee/plan/<ISSUE_ID>.md`:
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
   - **Context** — 1–3 sentences linking issue + spec, read by user + auditor.
   - **Files** — bulleted paths + one-line role each, used by auditor for existence-grep and by implementing agent for edit scope.
   - **Steps** — atomic verifiable actions as `- [ ]` checkboxes; each step is one edit + an inline verify command when possible.
   - **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
   - **Risks** — uncertainty surfaced for the auditor.
   - **Out of scope** — negative oracle preventing implementing-agent drift.

   Planning state only — never implementation code.
5. Audit:
   - Dispatch `linear-devotee:plan-auditor` with project root, spec file, issue brief, project plan context, and implementation plan.
   - Expected output: `PLAN_REVIEW`, `SPEC_DRIFT_DETECTED`, `DRIFT_ITEMS`, `BLOCKERS`.
6. Iterate:
   - If review needs changes, revise artifact and repeat audit.
   - Ask one user-decision blocker at a time.
   - Show drift beside the plan; do not patch spec yet.
   - Ask `Validate this plan? (y / edit / stop)`.
7. After validation:
   - Set plan `status: validated`, update `validated-at`, increment `plan-version` if revised.
   - If drift exists and spec exists, preview compact patch summary and ask `sync accepted drift into the Acid Prophet spec? (y / skip)`.
   - On `y`, patch spec once, update `last-reviewed`, set `spec-synced-at`, and run `acid-prophet:scry` if available.
   - On `skip`, leave `spec-synced-at: _none_` and report the waiver/blocker clearly.
8. Handoff:
   - Never start implementation.
   - End with implementation-ready, blocked, or stopped status.

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
- Mutate Linear issues, projects, or milestones.
- Patch an Acid Prophet spec before explicit plan validation.
- Hide drift.
- Run `git push`, `git commit`, or `git rebase`.
