---
name: write-checklist
description: Use during strict issue planning or when a feature approaches QA/PR review to derive a per-spec acceptance checklist. It preserves source AC ids, writes an open checklist, and never treats checklist generation as human feature acceptance.
argument-hint: "[spec-path] [--plan <path> --workflow-decision <handoff>]"
model: sonnet
effort: high
allowed-tools: Read, Glob, Grep, Bash, Bash(node:*)
disallowed-tools: Edit, NotebookEdit
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# write-checklist

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

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

### Strict issue-delivery mode

Use this mode when Linear Devotee supplies `PLAN_FILE`, `SPEC_FILE`,
`WORKFLOW_DECISION`, and named `DRIFT_EVIDENCE: { path, content_hash, status: clean }`:

1. Validate the workflow manifest through this plugin's install-local resolver. Require
   `issue-delivery`, effective `strict`, and exact run/path/content hash. Warden is not
   required.
2. Recompute the plan, spec, and drift-evidence `sha256:` hashes. Require the plan to be
   validated and the supplied drift evidence to be `clean` and bound to those same
   plan/spec/decision hashes.
3. Continue through the ordinary extraction, draft, and user review gate below, using
   the explicit `SPEC_FILE`. Strict mode does not skip review, auto-check an item, or
   accept the feature.
4. Write the accepted checklist with `status: open` and record the exact decision, plan,
   spec, and drift-evidence hashes it derives from. Re-read its final bytes and return
   the named result:

   ```text
   CHECKLIST_EVIDENCE: { path: <absolute checklist path>, content_hash: sha256:<hex>, status: open }
   ```

   The artifact is required verification guidance. Human feature acceptance remains a
   later explicit gate, and manual merge remains outside this skill. Never mark the
   checklist or feature accepted merely because the artifact was generated.

### Ordinary QA / PR mode

1. Preconditions:
   - Verify git repo: `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a repo.
   - Check `gh` CLI: `gh --version`. If missing, note "gh not found — PR comment will be skipped." Continue regardless.
   - Ensure `${PROJECT_ROOT}/docs/acid-prophet/checklists/` exists; create if missing.
2. Resolve the spec:
   - If `$ARGUMENTS` contains a spec path, use it. Resolve to absolute; verify file exists.
   - Otherwise, scan `docs/acid-prophet/specs/`. Match by current branch's Linear identifier in the body, then by closest filename slug, then ask if still ambiguous.
   - Abort if zero candidates.
3. Pre-flight gate:
   - Read the spec. If frontmatter `status` is not one of `ratified | approved | ready | implementing`, surface to user: `spec is still <status>, checklist may shift. continue (y) | stop (s)?`. Default to stop on no answer.
   - Grep for unresolved `[NEEDS CLARIFICATION:` markers. If any exist, warn: `<N> unresolved clarification markers — checklist will inherit gaps. continue (y) | stop (s)?`. Default to stop.
4. Extract sources:
   - Scope Acceptance extraction to the section headed exactly `Acceptance` (case-insensitive), stopping at the next heading of the same or higher level; exclude `Acceptance history`. Pull every bullet from that active section and from sections starting with `Constraints`, `Non-goals`, `Error handling`, `Testing approach`. Capture verbatim with section + line number.
   - Pull every EARS-conformant criterion separately (`WHEN ...` / `IF ...` → `THE SYSTEM SHALL ...`). These become the highest-priority checks.
   - Preserve the leading `AC-###` id exactly. Missing or duplicate ids block generation; run `acid-prophet:audit-spec` to repair the source rather than inventing checklist-local ids.
5. Draft the checklist (one message, full output):
   - One `- [ ]` per Acceptance criterion (EARS first). Format:
     ```markdown
     - [ ] **[AC-001] <3-word handle>** — <verbatim quote of the AC after its id>
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
7. Write + optional commit:
   - Slug derivation: use the spec filename minus the `YYYY-MM-DD-` date prefix.
   - Save to `${PROJECT_ROOT}/docs/acid-prophet/checklists/<slug>.md` with frontmatter:
     ```yaml
     ---
     id: <slug>
     spec: <relative path to spec>
     status: open
     acceptance-ids: [AC-001, AC-002]
     generated-at: <today ISO>
     ---
     ```
   - Ask exactly: `Commit the artifact? (y / no)`. On `y`, run `git add docs/acid-prophet/checklists/<slug>.md && git commit -m "docs(acid-prophet): checklist for <slug>"`. On `no`, leave the accepted checklist uncommitted and continue. Never use `--no-verify`.
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
  AC coverage: <N>/<N>
  Open markers: <N unresolved [NEEDS CLARIFICATION] | none>
  PR comment:  <posted | skipped | gh unavailable | no PR>
  Branch:      <p | o | s>
```

## Never

- Invent a verification step the spec doesn't support — emit `[NEEDS CLARIFICATION: ...]` instead.
- Mark a checklist item, checklist, or feature accepted automatically; generated
  checklists always start with `status: open`.
- Renumber or synthesize an `AC-###` id outside the source spec.
- Mutate the source spec.
- Post a PR comment without explicit user choice of `(p)`.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
- Move to the next step before the current one is done.
