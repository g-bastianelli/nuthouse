---
name: linear-devotee:create-issue
description: Use in Codex when creating a Linear Issue with a strict SDD-formatted description, chained from create-milestone chain state or standalone with selected project, optional milestone, and issue hint.
---

# Linear Devotee Create Issue for Codex

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, ask the cheapest available delegation path for one decorative line via `linear-devotee/shared/persona-line-contract.md` with `SUMMARY: <≤15 words, in the user's language>`; otherwise skip. Never block.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions: `tool_search linear`, verify git repo, ensure plugin-local `data/`.
3. Detect mode from `data/chain-<session>.json`:
   - Chained if project, created milestone, and uncreated suggested issue exist.
   - Standalone otherwise.
4. Gather context:
   - Chained: resolve project/team/current milestone; coerce legacy flat suggested issue arrays.
   - Pick first uncreated issue whose `blocked_by` deps are already created; exit `nothing-to-do` or `dependency_cycle` when needed.
   - Standalone: ask user to pick project, optional milestone, and one-sentence issue hint.
5. Draft:
   - Draft locally or through cheap read-only delegation with project id, milestone id, parent draft, hint, repo root.
   - Include SDD issue body, title, labels, questions; unknowns as `_unclear_`.
   - Stop on cross-project milestone violation.
6. Clarify one blocking question at a time until clean or ship-as-is.
7. Preview and ask `Create this issue? (y / edit / cancel)`; continue only on `y`.
8. Create Linear issue:
   - Resolve chained `blocked_by` indices to created issue identifiers; warn/drop unresolved.
   - Use `teamId`, title, SDD body description, `projectId`, optional `projectMilestoneId`, confirmed labels, optional `blockedBy`.
9. Update chain state with created issue id, identifier, title, url, project id, milestone id.
10. Handoff next issue in chained mode, otherwise final report.

## Final Report

```text
linear-devotee:create-issue report
  Mode:               <chained | standalone>
  Project:            <project.title> (<project.id>)
  Milestone:          <milestone.name> | none
  Issue:              <identifier> - <url> | (cancelled) | (linear_error)
  Chain progress:     <created>/<total> issues for current milestone
  Hand-off:           next-issue | stop | cancelled | linear_error | nothing-to-do | cross_project_violation | dependency_cycle
```

## Never

- Mutate Linear without explicit approval.
- Attach issue to milestone from another project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
