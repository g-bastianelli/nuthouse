---
name: acid-prophet:write-spec
description: Use when starting any project or feature that needs a structured spec before development — asks clarifying questions one at a time, proposes approaches, validates a written spec, then optionally hands off to linear-devotee:consummate-project for Linear project creation
effort: high
allowed-tools: Read, Glob, Grep, Bash
context_policy: session
---

# acid-prophet:write-spec

Rigid spec-writing gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Workflow

1. Preconditions:
   - Verify git repo (`git rev-parse --git-dir`). Warn if not found — commit steps will be skipped but trip continues.
2. Explore context:
   - `git log --oneline -10`; list `docs/acid-prophet/specs/` if it exists; read project-root `CLAUDE.md` if present.
3. Clarifying questions (one per message):
   - **Scope check first**: if the request describes multiple independent subsystems, flag and propose decomposition. Each sub-project gets its own trip.
   - Extract: who uses this and why, what problem it uniquely solves, where it fits, constraints (stack, timeline), definition of done.
4. Propose 2–3 approaches with trade-offs. Lead with your recommendation. One message for the full option set.
5. Present spec sections one at a time; wait for user approval before the next. Revise on rejection.
   - Sections: Problem & Why, Solution, Architecture, Components / data flow, Error handling, Testing approach, Non-goals.
   - **Keep code minimal**: interfaces, type signatures, short pseudo-code (≤ 15 lines) only. Concrete examples and full implementations belong in Linear issues, not specs.
6. Write spec:
   - Create `docs/acid-prophet/specs/` if missing. Save to `docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md`.
   - Frontmatter required: `id: <slug>`, `status: draft`, `linear-project: _none_`, `verified-by: _none_`, `last-reviewed: <today ISO>`.
   - Commit: `git add <path> && git commit -m "docs(acid-prophet): add spec for <topic>"`. Skip commit if not in a git repo; warn user.
7. Scryer audit:
   - Dispatch `acid-prophet:spec-auditor`:
     ```
     SPEC_PATH: <absolute path>
     PROJECT_ROOT: <git root>
     MODE: auto-fix-trivial
     ```
   - Parse result with `<PROJECT_ROOT>/acid-prophet/claudecode/lib/parse-scryer-report.mjs`. If null: try `warden:voice` per the voice cadence with `SUMMARY: spec-auditor output malformed`, then continue without auto-fixes.
   - Apply each auto-fix candidate via `apply-frontmatter-patch.mjs`. If patches applied, commit: `git commit -m "docs(acid-prophet): spec-auditor auto-fixes"`. Never use `--no-verify`.
   - **BLOCKER findings remain** → surface to user verbatim; loop (edit spec → re-run spec-auditor → repeat) until BLOCKER list is empty.
   - WARNING/INFO only → present list; let user choose which to address; then advance.
8. User spec gate: ask user to review `<path>`. Wait. If changes: update spec, commit, re-run step 7.
9. Handoff: ask the user if they want to push the spec to Linear.
   - Yes:
     - Session store (`context_policy: session`): if `$CLAUDE_SESSION_ID` is set, write to `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json` before invoking `consummate-project`:
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
     - Invoke `linear-devotee:consummate-project` with spec path.
   - No → try `warden:voice` per the voice cadence with `SUMMARY: write-spec complete, spec approved, no linear handoff`, then exit.

## Final Report

```text
acid-prophet:write-spec report
  Spec:     <path>
  Commits:  <n>
  Handoff:  <linear-devotee:consummate-project invoked | stopped here>
```

## Never

- Invoke `linear-devotee:consummate-project` before spec is user-approved.
- Ask multiple questions in the same message.
- Move to the next step before the current one is done.
- Run `git push` or `git rebase`.
- Use `--no-verify`.
