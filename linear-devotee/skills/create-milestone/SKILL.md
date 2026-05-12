---
name: linear-devotee:create-milestone
description: Use in Codex when adding a Milestone to a Linear Project, chained from create-project chain state or standalone with a selected project and phase hint.
---

# Linear Devotee Create Milestone for Codex

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, ask the cheapest available delegation path for one decorative line via `linear-devotee/shared/persona-line-contract.md` with `SUMMARY: <≤15 words, in the user's language>`; otherwise skip. Never block.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions: `tool_search linear`, verify git repo, ensure plugin-local `data/`.
3. Detect mode from `data/chain-<session>.json`:
   - Chained if `project.id` exists; pick next uncreated drafted milestone.
   - Standalone otherwise; ask user to pick active project and provide one-sentence hint.
4. Draft:
   - Draft locally or through cheap read-only delegation with project id, parent draft, hint, repo root.
   - Include milestone draft, suggested issues, open decisions, questions; unknowns as `_unclear_`.
5. Clarify one blocking question at a time until clean or ship-as-is.
6. Preview and ask `Create this milestone? (y / edit / cancel)`; continue only on `y`.
7. Create Linear milestone with `name`, `projectId`, description excluding suggested issues/open decisions/questions, optional confirmed `targetDate`.
8. Update chain state:
   - Parse suggested issues into `{ idx, title, blocked_by }`.
   - Append created milestone with suggested issues.
   - Preserve existing project/draft fields; support legacy flat issue arrays.
9. Handoff to `create-issue`, next milestone, or stop.

## Final Report

```text
linear-devotee:create-milestone report
  Mode:               <chained | standalone>
  Project:            <project.title> (<project.id>)
  Milestone:          <name> - <url> | (cancelled) | (linear_error)
  Suggested issues:   <N>
  Chain progress:     <created>/<total> milestones
  Hand-off:           create-issue | next-milestone | stop | cancelled | linear_error | nothing-to-do
```

## Never

- Mutate Linear without explicit approval.
- Attach milestone to wrong project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
