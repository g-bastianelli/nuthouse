---
name: write-spec
description: Use when starting any project or feature that needs a structured spec before development — asks clarifying questions one at a time, proposes approaches, validates a written spec, then optionally hands off to linear-devotee:create-project for Linear project creation
argument-hint: [feature-or-project-description]
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Agent
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# acid-prophet:write-spec

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid spec-writing gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Do not restate persona tone, vocabulary, or emoji rules here.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Workflow

### Direct-task artifact handoff

When `prepareDirectTask` selects this owner, treat the returned handoff descriptor's exact `input`
object as `DIRECT_TASK_HANDOFF` and consume it before the project-creation contract or the normal
entry-point flow:

```text
DIRECT_TASK_HANDOFF: {
  "schemaVersion": 1,
  "workflow": "direct-task",
  "effectiveProfile": "strict",
  "task": "<exact non-empty request>",
  "scope": <validated direct-task scope>,
  "verification": <ready reliable verification strategy>,
  "decisionHandoff": { "run_id": "<id>", "path": "<absolute path>", "content_hash": "sha256:<64 lowercase hex>" },
  "upstreamArtifacts": [],
  "returnTarget": { "kind": "current-turn", "name": "direct-task" }
}
```

Reject unknown/missing fields, any upstream artifact, any non-strict profile, or simultaneous
project-creation return fields. Import `discoverGitContext` and `consumeManifestHandoff` only from
`${CLAUDE_PLUGIN_ROOT}/lib/workflow/index.mjs`; use the same install-local `bundle.json` source hash
as `policyHash`. Consume `decisionHandoff` against the current Git context without reclassification
or recovery, require the persisted decision to have `workflow === "direct-task"`,
`effectiveProfile === "strict"`, and enabled immutable `verification`, and require the returned
handoff to equal the input descriptor. A stale, expired, corrupt, out-of-scope, drifted, or
mismatched descriptor blocks. Never invoke or require Warden.

Use `task` as the exact spec request and run the normal writing, auditor, ratification, and optional
commit gates. Do not update the workflow manifest: the direct-task preparation owner contract binds
the artifact to the unchanged descriptor. After ratification, hash the exact spec bytes and return
immediately to `returnTarget`, before the generic Linear question, with this consumable object:

```text
DIRECT_TASK_ARTIFACT: {
  "id": "<safe spec id>",
  "path": "<repository-relative spec path>",
  "contentHash": "sha256:<64 lowercase hex>",
  "status": "ratified",
  "audited": true,
  "owner": "acid-prophet:write-spec",
  "decisionHandoff": <exact unchanged DIRECT_TASK_HANDOFF.decisionHandoff>
}
RETURN_TARGET: { "kind": "current-turn", "name": "direct-task" }
```

Return no project inventory and perform no Linear mutation. The caller inserts this exact object as
`artifacts.spec` and resumes `prepareDirectTask` in the same run.

### Project-creation artifact handoff

When the invocation contains project-creation return fields, treat them as one named contract:

```text
WORKFLOW_HANDOFF:
  run_id: <uuid>
  path: <absolute manifest path>
  content_hash: sha256:<64 lowercase hex>
WORKFLOW_EXPIRES_AT: <canonical ISO timestamp>
ARTIFACT_INVENTORY: <canonical JSON array or absolute JSON path>
ARTIFACT_INVENTORY_HASH: sha256:<64 lowercase hex>
REQUESTED_ARTIFACTS: <sorted subset of audited-spec, guided-spec-review>
SPEC_FILE: <candidate spec path | _none_>
ACCEPTANCE_REGISTER: <absolute register path>
ACCEPTANCE_REGISTER_HASH: sha256:<64 lowercase hex>
RETURN_TARGET: linear-devotee:create-project
```

Import `consumeManifestHandoff` and `writeDecisionManifest` only from
`${CLAUDE_PLUGIN_ROOT}/lib/workflow/index.mjs`, use the
install-local `bundle.json` source hash as the consumer policy hash, and require a valid
`project-creation` decision. Reuse that decision without reclassification. Preserve the exact
`run_id`, hash-bound inventory, exact Acceptance register, and explicit return target throughout
the spec interview, audit, and user review. Consume recoverable missing/expired/corrupt/out-of-scope
state with one synchronous `resolveAuthoritatively` plus
`replacement: { expiresAt: <future WORKFLOW_EXPIRES_AT renewed by the canonical 24-hour rule when expired>, artifacts }`; a second fallback, different run,
`runtime-drift`, or return target other than
`RETURN_TARGET: linear-devotee:create-project` blocks the return. Never require Warden.
Malformed descriptors (including a non-schema `content_hash`) block as
`invalid-manifest-handoff`; a schema-valid descriptor whose hash does not match the manifest is
`content-hash-mismatch` and may use the single authoritative recovery above.
Assign the consumed or recovered result to `currentRun` before any artifact read. Parse a
path-backed inventory, validate the closed entry schema, serialize the ordered fields as one
no-whitespace JSON array sorted by `artifact_type`, and verify
`ARTIFACT_INVENTORY_HASH` against only those canonical UTF-8 bytes.

This skill owns `audited-spec` and `guided-spec-review`. Neither is complete merely because a file
exists: `audited-spec` requires the parsed auditor gates to pass, and `guided-spec-review` requires
the user's ratification in step 8. On completion, hash the exact ratified spec bytes, update those
entries in `ARTIFACT_INVENTORY`, attach their id/path/content-hash references to the same decision
manifest through `writeDecisionManifest`, preserving `currentRun.manifest.decision`,
`currentRun.manifest.expiresAt`, and existing artifact refs while passing
`expectedRevision: currentRun.manifest.revision` and
`observedContentHash: currentRun.contentHash`. Assign the refreshed result back to `currentRun` and
return its refreshed `WORKFLOW_HANDOFF`. Do not mark or
return an artifact that failed its owning gate.

1. Preconditions:
   - Verify git repo (`git rev-parse --git-dir`). Warn if not found — repository context and optional commit will be skipped but the trip continues.
2. Explore context:
   - `git log --oneline -10`; list `docs/acid-prophet/specs/` if it exists; read project-root `AGENTS.md` and `CLAUDE.md` when present.
3. Clarifying questions (one per message):
   - Treat `$ARGUMENTS` as the initial feature/project request when non-empty; if empty and no request is evident from the conversation, ask what needs a spec.
   - **Scope check first**: if the request describes multiple independent subsystems, flag and propose decomposition. Each sub-project gets its own trip.
   - Extract: who uses this and why, what problem it uniquely solves, where it fits, constraints (stack, timeline), observable success and definition of done.
   - **Uncertainty rule**: when a section needs a value the user hasn't provided and you cannot infer it from applicable `AGENTS.md`, `CLAUDE.md`, `package.json`, or the codebase — **never invent**. Emit a literal marker `[NEEDS CLARIFICATION: <one-line question>]` inline at that position. The spec is finishable with markers; the auditor will flag each one and the user will resolve them before the spec leaves draft.
   - When `REQUESTED_ARTIFACTS` is present, limit this run to the spec artifacts this skill owns. Keep all clarifications and approvals, but do not open a second project interview or replace the upstream Acceptance register with independently renumbered criteria.
   - If `SPEC_FILE` names an existing candidate, preserve its active Acceptance section and compare it exactly with `ACCEPTANCE_REGISTER_HASH`. For an `audited-spec`-only request, skip the new-spec interview and run the candidate through the current auditor gate; do not claim or run the strict guided-review artifact. If no candidate exists, create one from the supplied brief/register through the normal workflow while preserving every accepted id.
4. Propose 2–3 approaches with trade-offs. Lead with your recommendation. One message for the full option set.
5. Present spec sections one at a time; wait for user approval before the next. Revise on rejection.
   - Sections: Problem & Why, Solution, Architecture, Components / data flow, Error handling, Acceptance, Acceptance history, Testing approach, Non-goals.
   - **Acceptance identity contract**: every criterion is one observable EARS bullet with a stable id:
     ```markdown
     - [AC-001] WHEN <trigger>, THE SYSTEM SHALL <observable behavior>
     - [AC-002] IF <condition>, THE SYSTEM SHALL <observable behavior>
     ```
     Start at `AC-001`, increment by one, and keep ids unique within the spec. Never renumber or reuse an accepted AC id. When a ratified criterion is removed, delete it from `## Acceptance` and append exactly this record under `## Acceptance history`:
     ```markdown
     - [AC-007] retired 2026-08-05 — WHEN <former trigger>, THE SYSTEM SHALL <former behavior> — reason: <why it was retired>
     ```
     Use the retirement date in ISO `YYYY-MM-DD`, preserve the former EARS text verbatim, and require a non-empty reason. If nothing has been retired, write `- None.` under `## Acceptance history`. A retired id remains reserved forever and must not appear in active Acceptance. These ids are the join keys used by plans, checklists, Linear issues, and drift reports.
   - **Keep code minimal**: interfaces, type signatures, short pseudo-code (≤ 15 lines) only. Concrete examples and full implementations belong in Linear issues, not specs.
   - Re-state the uncertainty rule on every section: emit `[NEEDS CLARIFICATION: ...]` rather than guess. A draft spec is allowed to ship with markers; the next steps will surface them.
6. Write spec:
   - Create `docs/acid-prophet/specs/` if missing. Save to `docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md`.
   - Frontmatter required: `id: <slug>`, `status: draft`, `spec-version: 1`, `linear-project: _none_`, `verified-by: _none_`, `last-reviewed: <today ISO>`.
   - Do not commit the draft. The only commit choice comes after the auditor and user ratification gates.
7. Spec-auditor pass:
   - Dispatch the logical `acid-prophet:spec-auditor` agent:
     ```
     SPEC_PATH: <absolute path>
     PROJECT_ROOT: <git root>
     MODE: auto-fix-trivial
     ```
   - Parse result with `${CLAUDE_PLUGIN_ROOT}/claudecode/lib/parse-spec-auditor-report.mjs`. If null: try `warden:voice` per the voice cadence with `SUMMARY: spec-auditor output malformed`, print the raw output, and block ratification until a clean auditor run parses successfully. Never treat malformed output as a pass.
   - Apply each deterministic auto-fix candidate via `apply-frontmatter-patch.mjs`, except `spec-version`: reject and surface any `spec-version` candidate instead of applying it. Keep all accepted fixes in the uncommitted spec so the user reviews one coherent artifact. Never auto-commit auditor output.
   - **`handoffEligible === false`** → surface every failing gate and BLOCKER to the user verbatim; loop (edit spec → re-run spec-auditor → repeat) until `handoffEligible` becomes `true`. This subsumes the older "BLOCKER list must be empty" condition — gates can fail without BLOCKERs, and both must be clean before advancing.
   - WARNING/INFO only → present list; let user choose which to address; then advance.
8. User ratification + commit gate:
   - Ask the user to review `<path>`. Wait. If changes: update the spec and re-run step 7.
   - On approval with `handoffEligible === true`, patch frontmatter to `status: ratified`, `verified-by: spec-auditor`, and `last-reviewed: <today ISO>`. Preserve every accepted `AC-###` id.
   - Ask exactly: `Commit the artifact? (y / no)`. On `y`, run `git add <path> && git commit -m "docs(acid-prophet): ratify spec for <topic>"`. On `no`, leave the ratified artifact uncommitted and continue. Skip the question outside a git repo and report `Commits: 0`.
   - For a project-creation handoff, mark only requested, gate-passing entries complete with the exact spec path and `content_hash`. `audited-spec` requires the parsed auditor pass. `guided-spec-review` additionally requires that it was requested by the strict profile and that the guided section-by-section review plus ratification actually ran; never mark it complete merely because the spec exists or standard requested an audit. Recompute and return `ARTIFACT_INVENTORY_HASH`, then update the same run manifest. If the manifest revision changed unexpectedly, stop with `workflow-state-conflict` instead of overwriting another owner.
9. Handoff: ask the user if they want to push the ratified spec to Linear.
   - If `DIRECT_TASK_HANDOFF` was supplied, return the exact `DIRECT_TASK_ARTIFACT` contract above
     immediately. Do not ask the generic Linear question, invoke `linear-devotee:create-project`, or
     refresh the manifest descriptor.
   - If `RETURN_TARGET: linear-devotee:create-project` was supplied, do not ask the generic Linear question. Return immediately to that target with the named block below and no Linear mutation:
     ```text
     WORKFLOW_HANDOFF:
       run_id: <unchanged run id>
       path: <same-run manifest path>
       content_hash: <refreshed manifest content hash>
     WORKFLOW_EXPIRES_AT: <current canonical expiry>
     ARTIFACT_INVENTORY: <updated canonical inventory JSON or absolute path>
     ARTIFACT_INVENTORY_HASH: <updated canonical inventory hash>
     RETURN_TARGET: linear-devotee:create-project
     ```
   - Yes:
     - Session store: if `$CLAUDE_SESSION_ID` is set, write to `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json` before invoking `create-project`:
       ```json
       {
         "spec_path": "<absolute spec path>",
         "acid-prophet": {
           "handoff_spec": {
             "path": "<absolute spec path>",
             "title": "<spec title from frontmatter or filename>",
             "id": "<spec id from frontmatter>"
           },
           "_handoff_spec_path": "<absolute spec path>"
         }
       }
       ```
       Deep-merge (do not replace the whole file). If store write fails, continue silently.
     - Invoke `linear-devotee:create-project` with spec path.
   - No → try `warden:voice` per the voice cadence with `SUMMARY: write-spec complete, spec approved, no linear handoff`, then exit.

## Final Report

```text
acid-prophet:write-spec report
  Spec:     <path>
  Status:   ratified
  Criteria: <N stable AC ids>
  Commits:  <n>
  Handoff:  <linear-devotee:create-project invoked | stopped here>
```

## Never

- Invoke `linear-devotee:create-project` before spec is user-approved.
- Renumber or reuse an accepted `AC-###` id.
- Invent a value when uncertain — emit `[NEEDS CLARIFICATION: ...]` instead.
- Ask multiple questions in the same message.
- Move to the next step before the current one is done.
- Run `git push` or `git rebase`.
- Use `--no-verify`.
