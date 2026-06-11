---
name: write-constitution
description: Use when a project needs immutable governing principles that every spec / audit / drift check is held against — runs a one-question-at-a-time interview to extract project-specific articles (test-first, anti-abstraction, library boundaries, etc.), writes them to docs/acid-prophet/constitution.md, and commits. The spec-auditor reads this file on every audit and treats each article as an extra gate.
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash
---

# write-constitution

Rigid governance gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Do not restate persona tone, vocabulary, or emoji rules here.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Language

Adapt all output to match the user's language. Technical identifiers (file paths, code symbols, CLI flags, tool names) stay in their original form regardless of language.

## When you're invoked

The user wants to write a constitution for a project — typically before the first spec, or when an audit keeps surfacing the same project-specific concern (test-first, no-new-deps, library-first, etc.).

## Workflow

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/` exists; create if missing.
   - Check whether `${PROJECT_ROOT}/docs/acid-prophet/constitution.md` already exists.
     - **Yes** → read it, print its current articles, and ask: `revise (r) | append articles (a) | replace from scratch (x) | stop (s)`. Branch on response. `(x)` requires a second confirmation.
     - **No** → proceed to step 2.
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
5. Draft the constitution:
   - Layout:

     ```markdown
     ---
     id: constitution
     status: ratified
     last-reviewed: <today ISO>
     version: 1
     ---

     # Constitution — <project name>

     > Articles below are enforced by `acid-prophet:spec-auditor` on every spec audit. Each article becomes a gate: violating articles ⇒ `gate:constitution:<slug>` BLOCKER and `handoff-eligible: no`.

     ## Articles

     ### <Article slug — kebab-case>

     **Rule.** <One sentence stating what the spec must do or must not do.>

     **Why.** <One to three sentences citing the evidence: CLAUDE.md quote, prior incident, stack constraint.>

     **Scope.** <When this article applies and when it doesn't. Anti-scope is mandatory — articles without an exit clause turn into religious dogma.>

     **Auditor check.** <One sentence telling the auditor what to grep for or what spec section to read to decide pass/fail.>

     ### <next article>

     …
     ```

   - Slug rule: each `### <slug>` heading uses kebab-case, ASCII only, ≤ 30 chars. The auditor uses this slug for `[gate:constitution:<slug>]` findings.

6. User ratification gate:
   - Print the full draft inline.
   - Ask: `ratify (y) | revise (r) | abandon (a)`. Wait.
   - `revise` → return to step 4 on the article the user names; re-draft; ask again.
   - `abandon` → exit with no file written.
7. Write + commit:
   - Save to `${PROJECT_ROOT}/docs/acid-prophet/constitution.md`. Overwrite only if the user chose `(x)` or `(r)` at step 1; otherwise this is a first write.
   - Commit: `git add docs/acid-prophet/constitution.md && git commit -m "docs(acid-prophet): ratify constitution v<N>"` where `<N>` is the new version. Skip commit if not in a git repo; warn. Never use `--no-verify`.
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
