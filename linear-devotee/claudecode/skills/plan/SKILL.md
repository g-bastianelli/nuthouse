---
name: linear-devotee:plan
description: Use when planning implementation for a Linear issue after greet or from an issue id. Loads or rebuilds greet context, resolves source spec, drafts and audits a plan, flags drift, writes a validated plan artifact, then syncs accepted spec drift only after validation. Never writes implementation code.
effort: high
allowed-tools: Read, Glob, Grep
context_policy: session
---

# linear-devotee:plan

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

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
4. Dispatch `linear-devotee:plan-writer` with the six plan sections fully drafted:
   - **Context** — 1–3 sentences linking issue + spec.
   - **Files** — bulleted paths + one-line role each.
   - **Steps** — atomic verifiable actions as `- [ ]` checkboxes; each step is one edit + an inline verify command when possible.
   - **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
   - **Risks** — uncertainty surfaced for the auditor.
   - **Out of scope** — negative oracle preventing implementing-agent drift.

   Input format:
   ```
   PROJECT_ROOT: <git root>
   ISSUE_ID: <id>
   ISSUE_TITLE: <title>
   SPEC_FILE: <path | _none_>
   CONTEXT: <content>
   FILES:
   - path/to/file.ts — role
   STEPS:
   - [ ] step
   VERIFY:
   - command
   RISKS:
   - item
   OUT_OF_SCOPE:
   - item
   ```

   Capture the returned `PLAN_FILE: <path>`. Use this path in all subsequent steps.
   Do not display plan content in main context — the file is the artifact.
5. Audit:
   - Session store (`context_policy: session`): if `$CLAUDE_SESSION_ID` is set, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`. If `relevant_files` key is present (and `_meta._shas.relevant_files` equals HEAD sha when Bash is available; otherwise accept as-is), inject it into the plan-auditor prompt. Skip this lookup when invoked with `--fresh`.
   - **Staleness caveat**: this skill lacks Bash, so the sha of `relevant_files` cannot be verified against HEAD. If the codebase changed significantly since `greet` ran (e.g. several commits), invoke with `--fresh` to force a full re-fetch and ignore the cached list.
   - Dispatch `linear-devotee:plan-auditor` with:
     ```
     PROJECT_ROOT: <git root>
     SPEC_FILE: <path | _none_>
     PLAN_FILE: <PLAN_FILE from step 4>
     ISSUE_CONTEXT_BRIEF:
     <brief>

     PROJECT_PLAN_CONTEXT:
     <context | _none_>

     RELEVANT_FILES:
     - <abs path> (omit section when not available from session store)
     ```
   - Expected output: `PLAN_REVIEW`, `SPEC_DRIFT_DETECTED`, `DRIFT_ITEMS`, `BLOCKERS`.
6. Iterate:
   - If review needs changes, re-dispatch `plan-writer` with revised sections and re-audit. Never display plan content inline.
   - Ask one user-decision blocker at a time.
   - Show drift summary (from audit output); do not patch spec yet.
   - Print `Plan written to: <PLAN_FILE>` then ask `Validate this plan? (y / edit / stop)`.
   - On `edit`: instruct the user to edit `<PLAN_FILE>` directly, then re-dispatch plan-auditor on the same path.
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
