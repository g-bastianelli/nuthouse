---
name: write-plan
description: Use after a spec has been ratified and before any code is written — turns an approved spec into a concrete implementation plan with file-level architecture decisions, typed API/data contracts, and a quickstart validation scenario. Produces docs/acid-prophet/plans/<slug>/{plan.md, contracts/*.md, quickstart.md, codebase-map.md} and is consumed downstream by the main implementation turn or linear-devotee:create-issue.
argument-hint: [spec-path]
model: opus
effort: xhigh
allowed-tools: Read, Glob, Grep, Bash, Agent
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# write-plan

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Do not restate persona tone, vocabulary, or emoji rules here.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Language

Adapt all output to match the user's language. Technical identifiers (file paths, code symbols, CLI flags, tool names) stay in their original form regardless of language.

## When you're invoked

The user has an approved spec under `docs/acid-prophet/specs/` and wants to lock the architecture, contracts, and validation scenario before implementation begins. Typically called between `write-spec` and the implementation turn / `linear-devotee:create-project`. If invoked on an unapproved spec (`status != ratified | approved | ready | implementing`), warn and require explicit user confirmation.

## Direct-task artifact handoff

When `prepareDirectTask` selects this owner, treat the returned handoff descriptor's exact `input`
object as `DIRECT_TASK_HANDOFF` and consume it before the project-creation contract or normal
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
  "upstreamArtifacts": [<exact ratified spec artifact>],
  "returnTarget": { "kind": "current-turn", "name": "direct-task" }
}
```

Reject unknown/missing fields, simultaneous project-creation return fields, or anything except one
upstream artifact with `status: "ratified"`, `audited: true`,
`owner: "acid-prophet:write-spec"`, and the exact same `decisionHandoff`. Import
`discoverGitContext` and `consumeManifestHandoff` only from the install-local
`${CLAUDE_PLUGIN_ROOT}/lib/workflow/index.mjs`; use that bundle's `bundle.json` source hash as
`policyHash`. Consume the descriptor against the current Git context without reclassification or
recovery. Require the persisted decision to have `workflow === "direct-task"`,
`effectiveProfile === "strict"`, and enabled immutable `verification`, and require the returned
handoff to equal the input. Any stale, expired, corrupt, out-of-scope, drifted, or mismatched state
blocks. Never invoke or require Warden.

Resolve the source spec only from `upstreamArtifacts[0]`, re-hash its exact bytes, require the hash
and owner gates to match, and run the normal report-only spec audit and Acceptance traceability
checks. For this bounded direct-task mode, produce and validate only `plan.md`; it must cover the
input scope and exact verification commands. Do not create the project-only inventory, contracts,
quickstart, codebase map, or constitution artifacts, and do not update the workflow manifest. After
validation, hash the exact plan bytes and return immediately to `returnTarget` with:

```text
DIRECT_TASK_ARTIFACT: {
  "id": "<safe plan id>",
  "path": "<repository-relative plan path>",
  "contentHash": "sha256:<64 lowercase hex>",
  "status": "validated",
  "audited": true,
  "owner": "acid-prophet:write-plan",
  "decisionHandoff": <exact unchanged DIRECT_TASK_HANDOFF.decisionHandoff>
}
RETURN_TARGET: { "kind": "current-turn", "name": "direct-task" }
```

Return no project inventory and perform no Linear mutation. The caller inserts this exact object as
`artifacts.plan` beside the unchanged spec artifact and resumes `prepareDirectTask` in the same run.

## Project-creation artifact handoff

When the invocation includes the fields below, this skill is an artifact owner inside an existing
project-creation run, not a new workflow entry point:

```text
WORKFLOW_HANDOFF:
  run_id: <uuid>
  path: <absolute manifest path>
  content_hash: sha256:<64 lowercase hex>
WORKFLOW_EXPIRES_AT: <canonical ISO timestamp>
ARTIFACT_INVENTORY: <canonical JSON array or absolute JSON path>
ARTIFACT_INVENTORY_HASH: sha256:<64 lowercase hex>
REQUESTED_ARTIFACTS: <project-plan and any strict planning artifacts>
RETURN_TARGET: linear-devotee:create-project
```

Import `consumeManifestHandoff` and `writeDecisionManifest` only from
`${CLAUDE_PLUGIN_ROOT}/lib/workflow/index.mjs`, use `bundle.json`'s source hash as the consumer
policy hash, and require the manifest decision to be `project-creation`. Reuse its effective
profile without reclassification. Preserve the exact `run_id`, hash-bound canonical
`ARTIFACT_INVENTORY`, and explicit return target. Recover missing/expired/corrupt/out-of-scope
state only through one synchronous `resolveAuthoritatively` with
`replacement: { expiresAt: <future WORKFLOW_EXPIRES_AT renewed by the canonical 24-hour rule when expired>, artifacts }`; reject a second fallback, different run,
policy disagreement, `runtime-drift`, or any target other than
`RETURN_TARGET: linear-devotee:create-project`. Never require Warden.
Malformed descriptors (including a non-schema `content_hash`) block as
`invalid-manifest-handoff`; a schema-valid descriptor whose hash no longer matches the manifest is
`content-hash-mismatch` and may use the single authoritative recovery above.
Assign the consumed or recovered result to `currentRun` before any artifact read. Parse a
path-backed inventory, validate the closed entry schema, serialize the ordered fields as one
no-whitespace JSON array sorted by `artifact_type`, and verify
`ARTIFACT_INVENTORY_HASH` against only those canonical UTF-8 bytes.

This skill owns `project-plan`, `typed-contracts`, `quickstart-evidence`, `codebase-map`, and
`constitution-gates`. The constitution artifact is applicable exactly when the regular file
`docs/acid-prophet/constitution.md` exists; hash and apply its articles when present, otherwise
record `constitution-gates` as `not-applicable` with null path/hash. This workflow never creates a
constitution implicitly or names a second owner. An owned artifact becomes complete
only after the cross-artifact and user validation gates pass and its exact bytes receive a
deterministic `content_hash`.

Hash a complete directory artifact by recursively enumerating entries, rejecting symlinks and
non-regular files, sorting each normalized POSIX relative path bytewise, and feeding SHA-256
repeated records made from the UTF-8 path bytes, one NUL byte, the ASCII base-10 byte length without
leading zeros, one NUL byte, and the raw file bytes. Do not hash archive metadata, host paths,
container JSON, or implicit newlines. Files continue to hash their exact raw bytes.

Profile branch: when the persisted profile is `standard`, require `REQUESTED_ARTIFACTS` to contain
only `project-plan` and produce a proportionate validated `plan.md`; codebase exploration may stay
in working context, but skip contract files, quickstart, codebase-map output, and constitution
artifact work. When the profile is `strict`, require `REQUESTED_ARTIFACTS` to be a non-empty sorted
subset of this skill's five owned types: `project-plan`, `constitution-gates`, `typed-contracts`,
`quickstart-evidence`, and `codebase-map`. Every requested entry must still have
`status: "missing"`;
every omitted required type must already be complete or validly
not-applicable in the same inventory. Re-hash omitted complete entries before work, but must not
regenerate or rewrite them. Run only the producing gates for requested entries plus the cross-artifact
checks needed to validate them. Never mark an unrequested artifact complete.

## Workflow

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/plans/` exists; create if missing.
   - For a project-creation handoff, assign `currentRun = consumeManifestHandoff(...)` before reading artifacts and verify that every already-complete inventory path still matches its `content_hash`. A changed upstream spec or inventory invalidates this plan attempt and returns to `linear-devotee:create-project` for cascade rebuild.
   - For a direct-task handoff, consume and validate the closed contract above before reading the
     upstream spec. Keep its descriptor unchanged throughout the owner run.
2. Resolve the spec:
   - For a direct-task handoff, resolve the spec only from `upstreamArtifacts[0]`; require its exact
     path, content hash, owner, status, audit flag, and decision identity. Do not select by branch or
     filename.
   - For a project-creation handoff, resolve the spec only from the complete `audited-spec` inventory entry. Require its path/hash to match; do not choose another spec by branch or filename.
   - If `$ARGUMENTS` contains a spec path, use it. Resolve to absolute; verify file exists.
   - Otherwise, scan `docs/acid-prophet/specs/`. Match by current branch's Linear identifier, then by closest filename slug, then ask if still ambiguous.
   - Abort if zero candidates.
3. Pre-flight gate:
   - Read the spec frontmatter. If `status` is not one of `ratified | approved | ready | implementing`, ask: `spec status is <X>; plan may shift. continue (y) | stop (s)?`. Default to stop.
   - Require `spec-version` to parse as a base-10 integer ≥ 1. Abort to `acid-prophet:audit-spec` when it is missing or invalid; never substitute a default version.
   - Grep for unresolved `[NEEDS CLARIFICATION:` markers in the spec. If any exist, list them and ask `<N> unresolved markers — plan will inherit gaps. continue (y) | stop (s)?`. Default to stop.
   - Dispatch the logical `acid-prophet:spec-auditor` agent in `MODE: report-only` and
     capture its complete output as `RAW_REPORT`. Import and execute
     `parseSpecAuditorReport(RAW_REPORT)` from
     `${CLAUDE_PLUGIN_ROOT}/claudecode/lib/parse-spec-auditor-report.mjs`; do not interpret
     the markdown by hand. Require the parsed `handoffEligible === true` plus
     `gates["acceptance-traceable"] === "pass"`. Abort planning on null parser output,
     missing/duplicate ids, or any failed gate; send the user to `acid-prophet:audit-spec`
     instead of inheriting a broken source.
   - Scope Acceptance extraction to the section headed exactly `Acceptance` (case-insensitive), stopping at the next heading of the same or higher level; exclude `Acceptance history`. Extract every id matching `AC-###` from that active section into `SOURCE_AC_IDS` only after the audit passes.
   - Read `${PROJECT_ROOT}/docs/acid-prophet/constitution.md` if present. Articles become design constraints for every step below.
   - When strict requests `constitution-gates`, apply the exact existence predicate above: hash and record the regular file when present; otherwise preserve `status: "not-applicable"` with null path/hash. If it is omitted from `REQUESTED_ARTIFACTS`, require the existing complete/not-applicable entry to satisfy that predicate without rewriting it. Any other state is a blocking inventory mismatch.
4. Explore the codebase (read-only):
   - Dispatch an `Explore` subagent with the spec body as context. Ask it to: (a) locate every file/path the spec references and report whether it exists, (b) identify existing utilities, hooks, or modules that overlap with the spec's solution, (c) flag any architectural pattern (state management, routing, data fetching) already established in the codebase the plan must conform to. Capture as `CODEBASE_MAP`.
   - Format `CODEBASE_MAP` as a markdown document destined for `${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/codebase-map.md` (written in step 10 with the other artifacts). Required sections: `# codebase map — <slug>`, `## Relevant files` (path + one-line role + exists/missing), `## Existing patterns` (established conventions the plan must conform to), `## Integration points` (where the new work plugs into existing code). This map is exploration context that travels with the plan — the implementing agent reads it instead of re-discovering the codebase from zero.
   - In a standard project-creation return, keep `CODEBASE_MAP` as temporary planning context and do not write or complete `codebase-map`. In strict, write/complete it only when `codebase-map` is requested; otherwise use the verified existing entry as context without rewriting it.
5. Architecture decisions (one question at a time):
   - For each open architectural question implied by the spec (storage shape, sync vs async, transport, state ownership, error propagation, retry policy) ask the user one focused question. Apply the uncertainty rule: when the user has not specified a value, emit `[NEEDS CLARIFICATION: ...]` inline and move on — never invent.
   - Reuse before adding: when `CODEBASE_MAP` shows an existing utility that fits, propose reuse with a single sentence; require the user to opt out before introducing a parallel implementation.
6. Data contracts:
   - Skip this artifact step for a standard project-creation return. In strict, execute the complete contract workflow below only when `typed-contracts` is in `REQUESTED_ARTIFACTS`; otherwise verify and reuse the existing complete directory without rewriting it.
   - For each data model, request/response payload, message shape, or event the spec describes, draft one typed contract file. One contract per file at `${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/contracts/<contract-name>.md`. Slug rule: kebab-case, ASCII only.
   - Required sections, in order: `# contract: <name>`, `## Shape`, `## Origin`, `## Invariants`, `## Errors`.
     - `## Shape` — a fenced `ts` block, ≤ 30 lines, holding a typescript-like sketch (`type <Name> = { … };` or a zod schema). No prose inside the block.
     - `## Origin` — bullets: `source: <spec section>:<line>`, `producer: <component / module>`, `consumer(s): <component / module>`.
       Add `covers: <comma-separated AC-### ids | foundation>` so each contract is traceable to observable behavior or explicitly classified as enabling infrastructure.
     - `## Invariants` — bullets, one invariant per line plus how it's enforced (runtime guard, type system, test).
     - `## Errors` — bullets, one error case per line plus where it surfaces.

7. Quickstart scenario:
   - Skip this artifact step for a standard project-creation return. In strict, execute the complete scenario workflow below only when `quickstart-evidence` is in `REQUESTED_ARTIFACTS`; otherwise verify and reuse the existing complete file without rewriting it.
   - One concrete end-to-end scenario the user / a test can run to prove the feature works from outside. Format:

     ```markdown
     # quickstart — <slug>

     ## Setup

     - <step>: <command or precondition>

     ## Walkthrough

     1. <user-visible action>
        observe: <expected externally visible outcome>
        covers: AC-001
     2. …

     ## Cleanup

     - <step>
     ```

   - The walkthrough is the executable form of the spec's Acceptance section. Every `SOURCE_AC_IDS` value must appear in at least one `covers:` line. Anything in Acceptance that has no walkthrough step is a missing scenario — emit `[NEEDS CLARIFICATION: missing walkthrough step for "<AC-ID> <AC quote>"]` rather than invent.

8. Draft plan.md:
   - When `project-plan` is absent from `REQUESTED_ARTIFACTS`, read and verify the existing complete inventory entry, use it for cross-artifact analysis, and do not draft, validate, write, or complete a replacement. The layout below applies only when `project-plan` is requested.
   - Layout:

     ```markdown
     ---
     id: <slug>
     spec: <relative path>
     status: draft
     plan-version: 1
     spec-version: <exact source spec-version>
     acceptance-ids: [AC-001, AC-002]
     validated-at: _none_
     spec-synced-at: <spec last-reviewed copied here>
     ---

     # Plan — <title> (<slug>)

     ## Context

     <1–3 sentences linking the spec + the goal; cite the spec by relative path>

     ## Files

     - `<path>`: <one-line role; tag `[new]` or `[modified]` or `[delete]`>

     ## Acceptance coverage

     - `AC-001` → steps 2, 3 · quickstart steps 1, 2
     - `AC-002` → step 4 · quickstart step 3

     ## Steps

     - [ ] <step 1: atomic edit, one file or one tight cluster>
           verify: <inline command or manual check>
           covers: foundation
     - [ ] <step 2>
           verify: …
           covers: AC-001

     ## Verify

     <project-level commands after every Steps box is checked: test, lint, typecheck>

     ## Risks

     <enumerated; each risk gets a mitigation or an explicit "accepted">

     ## Out of scope

     <explicit negatives — what this plan will NOT touch; protects the implementing agent from drifting>
     ```

   - Steps must be atomic and dependency-ordered. Each step is one edit + one inline verify when possible (`bun test <path>`, `tsc --noEmit`, manual observation). Larger refactors get decomposed. Every step carries `covers: AC-001` (one or more comma-separated ids) or `covers: foundation` with a concrete enabling reason in the step text.

9. Cross-artifact analysis:
   - Before showing the artifacts, compare `SOURCE_AC_IDS` against the requested or verified-existing `plan.md` and, when requested or already complete, `quickstart.md`.
   - Fail the pre-flight when an id is uncovered, duplicated in the spec, or referenced by the plan but absent from the spec. Return to the artifact that owns the defect and fix it there; never paper over a source-spec defect in the plan.
   - Print a compact coverage summary: `<N>/<N> AC ids covered · <N> foundation steps · <N> unknown refs`.
10. User validation gate:
    - Print every requested artifact inline. Standard prints only requested `plan.md`; strict prints only the requested plan/contracts/quickstart/codebase-map/constitution receipt plus a hash-only summary of omitted complete entries. Never ask the user to revalidate unchanged artifact bodies.
    - Ask: `validate (y) | revise <artifact> | regenerate <artifact> | abandon (a)`. Wait.
    - On revise/regenerate, return to the relevant step.
    - On abandon, exit, no files written.

11. Write + optional commit:
    - Slug derivation: spec filename minus the `YYYY-MM-DD-` prefix.
    - Write only requested artifacts. Strict uses the full tree:
      ```
      ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/
        plan.md
        quickstart.md
        codebase-map.md
        contracts/
          <contract-1>.md
          <contract-2>.md
      ```
    - Ask exactly: `Commit the artifact? (y / no)`. On `y`, run `git add docs/acid-prophet/plans/<slug>/ && git commit -m "docs(acid-prophet): plan for <slug>"`. On `no`, leave the validated artifact set uncommitted and continue. Never use `--no-verify`.
    - For a project-creation handoff, hash only the requested validated outputs (and applicable constitution bytes) in canonical relative-path order. Mark only requested, gate-passing entries complete in `ARTIFACT_INVENTORY`, recompute `ARTIFACT_INVENTORY_HASH`, and attach their id/path/content-hash references to the same manifest through `writeDecisionManifest`. Preserve `currentRun.manifest.decision`, `currentRun.manifest.expiresAt`, and extra valid refs; pass `expectedRevision: currentRun.manifest.revision` plus `observedContentHash: currentRun.contentHash`, then assign the refreshed persisted result back to `currentRun`. A stale revision stops with `workflow-state-conflict`.
12. Handoff:
    - If `DIRECT_TASK_HANDOFF` was supplied, return the exact `DIRECT_TASK_ARTIFACT` contract above
      immediately. Do not show the generic next-step menu, invoke `linear-devotee:create-project`,
      or refresh the manifest descriptor.
    - If `RETURN_TARGET: linear-devotee:create-project` was supplied, skip the generic next-step menu and return immediately with no Linear mutation:
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
    - Ask: `next step? (i) implement now | (l) hand to linear-devotee:create-project for issue breakdown | (s) stop`.
    - Build the **full artifact set** as named fields — the downstream agent gets every planning artifact explicitly, never a bare directory path or a one-liner:

      ```
      PLAN_FILE: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/plan.md
      CONTRACTS_DIR: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/contracts/
      QUICKSTART_FILE: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/quickstart.md
      CODEBASE_MAP_FILE: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/codebase-map.md
      SPEC_FILE: <absolute path to the source spec resolved in step 2>
      CONSTITUTION_FILE: ${PROJECT_ROOT}/docs/acid-prophet/constitution.md | _none_
      ARTIFACT_SET_RECEIPT: <absolute canonical receipt path | _none_ for implementation handoff>
      ARTIFACT_SET_RECEIPT_HASH: <sha256 canonical receipt hash | _none_ for implementation handoff>
      ```

      `CONSTITUTION_FILE` is `_none_` when `docs/acid-prophet/constitution.md` does not exist. Omit no field — use `_none_` for anything missing.

    - `(i)`: hand the artifacts to the implementation turn with the named-field block above as its input. Emit this directive to the implementing agent: read every provided artifact before writing code, honor the repo's `AGENTS.md`/`CLAUDE.md`, let the `subroutine` discipline skills activate on matching files, and close with `moon-moth:verify` when a `.moon` workspace is present.
    - `(l)`: this is a bootstrap owner handoff because no project-creation manifest exists yet. Reuse the parsed clean spec-auditor result from step 3 and re-hash every non-`_none_` artifact with the exact file/directory rules above. Write one closed, no-whitespace JSON receipt under `${CLAUDE_PLUGIN_DATA}` with fields in this order: `schemaVersion: 1`, `owner: "acid-prophet:write-plan"`, `specAudit: { path, contentHash, handoffEligible: true, acceptanceTraceable: "pass" }`, `artifacts` sorted by id as `{ id, owner, status, path, contentHash, gate }`, and ordered `acceptanceIds`. Use the closed owner mapping (`audited-spec` → `acid-prophet:write-spec`; every planning type → `acid-prophet:write-plan`). Include only artifacts whose owner gate passed. A missing constitution is the sole `status: "not-applicable"` entry and has null path/hash plus its absence gate; all other entries are `complete`. Reject symlinks, unknown ids/fields, missing outputs, or stale spec bytes. Hash the exact canonical receipt bytes, replace both receipt `_none_` values in the named block, and invoke `linear-devotee:create-project`. That skill must independently validate the receipt and attach the exact complete refs to its fresh manifest before considering any artifact complete.
    - `(s)`: exit.

## Final Report

```text
acid-prophet:write-plan report
  Spec:         <path>
  Plan dir:     ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/
  Contracts:    <N written>
  Codebase map: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/codebase-map.md
  Steps:        <N atomic>
  AC coverage:  <N>/<N>
  Open markers: <N unresolved [NEEDS CLARIFICATION] | none>
  Commits:      <N>
  Handoff:      <implementation turn | linear-devotee:create-project | stopped>
```

## Never

- Invent an architectural decision the user didn't approve — emit `[NEEDS CLARIFICATION: ...]` instead.
- Introduce an abstraction without naming ≥ 2 consumers in the contracts.
- Skip the cross-artifact or validation gates (steps 9–10), even on a one-step plan.
- Mutate the source spec.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
- Move to the next step before the current one is done.
