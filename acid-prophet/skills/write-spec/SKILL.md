---
name: write-spec
description: Use when starting any project or feature that needs a structured spec before development — asks clarifying questions one at a time, proposes approaches, validates a written spec, then optionally hands off to linear-devotee:create-project for Linear project creation
argument-hint: [feature-or-project-description]
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Agent
---

# acid-prophet:write-spec

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid spec-writing gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Workflow

### Invoked from linear-devotee:create-project

When `linear-devotee:create-project` calls this skill to obtain a spec, it passes named
absolute paths:

```text
SPEC_FILE: <absolute path to an existing candidate spec | _none_>
ACCEPTANCE_REGISTER: <absolute path to the upstream acceptance register | _none_>
RETURN_TARGET: linear-devotee:create-project
```

Require every non-`_none_` path to exist and be readable; a missing artifact blocks. Artifacts
travel by absolute path — never reconstruct one from conversation prose. Keep the run scoped to
the spec: do not open a second project interview, and do not replace the upstream Acceptance
register with independently renumbered criteria. Return to `RETURN_TARGET` in step 9 instead of
asking the generic Linear question, and perform no Linear mutation.

1. Preconditions:
   - Verify git repo (`git rev-parse --git-dir`). Warn if not found — repository context and optional commit will be skipped but the trip continues.
2. Explore context:
   - `git log --oneline -10`; list `docs/acid-prophet/specs/` if it exists; read project-root `AGENTS.md` and `CLAUDE.md` when present.
3. Clarifying questions (one per message):
   - Treat `$ARGUMENTS` as the initial feature/project request when non-empty; if empty and no request is evident from the conversation, ask what needs a spec.
   - **Scope check first**: if the request describes multiple independent subsystems, flag and propose decomposition. Each sub-project gets its own trip.
   - Extract: who uses this and why, what problem it uniquely solves, where it fits, constraints (stack, timeline), observable success and definition of done.
   - **Uncertainty rule**: when a section needs a value the user hasn't provided and you cannot infer it from applicable `AGENTS.md`, `CLAUDE.md`, `package.json`, or the codebase — **never invent**. Emit a literal marker `[NEEDS CLARIFICATION: <one-line question>]` inline at that position. The spec is finishable with markers; the auditor will flag each one and the user will resolve them before the spec leaves draft.
   - If `SPEC_FILE` names an existing candidate, read it, preserve its active Acceptance section, and reconcile it against `ACCEPTANCE_REGISTER` when one was supplied. Run that candidate through the current auditor gate instead of opening a new spec interview. If no candidate exists, create one from the supplied brief and register through the normal workflow while preserving every accepted id.
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
   - Parse result with `${CLAUDE_PLUGIN_ROOT}/claudecode/lib/parse-spec-auditor-report.mjs`. If null: print the raw output, and block ratification until a clean auditor run parses successfully. Never treat malformed output as a pass.
   - Apply each deterministic auto-fix candidate via `apply-frontmatter-patch.mjs`, except `spec-version`: reject and surface any `spec-version` candidate instead of applying it. Keep all accepted fixes in the uncommitted spec so the user reviews one coherent artifact. Never auto-commit auditor output.
   - **`handoffEligible === false`** → surface every failing gate and BLOCKER to the user verbatim; loop (edit spec → re-run spec-auditor → repeat) until `handoffEligible` becomes `true`. This subsumes the older "BLOCKER list must be empty" condition — gates can fail without BLOCKERs, and both must be clean before advancing.
   - WARNING/INFO only → present list; let user choose which to address; then advance.
8. User ratification + commit gate:
   - Ask the user to review `<path>`. Wait. If changes: update the spec and re-run step 7.
   - On approval with `handoffEligible === true`, patch frontmatter to `status: ratified`, `verified-by: spec-auditor`, and `last-reviewed: <today ISO>`. Preserve every accepted `AC-###` id.
   - Ask exactly: `Commit the artifact? (y / no)`. On `y`, run `git add <path> && git commit -m "docs(acid-prophet): ratify spec for <topic>"`. On `no`, leave the ratified artifact uncommitted and continue. Skip the question outside a git repo and report `Commits: 0`.
9. Handoff: ask the user if they want to push the ratified spec to Linear.
   - If `RETURN_TARGET: linear-devotee:create-project` was supplied, skip the generic Linear question. Return immediately to that target with the ratified spec's absolute path and its accepted `AC-###` ids, and perform no Linear mutation.
   - Yes:
     - Session store: if `$CLAUDE_SESSION_ID` is set, write to `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json` before handing off:
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
     - **REQUIRED SUB-SKILL:** Use `linear-devotee:create-project`, passing the absolute spec path.
   - No → exit.

## A spec is not ratified because a file exists

**A SPEC IS RATIFIED ONLY WHEN THE AUDITOR GATES PASSED AND THE USER SAID SO.**

| Excuse                                          | Reality                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| "The spec file is written, that's the artifact" | A written file is a draft. Ratification is step 8, not step 6.            |
| "The auditor output looked fine"                | Looked fine is not parsed. A report that does not parse is a failed gate. |
| "The user seems happy with it"                  | Seeming happy is not approval. Ask, and wait for the answer.              |

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
