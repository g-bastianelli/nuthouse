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

## Workflow

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/plans/` exists; create if missing.
2. Resolve the spec:
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
4. Explore the codebase (read-only):
   - Dispatch an `Explore` subagent with the spec body as context. Ask it to: (a) locate every file/path the spec references and report whether it exists, (b) identify existing utilities, hooks, or modules that overlap with the spec's solution, (c) flag any architectural pattern (state management, routing, data fetching) already established in the codebase the plan must conform to. Capture as `CODEBASE_MAP`.
   - Format `CODEBASE_MAP` as a markdown document destined for `${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/codebase-map.md` (written in step 10 with the other artifacts). Required sections: `# codebase map — <slug>`, `## Relevant files` (path + one-line role + exists/missing), `## Existing patterns` (established conventions the plan must conform to), `## Integration points` (where the new work plugs into existing code). This map is exploration context that travels with the plan — the implementing agent reads it instead of re-discovering the codebase from zero.
5. Architecture decisions (one question at a time):
   - For each open architectural question implied by the spec (storage shape, sync vs async, transport, state ownership, error propagation, retry policy) ask the user one focused question. Apply the uncertainty rule: when the user has not specified a value, emit `[NEEDS CLARIFICATION: ...]` inline and move on — never invent.
   - Reuse before adding: when `CODEBASE_MAP` shows an existing utility that fits, propose reuse with a single sentence; require the user to opt out before introducing a parallel implementation.
6. Data contracts:
   - For each data model, request/response payload, message shape, or event the spec describes, draft one typed contract file. One contract per file at `${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/contracts/<contract-name>.md`. Slug rule: kebab-case, ASCII only.
   - Required sections, in order: `# contract: <name>`, `## Shape`, `## Origin`, `## Invariants`, `## Errors`.
     - `## Shape` — a fenced `ts` block, ≤ 30 lines, holding a typescript-like sketch (`type <Name> = { … };` or a zod schema). No prose inside the block.
     - `## Origin` — bullets: `source: <spec section>:<line>`, `producer: <component / module>`, `consumer(s): <component / module>`.
       Add `covers: <comma-separated AC-### ids | foundation>` so each contract is traceable to observable behavior or explicitly classified as enabling infrastructure.
     - `## Invariants` — bullets, one invariant per line plus how it's enforced (runtime guard, type system, test).
     - `## Errors` — bullets, one error case per line plus where it surfaces.

7. Quickstart scenario:
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
   - Before showing the artifacts, compare `SOURCE_AC_IDS` against `plan.md` and `quickstart.md`.
   - Fail the pre-flight when an id is uncovered, duplicated in the spec, or referenced by the plan but absent from the spec. Return to the artifact that owns the defect and fix it there; never paper over a source-spec defect in the plan.
   - Print a compact coverage summary: `<N>/<N> AC ids covered · <N> foundation steps · <N> unknown refs`.
10. User validation gate:
    - Print all artifacts inline: plan.md, every contract, quickstart.md, codebase-map.md.
    - Ask: `validate (y) | revise <artifact> | regenerate <artifact> | abandon (a)`. Wait.
    - On revise/regenerate, return to the relevant step.
    - On abandon, exit, no files written.

11. Write + optional commit:
    - Slug derivation: spec filename minus the `YYYY-MM-DD-` prefix.
    - Write tree:
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
12. Handoff:
    - Ask: `next step? (i) implement now | (l) hand to linear-devotee:create-project for issue breakdown | (s) stop`.
    - Build the **full artifact set** as named fields — the downstream agent gets every planning artifact explicitly, never a bare directory path or a one-liner:

      ```
      PLAN_FILE: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/plan.md
      CONTRACTS_DIR: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/contracts/
      QUICKSTART_FILE: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/quickstart.md
      CODEBASE_MAP_FILE: ${PROJECT_ROOT}/docs/acid-prophet/plans/<slug>/codebase-map.md
      SPEC_FILE: <absolute path to the source spec resolved in step 2>
      CONSTITUTION_FILE: ${PROJECT_ROOT}/docs/acid-prophet/constitution.md | _none_
      ```

      `CONSTITUTION_FILE` is `_none_` when `docs/acid-prophet/constitution.md` does not exist. Omit no field — use `_none_` for anything missing.

    - `(i)`: hand the artifacts to the implementation turn with the named-field block above as its input. Emit this directive to the implementing agent: read every provided artifact before writing code, honor the repo's `AGENTS.md`/`CLAUDE.md`, let the `subroutine` discipline skills activate on matching files, and close with `moon-moth:verify` when a `.moon` workspace is present.
    - `(l)`: invoke `linear-devotee:create-project` with the same named-field block as its input.
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
