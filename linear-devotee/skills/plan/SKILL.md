---
name: plan
description: Use when planning implementation for a Linear issue after greet or from an issue id. Loads the authoritative issue-delivery decision and source artifacts, creates the profile-appropriate issue plan, audits it, and emits a named hash-bound implementation handoff. Never writes implementation code.
argument-hint: "[issue-id] [--fresh]"
effort: xhigh
allowed-tools: Read, Glob, Write, Agent, Bash(git rev-parse:*), Bash(cat:*), Bash(node:*), mcp__claude_ai_Linear__get_issue
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# linear-devotee:plan

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

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
3. Resolve workflow decision:
   - Require the greet context's named `workflow_decision` to contain exactly `run_id`,
     absolute manifest `path`, and `content_hash`, plus a separate top-level
     `effective_profile`. Validate only that closed three-field handoff through this
     plugin's install-local `lib/workflow/index.mjs` consumer before using it. A valid
     manifest is reused without reclassification.
   - When rebuilding context without a handoff, perform at most one authoritative
     explicit-skill resolution and persist it before planning. Do not require Warden and
     never infer a profile from prose.
   - Require `workflow: issue-delivery`, a non-blocked decision, matching policy/content
     hashes, and `effectiveProfile` equal to the context's `effective_profile`. Set
     `EFFECTIVE_PROFILE = quick | standard | strict`; any disagreement blocks planning.
   - When greet context contains `parent_workflow_baton`, require its exact
     `workflow_run_id`, `workflow_profile`, and `workflow_decision_hash` fields, retain
     them unchanged as `PARENT_WORKFLOW_BATON`, and require `EFFECTIVE_PROFILE` to be not
     lower than the parent profile. This ancestry does not replace or validate the
     child-local manifest. Record `_none_` outside relay mode.
4. Resolve source spec:
   - Treat `spec_file` from greet context as a candidate when it still exists, then
     confirm it against the same authority rules below; do not blindly reuse a cached
     project-level kernel as the issue's source acceptance document.
   - Search `docs/acid-prophet/specs/` and choose only unambiguous matches, in this
     priority order:
     1. An explicit repository-relative spec path named by the issue context or Linear
        issue, provided it resolves to an existing file inside the specs directory.
     2. A spec body containing the exact issue id.
     3. A spec whose `linear-project:` equals the issue project id. When that match is a
        workflow kernel that explicitly delegates the resolved `issue-delivery`
        workflow to exactly one existing repository-relative path, select that
        issue-delivery child spec instead of the kernel.
     4. A body or filename matching the project slug/name.
   - Select the child spec before drafting, auditing, or entering any strict evidence
     gate. The parent kernel remains the governing authority through the validated
     workflow decision; it is not `SPEC_FILE` for drift/checklist evaluation.
   - Never let a cached or newly discovered project-id match override an explicit issue
     source or the kernel's unambiguous workflow-child delegation. Re-hash the final
     selected spec before continuing.
   - Ask if multiple candidates; use `_none_` if none.
5. Resolve project plan authority:
   - Prefer `project_plan` from greet and re-hash its exact bytes. Otherwise search
     `docs/acid-prophet/plans/**/plan.md` for exactly one frontmatter `spec:` equal to the
     repository-relative `SPEC_FILE`. Similar names, shared AC ids, and prior
     `docs/linear-devotee/plan/` artifacts are not authoritative matches.
   - When one match exists, the project plan remains architecture authority. Read it
     into `PROJECT_PLAN_CONTEXT`, require the issue plan to reference rather than restate
     its architecture decisions, and block validation on any architecture conflict.
   - When no exact match exists, record `_none_`; never recreate project architecture
     from the source spec or conversation. Multiple exact matches are ambiguous and
     block before drafting.
6. Draft the seven plan sections, then write the artifact yourself with `Write`:
   - **Context** — 1–3 sentences linking issue + spec.
   - **Files** — bulleted paths + one-line role each.
   - **Acceptance traceability** — extract the issue's source `AC-###` and issue-local `AC-L###` ids and map each one to concrete plan steps plus verification evidence. Preserve both namespaces exactly; if the issue has no ids, use `_unclear_` and let the auditor block instead of inventing ids.
   - **Steps** — dependency-ordered, atomic actions as `- [ ]` checkboxes; each step is one edit plus an inline verify command and `covers: <AC-### / AC-L### list | foundation>`.
   - **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
   - **Risks** — uncertainty surfaced for the auditor.
   - **Out of scope** — negative oracle preventing implementing-agent drift.
   - For `quick`, keep Context, Files, and Steps compact but preserve every required
     section, acceptance id, verification command, and immutable gate. `standard` and
     `strict` use the full issue-level plan shape below.

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

7. Audit:
   - Session store: if `$CLAUDE_SESSION_ID` is set, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`. When `relevant_files` exists, run `git rev-parse HEAD` and inject it into the plan-auditor prompt only when `_meta._shas.relevant_files` exactly equals that SHA. On a missing/mismatched SHA, omit `RELEVANT_FILES` and report the cache as stale. Skip this lookup when `$ARGUMENTS` contains `--fresh`.
   - Dispatch the logical `linear-devotee:plan-auditor` agent with:

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

8. Apply the profile-specific validation gate:
   - If review needs changes, rewrite `<PLAN_FILE>` with the revised sections (same artifact shape as step 6) and re-audit. Never display plan content inline.
   - Ask one user-decision blocker at a time.
   - Show drift summary (from audit output); do not patch spec yet.
   - A clean audit means the exact complete result `PLAN_REVIEW: pass`,
     `SPEC_DRIFT_DETECTED: no`, `DRIFT_ITEMS: - none`, and `BLOCKERS: - none`.
   - For `quick`, a compact plan may auto-validate only on that exact clean result. Any
     drift, blocker, unresolved question, malformed auditor output, missing hash, or
     failed gate disables auto-validation and requires correction, user review, or safe
     profile escalation.
   - For `standard`, require the audited issue-level plan before implementation and
     print `Plan written to: <PLAN_FILE>` followed by
     `Validate this plan? (y / edit / stop)`.
   - For `strict`, apply the same explicit validation gate as standard before the Acid
     Prophet evidence step below.
   - No project control record may bypass validation, and an auditor BLOCKER always
     stops validation.
   - On `edit`: instruct the user to edit `<PLAN_FILE>` directly, then re-dispatch plan-auditor on the same path.
9. After validation:
   - Set plan `status: validated`, update `validated-at`, increment `plan-version` if revised.
   - If drift exists and spec exists, preview compact patch summary and ask `sync accepted drift into the Acid Prophet spec? (y / skip)`.
   - On `y`, patch spec once, update `last-reviewed`, set `spec-synced-at`, and run `acid-prophet:audit-spec` if available.
   - On `skip`, leave `spec-synced-at: _none_` and report the waiver/blocker clearly.
10. Collect strict evidence:

- When `EFFECTIVE_PROFILE` is `strict`, require a source spec and invoke
  `acid-prophet:check-drift` in strict issue-delivery mode with `PLAN_FILE`,
  `SPEC_FILE`, the exact three-field `WORKFLOW_DECISION`, and the separate
  `EFFECTIVE_PROFILE: strict`. It must return named `DRIFT_EVIDENCE` bound to the exact
  plan/spec/decision content hashes. Confirmed drift, ambiguity, stale hashes, or
  unavailable evidence blocks implementation; never patch the spec here.
- After clean drift evidence, invoke `acid-prophet:write-checklist` in strict
  issue-delivery mode with `PLAN_FILE`, `SPEC_FILE`, `WORKFLOW_DECISION`, and the exact
  clean `DRIFT_EVIDENCE: { path: <abs path>, content_hash: sha256:<hex>, status: clean }`
  returned by the prior gate. Re-hash the drift artifact before dispatch and require the
  checklist result to bind the same plan/spec/decision/drift hashes. Require an open
  source-derived `CHECKLIST_EVIDENCE` artifact whose acceptance ids exactly cover the
  active source criteria and whose `content_hash` matches its bytes. Checklist
  derivation is not human feature acceptance.
- `quick` and `standard` record `DRIFT_EVIDENCE: n/a` and
  `CHECKLIST_EVIDENCE: n/a`; they do not impersonate Acid Prophet evidence.

11. Handoff:

- Never start implementation yourself.
- On `implementation_ready`, present a hand-off menu (try a `warden:voice` line first):

  ```
  <voice line — linear-devotee>
  (i) implement → start the implementation turn (recommended)
  (c) commit    → git-gremlin:commit
  (s) stop
  ```

- Before offering `(i)`, compute canonical `sha256:` hashes from the final bytes of
  the issue plan, source spec, every relevant file, project plan when present, and
  strict evidence when required. Refuse the handoff if a named artifact is absent,
  changed, outside the repository/plugin-data authority boundary, or has a content
  hash mismatch. The plan/spec/project-plan/decision/evidence entries are immutable
  inputs. `RELEVANT_FILES` are mutable implementation targets: their hashes establish
  pre-implementation provenance and are emitted as `before_hash`, not as a promise that
  their bytes remain unchanged after implementation.
- On `(i)`, hand the artifacts to the implementation turn. Emit this directive to the
  implementing agent: read every provided artifact before writing code, honor the
  repo's `AGENTS.md`/`CLAUDE.md`, and let the `subroutine` discipline skills activate on
  matching files. After implementation, **always close through `moon-moth:verify`** with
  the complete issue-delivery packet. Moon Moth owns both branches: it uses affected
  Moon tasks when `.moon/` exists and its repository-native resolver otherwise, and it
  must return named `VERIFICATION_EVIDENCE` before commit or PR can be offered. Never
  replace that closure by running native commands directly in the implementation turn.
  Pass the full planning context as named and hash-bound fields:

  ```
  PLAN_FILE: { path: <PLAN_FILE>, content_hash: sha256:<hex> }
  SPEC_FILE: { path: <path from step 4>, content_hash: sha256:<hex> }
  ISSUE_ID: <issue id>
  RELEVANT_FILES:
  - { path: <abs path>, before_hash: sha256:<hex> }
  WORKFLOW_DECISION: { run_id: <id>, path: <abs manifest path>, content_hash: sha256:<hex> }
  EFFECTIVE_PROFILE: <quick | standard | strict>
  PARENT_WORKFLOW_BATON: { workflow_run_id: <parent id>, workflow_profile: <parent profile>, workflow_decision_hash: sha256:<hex> } | _none_
  PROJECT_PLAN: { path: <abs path>, content_hash: sha256:<hex> } | _none_
  DRIFT_EVIDENCE: { path: <abs path>, content_hash: sha256:<hex> } | n/a
  CHECKLIST_EVIDENCE: { path: <abs path>, content_hash: sha256:<hex> } | n/a
  ```

  so the implementation turn inherits the plan's Files / Steps / Verify, the source spec,
  and the already-verified relevant files instead of re-planning blind. The implementation
  turn follows `<PLAN_FILE>`'s Files / Steps in order as the authoritative plan, then
  passes its Verify requirements to `moon-moth:verify`; only that verifier executes the
  resolved commands and emits the evidence required for reporting. Do not pre-write any
  code inside this skill.

- On `blocked` or `stopped` status, skip the menu and report the reason — never offer implement while blockers remain.

## Final Report

```text
linear-devotee:plan report
  Issue:           <id>
  Plan artifact:   <path>
  Spec:            <path | _none_>
  Project plan:    <path | _none_>
  Workflow:        <run id> · <effective profile> · <decision content hash>
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
