---
name: plan
description: Use when planning implementation for a Linear issue after greet or from an issue id. Loads or rebuilds greet context, resolves source spec, drafts and audits a plan, flags drift, writes a validated plan artifact, then syncs accepted spec drift only after validation. Never writes implementation code.
argument-hint: [issue-id] [--fresh]
effort: xhigh
allowed-tools: Read, Glob, Write, Agent
---

# linear-devotee:plan

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Context

> Auto-injected on Claude Code at skill load. If the lines below show literal `` !`...` `` text, run those commands manually before step 1.

- Greet context dir listing: !`ls "${CLAUDE_PLUGIN_DATA}" 2>/dev/null | head -20`

## Workflow

1. Preconditions:
   - Verify git repo. Capture `PROJECT_ROOT = $(git rev-parse --show-toplevel)`.
   - Ensure `${PROJECT_ROOT}/docs/linear-devotee/plan/`.
   - Detect issue id from `$ARGUMENTS` first, then branch, state file, or recent greet context. Ask if absent.
   - Verify Linear access only when greet context must be rebuilt.
2. Load context:
   - Prefer `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json` (the `## Context` dir listing shows whether it exists).
   - If missing, dispatch `linear-devotee:issue-context` with issue id, git root, `NEEDS_STATUS_METADATA: true`.
   - Do not fetch full Linear context in main context unless delegation fails.
3. Resolve source spec:
   - Use `spec_file` from greet context if it still exists.
   - Otherwise search `docs/acid-prophet/specs/`, choosing only unambiguous matches:
     1. `linear-project:` equals issue project id.
     2. Spec body contains exact issue id.
     3. Body or filename matches project slug/name.
   - Ask if multiple candidates; use `_none_` if none.
4. Draft the six plan sections, then write the artifact yourself with `Write`:
   - **Context** — 1–3 sentences linking issue + spec.
   - **Files** — bulleted paths + one-line role each.
   - **Steps** — atomic verifiable actions as `- [ ]` checkboxes; each step is one edit + an inline verify command when possible.
   - **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
   - **Risks** — uncertainty surfaced for the auditor.
   - **Out of scope** — negative oracle preventing implementing-agent drift.

   Write the file to `PLAN_FILE = ${PROJECT_ROOT}/docs/linear-devotee/plan/<ISSUE_ID>.md` (overwrite silently if it exists) with exactly this shape — sections verbatim from the draft, `_unclear_` for any missing section:

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

   <CONTEXT>

   ## Files

   <FILES>

   ## Steps

   <STEPS>

   ## Verify

   <VERIFY>

   ## Risks

   <RISKS>

   ## Out of scope

   <OUT_OF_SCOPE>
   ```

   Use `PLAN_FILE` in all subsequent steps.
   Do not re-print the plan content in chat after writing — the file is the artifact.

5. Audit:
   - Session store: if `$CLAUDE_SESSION_ID` is set, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`. If `relevant_files` key is present (and `_meta._shas.relevant_files` equals HEAD sha when Bash is available; otherwise accept as-is), inject it into the plan-auditor prompt. Skip this lookup when `$ARGUMENTS` contains `--fresh`.
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
   - If review needs changes, rewrite `<PLAN_FILE>` with the revised sections (same artifact shape as step 4) and re-audit. Never display plan content inline.
   - Ask one user-decision blocker at a time.
   - Show drift summary (from audit output); do not patch spec yet.
   - Print `Plan written to: <PLAN_FILE>` then ask `Validate this plan? (y / edit / stop)`.
   - On `edit`: instruct the user to edit `<PLAN_FILE>` directly, then re-dispatch plan-auditor on the same path.
7. After validation:
   - Set plan `status: validated`, update `validated-at`, increment `plan-version` if revised.
   - If drift exists and spec exists, preview compact patch summary and ask `sync accepted drift into the Acid Prophet spec? (y / skip)`.
   - On `y`, patch spec once, update `last-reviewed`, set `spec-synced-at`, and run `acid-prophet:audit-spec` if available.
   - On `skip`, leave `spec-synced-at: _none_` and report the waiver/blocker clearly.
8. Handoff:
   - Never start implementation yourself.
   - On `implementation_ready`, present a hand-off menu (try a `warden:voice` line first):

     ```
     <voice line — linear-devotee>
     (i) implement → start the implementation turn (recommended)
     (c) commit    → git-gremlin:commit
     (s) stop
     ```

   - On `(i)`, hand the artifacts to the implementation turn. Emit this directive to the implementing agent: read every provided artifact before writing code, honor the repo's `AGENTS.md`/`CLAUDE.md`, let the `subroutine` discipline skills activate on matching files, and close with `moon-moth:verify` when a `.moon` workspace is present. Pass the full planning context as named fields:

     ```
     PLAN_FILE: <PLAN_FILE from step 4>
     SPEC_FILE: <path from step 3 | _none_>
     ISSUE_ID: <issue id>
     RELEVANT_FILES:
     - <abs path>  (the issue-context brief already verified these; from the session store / greet context — omit the section only when genuinely unavailable)
     ```

     so the implementation turn inherits the plan's Files / Steps / Verify, the source spec, and the already-verified relevant files instead of re-planning blind. The implementation turn follows `<PLAN_FILE>`'s Files / Steps / Verify in order as the authoritative plan and runs its Verify commands before reporting. Do not pre-write any code inside this skill.

   - On `blocked` or `stopped` status, skip the menu and report the reason — never offer implement while blockers remain.

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
