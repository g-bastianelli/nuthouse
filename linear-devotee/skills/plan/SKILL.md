---
name: plan
description: Use when planning implementation for a Linear issue after greet or from an issue id. Loads the greet context and source artifacts, writes the issue plan, audits it, and hands the validated plan to the implementation turn by absolute path. Never writes implementation code.
argument-hint: "[issue-id] [--fresh]"
effort: xhigh
allowed-tools: Read, Glob, Write, Agent, Bash(git rev-parse:*), mcp__claude_ai_Linear__get_issue
---

# linear-devotee:plan

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Greet context dir listing: !`ls "${CLAUDE_PLUGIN_DATA}" 2>/dev/null | head -20`

## Workflow

1. Preconditions:
   - Verify git repo. Capture `PROJECT_ROOT = $(git rev-parse --show-toplevel)`.
   - Ensure `${PROJECT_ROOT}/docs/linear-devotee/plan/`.
   - Detect issue id from `$ARGUMENTS` first, then branch, state file, or recent greet context. Ask if absent.
   - Verify Linear access when greet context must be rebuilt or project-id fallback is needed.
2. Load context:
   - Prefer `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json` (the `## Context` dir listing shows whether it exists).
   - If missing, dispatch the logical `linear-devotee:issue-context` agent with issue id,
     git root, `NEEDS_STATUS_METADATA: true`.
   - Do not fetch full Linear context in main context unless delegation fails.
   - Extract `linear_project_id` from the greet context or issue-context brief. If it is
     missing or `_unclear_`, fetch the current issue with `mcp__claude_ai_Linear__get_issue`
     and extract only its project id for plan traceability. Planning never reads Maestro
     control and never owns project execution.
3. Resolve source spec:
   - Treat `spec_file` from greet context as a candidate when it still exists, then
     confirm it against the same authority rules below.
   - Search `docs/acid-prophet/specs/` and choose only unambiguous matches, in this
     priority order:
     1. An explicit repository-relative spec path named by the issue context or Linear
        issue, provided it resolves to an existing file inside the specs directory.
     2. A spec body containing the exact issue id.
     3. A spec whose `linear-project:` equals the issue project id.
     4. A body or filename matching the project slug/name.
   - Never let a cached or newly discovered project-id match override an explicit issue
     source. Require the selected `SPEC_FILE` to exist and be readable before continuing.
   - Ask if multiple candidates; use `_none_` if none.
4. Resolve project plan authority:
   - Prefer `project_plan` from greet and require its path to still exist and be readable.
     Otherwise search `docs/acid-prophet/plans/**/plan.md` for exactly one frontmatter
     `spec:` equal to the repository-relative `SPEC_FILE`. Similar names, shared AC ids,
     and prior `docs/linear-devotee/plan/` artifacts are not authoritative matches.
   - When one match exists, the project plan remains architecture authority. Read it
     into `PROJECT_PLAN_CONTEXT`, require the issue plan to reference rather than restate
     its architecture decisions, and block validation on any architecture conflict.
   - When no exact match exists, record `_none_`; never recreate project architecture
     from the source spec or conversation. Multiple exact matches are ambiguous and
     block before drafting.
5. Draft the seven plan sections, then write the artifact yourself with `Write`:
   - **Context** — 1–3 sentences linking issue + spec.
   - **Files** — bulleted paths + one-line role each.
   - **Acceptance traceability** — extract the issue's source `AC-###` and issue-local `AC-L###` ids and map each one to concrete plan steps plus verification evidence. Preserve both namespaces exactly; if the issue has no ids, use `_unclear_` and let the auditor block instead of inventing ids.
   - **Steps** — dependency-ordered, atomic actions as `- [ ]` checkboxes; each step is one edit plus an inline verify command and `covers: <AC-### / AC-L### list | foundation>`.
   - **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
   - **Risks** — uncertainty surfaced for the auditor.
   - **Out of scope** — negative oracle preventing implementing-agent drift.

   Write the file to `PLAN_FILE = ${PROJECT_ROOT}/docs/linear-devotee/plan/<ISSUE_ID>.md` (overwrite silently if it exists) with exactly this shape — sections verbatim from the draft, `_unclear_` for any missing section:

   ```markdown
   ---
   issue: <ISSUE_ID>
   linear-project: <LINEAR_PROJECT_ID>
   spec: <SPEC_FILE | _none_>
   status: draft
   plan-version: 1
   acceptance-ids: [AC-001, AC-L001]
   validated-at: _none_
   spec-synced-at: _none_
   ---

   # Plan — <ISSUE_TITLE> (<ISSUE_ID>)

   ## Context

   <CONTEXT>

   ## Files

   <FILES>

   ## Acceptance traceability

   - `AC-001` → steps 2, 3 · verify: <command or observation>
   - `AC-L001` → step 4 · verify: <command or observation>

   ## Steps

   <STEPS — each checkbox includes an indented `verify:` line and `covers: AC-### | AC-L### | foundation` line>

   ## Verify

   <VERIFY>

   ## Risks

   <RISKS>

   ## Out of scope

   <OUT_OF_SCOPE>
   ```

   Use `PLAN_FILE` in all subsequent steps.
   Do not re-print the plan content in chat after writing — the file is the artifact.

6. Audit:
   - Session store: if `$CLAUDE_SESSION_ID` is set, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`. When `relevant_files` exists, run `git rev-parse HEAD` and inject it into the plan-auditor prompt only when `_meta._shas.relevant_files` exactly equals that SHA. On a missing/mismatched SHA, omit `RELEVANT_FILES` and report the cache as stale. Skip this lookup when `$ARGUMENTS` contains `--fresh`.
   - Dispatch the logical `linear-devotee:plan-auditor` agent with:

     ```
     PROJECT_ROOT: <git root>
     SPEC_FILE: <path | _none_>
     PLAN_FILE: <PLAN_FILE from step 5>
     ISSUE_CONTEXT_BRIEF:
     <brief>

     PROJECT_PLAN_CONTEXT:
     <context | _none_>

     RELEVANT_FILES:
     - <abs path> (omit section when not available from session store)
     ```

   - Expected output: `PLAN_REVIEW`, `SPEC_DRIFT_DETECTED`, `DRIFT_ITEMS`, `BLOCKERS`.

7. Apply the validation gate:
   - If review needs changes, rewrite `<PLAN_FILE>` with the revised sections (same artifact shape as step 5) and re-audit. Never display plan content inline.
   - Ask one user-decision blocker at a time.
   - Show drift summary (from audit output); do not patch spec yet.
   - A clean audit means the exact complete result `PLAN_REVIEW: pass`,
     `SPEC_DRIFT_DETECTED: no`, `DRIFT_ITEMS: - none`, and `BLOCKERS: - none`.
   - Print `Plan written to: <PLAN_FILE>` followed by
     `Validate this plan? (y / edit / stop)`. This gate is the user's validation point and
     is never skipped.
   - No project control record may bypass validation, and an auditor BLOCKER always
     stops validation.
   - On `edit`: instruct the user to edit `<PLAN_FILE>` directly, then re-dispatch plan-auditor on the same path.
8. After validation:
   - Set plan `status: validated`, update `validated-at`, increment `plan-version` if revised.
   - If drift exists and spec exists, preview compact patch summary and ask `sync accepted drift into the Acid Prophet spec? (y / skip)`.
   - On `y`, patch spec once, update `last-reviewed`, set `spec-synced-at`, and run `acid-prophet:audit-spec` if available.
   - On `skip`, leave `spec-synced-at: _none_` and report the waiver/blocker clearly.
9. Handoff:
   - Never start implementation yourself.
   - On `implementation_ready`, present a hand-off menu:

     ```
     <voice line — linear-devotee>
     (i) implement → start the implementation turn (recommended)
     (c) commit    → git-gremlin:commit
     (s) stop
     ```

   - On `(i)`, hand the artifacts to the implementation turn. Emit this directive to the
     implementing agent: read every provided artifact before writing code, honor the
     repo's `AGENTS.md`/`CLAUDE.md`, and let the `subroutine` discipline skills activate on
     matching files. Pass the planning context as bare absolute paths:

     ```
     ISSUE_DELIVERY_PACKET:
       ISSUE:          <issue id>
       PLAN_FILE:      <abs path>
       SPEC_FILE:      <abs path> | _none_
       PROJECT_PLAN:   <abs path> | _none_
       RELEVANT_FILES: [<abs path>, ...]
     ```

     so the implementation turn inherits the plan's Files / Steps / Verify, the source spec,
     and the relevant files instead of re-planning blind. The implementation turn follows
     `<PLAN_FILE>`'s Files / Steps in order as the authoritative plan, then passes its
     Verify requirements to the verifier. Do not pre-write any code inside this skill.

   - On `blocked` or `stopped` status, skip the menu and report the reason — never offer implement while blockers remain.

## A handoff names only artifacts that exist

**AN ARTIFACT IS NAMED IN THE PACKET ONLY AFTER ITS PATH RESOLVED ON DISK.**

| Excuse                          | Reality                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| "I wrote the plan a moment ago" | A moment ago is before the last edit. Open the path again.      |
| "The path looks right"          | A path that looks right and does not resolve is a dead handoff. |
| "The implementer will find it"  | An implementer handed a dead path re-plans blind.               |

Refuse the handoff when a named artifact is absent, unreadable, or outside the
repository. `RELEVANT_FILES` are mutable implementation targets: naming them establishes
what the implementer starts from, not a promise their bytes stay unchanged.

## Final Report

```text
linear-devotee:plan report
  Issue:           <id>
  Plan artifact:   <path>
  Spec:            <path | _none_>
  Project plan:    <path | _none_>
  Plan review:     pass | needs_changes | skipped
  Drift:           yes | no
  Spec sync:       applied | skipped | n/a
  Hand-off:        implementation_ready | blocked | stopped
```

**REQUIRED SUB-SKILL:** after implementation, use `moon-moth:verify`

## Never

- Write implementation code.
- Mutate Linear issues, projects, or milestones.
- Patch an Acid Prophet spec before explicit plan validation.
- Hide drift.
- Run `git push`, `git commit`, or `git rebase`.
