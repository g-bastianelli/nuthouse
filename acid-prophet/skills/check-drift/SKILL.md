---
name: check-drift
description: Use on a feature branch before or during PR creation — detects drift between the PR diff and the SDD Acceptance/Constraints of the linked project. Prefers the repo spec markdown as primary truth, falls back to Linear project context only when no spec markdown is found, generates a structured drift report, and optionally posts it as a PR comment.
effort: high
allowed-tools: Read, Glob, Grep, Bash
context_policy: fresh
---

# acid-prophet:check-drift

Rigid drift-detection gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Workflow

1. Preconditions:
   - Verify git repo (`git rev-parse --git-dir`). Abort if not in a repo.
   - Check `gh` CLI: `gh --version`. If missing, note "gh not found — PR comment will be skipped." Continue regardless.
2. Resolve context:
   - Capture `BRANCH_ISSUE_ID` from `git branch --show-current` if the branch name contains a Linear identifier.
   - Scan `docs/acid-prophet/specs/` for `.md` files. Select best spec match, in priority order: (1) `linear-project:` equals resolved `PROJECT_ID`, (2) `PROJECT_ID` appears in body, (3) `BRANCH_ISSUE_ID` appears in body, (4) filename slug matches closely. If ambiguity remains, ask.
   - If no spec found and `BRANCH_ISSUE_ID` exists, query `mcp__claude_ai_Linear__get_issue` to resolve `PROJECT_ID`/`PROJECT_NAME`, then re-check spec candidates.
   - If nothing resolves, ask for the Linear project ID. Re-check after answer.
   - Set `PRIMARY_REFERENCE = spec file <path>` or `linear (no spec found)`. Spec file always wins; never overwrite with Linear context once set.
3. Fetch reference:
   - **Spec file**: read `SPEC_FILE`; extract Goal/Problem, Solution, Acceptance, Constraints, Non-goals/Edges. Fetch only project name from Linear if needed (`mcp__claude_ai_Linear__get_project`).
   - **Linear fallback** (no spec found): try `warden:voice` per the voice cadence with `SUMMARY: no spec file, falling back to Linear`. Then dispatch a general-purpose Agent to fetch project details, attachments, milestones, and all issue descriptions (Goal, Acceptance, Constraints sections). Capture as `REFERENCE_CONTEXT`.
4. Get diff: `git diff main...HEAD`. If empty, try `warden:voice` per the voice cadence with `SUMMARY: empty diff, nothing to check`; print final report with `Drift: none (empty diff)`; exit.
5. Drift analysis: dispatch a general-purpose Agent with `REFERENCE_CONTEXT`, `DIFF`, and `REFERENCE_SOURCE`. For each Acceptance criterion or normative Constraint, classify as CLEAN / DRIFT / AMBIGUOUS / UNRELATED. Format per finding: `source <path|id> — "<criterion>" → <classification + explanation>`. End with `<N> drift · <N> ambiguous · <N> clean · <N> unrelated`. Capture as `DRIFT_REPORT`.
6. Report:
   - Try `warden:voice` per the voice cadence with `SUMMARY: <N> drift <N> ambiguous found` (or `no drift found` if clean).
   - Print drift report inline.
   - If drifts or ambiguous exist and `gh` is available: ask the user if they want to post the report as a PR comment.
     - Yes → `gh pr comment --body "<DRIFT_REPORT>"`. On failure: surface error, suggest manual copy.
     - No → try `warden:voice` per the voice cadence with `SUMMARY: drift report done, user stopped`; exit.

## Final Report

```text
acid-prophet:check-drift report
  Branch:      <current>
  Project:     <name> (<PROJECT_ID>)
  Source:      spec file <SPEC_FILE> | linear (fallback)
  Spec file:   <SPEC_FILE | _none_>
  Drift:       <N confirmed · N ambiguous · N clean · N unrelated>
  PR comment:  <posted | skipped | gh unavailable | no drift>
```

## Never

- Mutate Linear issues, projects, or spec files.
- Post a PR comment without explicit user confirmation.
- Skip step 1 preconditions.
- Run `git push`, `git rebase`, or `git commit`.
