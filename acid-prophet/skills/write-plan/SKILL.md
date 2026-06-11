---
name: write-plan
description: Use after a spec has been ratified and before any code is written — turns an approved spec into a concrete implementation plan with file-level architecture decisions, typed API/data contracts, and a quickstart validation scenario. Produces docs/acid-prophet/plans/<slug>/{plan.md, contracts/*.md, quickstart.md, codebase-map.md} and is consumed downstream by subroutine:implement or linear-devotee:create-issue.
argument-hint: [spec-path]
model: opus
effort: xhigh
allowed-tools: Read, Glob, Grep, Bash
---

# write-plan

Rigid planning gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Do not restate persona tone, vocabulary, or emoji rules here.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Language

Adapt all output to match the user's language. Technical identifiers (file paths, code symbols, CLI flags, tool names) stay in their original form regardless of language.

## When you're invoked

The user has an approved spec under `docs/acid-prophet/specs/` and wants to lock the architecture, contracts, and validation scenario before implementation begins. Typically called between `write-spec` and `subroutine:implement` / `linear-devotee:create-project`. If invoked on an un-approved spec (`status != ratified | approved | implementing`), warn and require explicit user confirmation.

## Workflow

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/plans/` exists; create if missing.
2. Resolve the spec:
   - If `$ARGUMENTS` contains a spec path, use it. Resolve to absolute; verify file exists.
   - Otherwise, scan `docs/acid-prophet/specs/`. Match by current branch's Linear identifier, then by closest filename slug, then ask if still ambiguous.
   - Abort if zero candidates.
3. Pre-flight gate:
   - Read the spec frontmatter. If `status` is not one of `ratified | approved | implementing`, ask: `spec status is <X>; plan may shift. continue (y) | stop (s)?`. Default to stop.
   - Grep for unresolved `[NEEDS CLARIFICATION:` markers in the spec. If any exist, list them and ask `<N> unresolved markers — plan will inherit gaps. continue (y) | stop (s)?`. Default to stop.
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
     2. …

     ## Cleanup

     - <step>
     ```

   - The walkthrough is the executable form of the spec's Acceptance section. Anything in Acceptance that has no walkthrough step is a missing scenario — emit `[NEEDS CLARIFICATION: missing walkthrough step for "<AC quote>"]` rather than invent.

8. Draft plan.md:
   - Layout:

     ```markdown
     ---
     id: <slug>
     spec: <relative path>
     status: draft
     plan-version: 1
     validated-at: _none_
     spec-synced-at: <spec last-reviewed copied here>
     ---

     # Plan — <title> (<slug>)

     ## Context

     <1–3 sentences linking the spec + the goal; cite the spec by relative path>

     ## Files

     - `<path>`: <one-line role; tag `[new]` or `[modified]` or `[delete]`>

     ## Steps

     - [ ] <step 1: atomic edit, one file or one tight cluster>
           verify: <inline command or manual check>
     - [ ] <step 2>
           verify: …

     ## Verify

     <project-level commands after every Steps box is checked: test, lint, typecheck>

     ## Risks

     <enumerated; each risk gets a mitigation or an explicit "accepted">

     ## Out of scope

     <explicit negatives — what this plan will NOT touch; protects the implementing agent from drifting>
     ```

   - Steps must be atomic and ordered. Each step is one edit + one inline verify when possible (`bun test <path>`, `tsc --noEmit`, manual observation). Larger refactors get decomposed.

9. User validation gate:
   - Print all artifacts inline: plan.md, every contract, quickstart.md, codebase-map.md.
   - Ask: `validate (y) | revise <artifact> | regenerate <artifact> | abandon (a)`. Wait.
   - On revise/regenerate, return to the relevant step.
   - On abandon, exit, no files written.
10. Write + commit:
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
    - Commit: `git add docs/acid-prophet/plans/<slug>/ && git commit -m "docs(acid-prophet): plan for <slug>"`. Never use `--no-verify`.
11. Handoff:
    - Ask: `next step? (i) hand to subroutine:implement | (l) hand to linear-devotee:create-project for issue breakdown | (s) stop`.
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

    - `(i)`: invoke `subroutine:implement` with the named-field block above as its input.
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
  Open markers: <N unresolved [NEEDS CLARIFICATION] | none>
  Commits:      <N>
  Handoff:      <subroutine:implement | linear-devotee:create-project | stopped>
```

## Never

- Invent an architectural decision the user didn't approve — emit `[NEEDS CLARIFICATION: ...]` instead.
- Introduce an abstraction without naming ≥ 2 consumers in the contracts.
- Skip the validation gate (step 9), even on a one-step plan.
- Mutate the source spec.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
- Move to the next step before the current one is done.
