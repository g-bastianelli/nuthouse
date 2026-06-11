---
name: write-checklist
description: Use when a feature is approaching QA or PR review and the team needs a derived, per-spec acceptance checklist — reads an approved spec, generates a concrete `- [ ]` checklist of verifications drawn from its Acceptance / Constraints / Non-goals sections, writes it to docs/acid-prophet/checklists/<slug>.md, and optionally posts it as a PR comment. Complements `check-drift` (drift = spec↔code mismatch · checklist = did we actually validate the AC).
argument-hint: [spec-path]
model: sonnet
effort: high
allowed-tools: Read, Glob, Grep, Bash
disallowed-tools: Edit, NotebookEdit
---

# write-checklist

Rigid verification gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Do not restate persona tone, vocabulary, or emoji rules here.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Language

Adapt all output to match the user's language. Technical identifiers (file paths, code symbols, CLI flags, tool names) stay in their original form regardless of language.

## When you're invoked

The user has a spec under `docs/acid-prophet/specs/` and wants a concrete validation checklist before merging the implementing PR. Typically called: at PR-open, right before a manual QA pass, or when `check-drift` returns DRIFT / AMBIGUOUS findings the user wants to systematically verify.

## Workflow

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Check `gh` CLI: `gh --version`. If missing, note "gh not found — PR comment will be skipped." Continue regardless.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/checklists/` exists; create if missing.
2. Resolve the spec:
   - If `$ARGUMENTS` contains a spec path, use it. Resolve to absolute; verify file exists.
   - Otherwise, scan `docs/acid-prophet/specs/`. Match by current branch's Linear identifier in the body, then by closest filename slug, then ask if still ambiguous.
   - Abort if zero candidates.
3. Pre-flight gate:
   - Read the spec. If frontmatter `status` is not one of `ratified | implementing | approved`, surface to user: `spec is still <status>, checklist may shift. continue (y) | stop (s)?`. Default to stop on no answer.
   - Grep for unresolved `[NEEDS CLARIFICATION:` markers. If any exist, warn: `<N> unresolved clarification markers — checklist will inherit gaps. continue (y) | stop (s)?`. Default to stop.
4. Extract sources:
   - Pull every bullet from sections starting with `Acceptance`, `Constraints`, `Non-goals`, `Error handling`, `Testing approach`. Capture verbatim with section + line number.
   - Pull every EARS-conformant criterion separately (`WHEN ...` / `IF ...` → `THE SYSTEM SHALL ...`). These become the highest-priority checks.
5. Draft the checklist (one message, full output):
   - One `- [ ]` per Acceptance criterion (EARS first). Format:
     ```markdown
     - [ ] **<3-word handle>** — <verbatim quote of the AC>
           how to verify: <one concrete check: command, UI step, manual observation>
           source: <section>:<line>
     ```
   - Group Constraints separately under `## Constraints to enforce` — same `- [ ]` shape, the verify line names where the constraint is enforced (test name, lint rule, runtime guard).
   - Group Non-goals separately under `## Non-goals to verify NOT implemented` — `- [ ]` lines asking the reviewer to confirm the negative.
   - When the AC is too vague to verify (e.g. "gracefully handle errors") emit the item with a `verify: [NEEDS CLARIFICATION: how to test "<quote>"]` line — never invent a test.
6. User review gate:
   - Print the draft inline.
   - Ask: `accept (y) | edit (e) | regenerate (r) | abandon (a)`. Wait.
   - `edit` → ask which item; revise; re-print; ask again.
   - `regenerate` → return to step 5.
   - `abandon` → exit, no file written.
7. Write + commit:
   - Slug derivation: use the spec filename minus the `YYYY-MM-DD-` date prefix.
   - Save to `${PROJECT_ROOT}/docs/acid-prophet/checklists/<slug>.md` with frontmatter:
     ```yaml
     ---
     id: <slug>
     spec: <relative path to spec>
     status: open
     generated-at: <today ISO>
     ---
     ```
   - Commit: `git add docs/acid-prophet/checklists/<slug>.md && git commit -m "docs(acid-prophet): checklist for <slug>"`. Never use `--no-verify`.
8. Hand-off menu:
   ```
   (p) post PR comment → gh pr comment --body "<rendered checklist>"
   (o) open checklist  → print absolute path
   (s) stop
   ```
   Disable `(p)` if `gh` is unavailable or no PR is open on the current branch.
   - `(p)`: `gh pr comment --body "<rendered>"`. On failure: surface error, suggest manual copy, return to menu.
   - `(o)`: print absolute path.
   - `(s)`: exit.

## Final Report

```text
acid-prophet:write-checklist report
  Spec:        <spec path>
  Checklist:   ${PROJECT_ROOT}/docs/acid-prophet/checklists/<slug>.md
  Items:       <N acceptance · N constraint · N non-goal>
  Open markers: <N unresolved [NEEDS CLARIFICATION] | none>
  PR comment:  <posted | skipped | gh unavailable | no PR>
  Branch:      <p | o | s>
```

## Never

- Invent a verification step the spec doesn't support — emit `[NEEDS CLARIFICATION: ...]` instead.
- Mutate the source spec.
- Post a PR comment without explicit user choice of `(p)`.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
- Move to the next step before the current one is done.
