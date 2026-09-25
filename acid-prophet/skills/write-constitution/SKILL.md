---
name: write-constitution
description: Define and ratify project-specific principles that constrain specs, audits, and drift checks, such as testing policy, abstraction limits, or architectural boundaries.
model: opus
effort: max
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
disallowed-tools: NotebookEdit
---

# write-constitution

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid governance gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Workflow

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/` exists; create if missing.
   - If `${PROJECT_ROOT}/docs/acid-prophet/constitution.md` already exists, read
     [`references/revision-mode.md`](references/revision-mode.md) and resolve that branch
     before continuing. Otherwise proceed to step 2.
2. Explore context (read-only):
   - `git log --oneline -20`.
   - Read `${PROJECT_ROOT}/CLAUDE.md` if present — its policies are constitutional candidates already.
   - Read `${PROJECT_ROOT}/package.json` if present — note declared stack and package manager.
   - List `docs/acid-prophet/specs/` if it exists — sample one or two to detect recurring tensions.
3. Surface candidate articles (one message, full list):
   - Propose 3–7 candidate articles distilled from CLAUDE.md, package.json, and prior specs. Each candidate is one short rule with a `Why:` line citing the evidence (CLAUDE.md quote, dependency choice, repeated audit finding).
   - Format example:
     ```
     - **No new dependencies without discussion**
       Why: CLAUDE.md states "no npm/bun deps added in plugins" — every spec that proposed a dep was rejected.
     ```
   - Mark each candidate `[propose | skip | edit]` and wait for the user to triage in one message.
4. Clarifying questions (one per message):
   - For each `edit` candidate, drill in: what does the article actually require, what does it forbid, when does it apply, when does it NOT apply (anti-scope). One question at a time. Apply the uncertainty rule: when the user has not specified a value, emit `[NEEDS CLARIFICATION: ...]` inline and move on — never invent.
   - Optional fifth pass: ask the user to add 1–2 articles not surfaced by the candidates. Same drill.
5. Before drafting, read
   [`references/constitution-format.md`](references/constitution-format.md). Follow its
   exact metadata, article fields, slug rules, and auditor-gate contract.

6. User ratification gate:
   - Print the full draft inline.
   - Ask: `ratify (y) | revise (r) | abandon (a)`. Wait.
   - `revise` → return to step 4 on the article the user names; re-draft; ask again.
   - `abandon` → exit with no file written.
7. Write + optional commit:
   - Save to `${PROJECT_ROOT}/docs/acid-prophet/constitution.md`. Overwrite only if the user chose `(x)` or `(r)` at step 1; otherwise this is a first write.
   - Ask exactly: `Commit the artifact? (y / no)`. On `y`, run `git add docs/acid-prophet/constitution.md && git commit -m "docs(acid-prophet): ratify constitution v<N>"` where `<N>` is the new version. On `no`, leave the ratified constitution uncommitted and continue. Never use `--no-verify`.
8. Wire-up notice (single message):
   - Tell the user: the next `audit-spec`, `write-spec` step 7, and `check-drift` invocations will read the constitution and gate accordingly. No other action required.

## Final Report

```text
acid-prophet:write-constitution report
  Constitution: ${PROJECT_ROOT}/docs/acid-prophet/constitution.md
  Articles:     <N ratified>
  Version:      <N>
  Commits:      <N>
  Open markers: <N unresolved [NEEDS CLARIFICATION] | none>
```

## Never

- Invent an article the user didn't approve.
- Skip the ratification gate (step 6) — even on `(x)` replacement.
- Edit `constitution.md` outside of this skill.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
- Move to the next step before the current one is done.
