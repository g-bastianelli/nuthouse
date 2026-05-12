---
name: linear-devotee:create-project
description: Use in Codex when creating a Linear Project from a spec file or vibe-mode Q&A. Drafts a Project-SDD, previews, creates on approval, writes chain state, and can hand off to create-milestone.
---

# Linear Devotee Create Project for Codex

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, ask the cheapest available delegation path for one decorative line via `linear-devotee/shared/persona-line-contract.md` with `SUMMARY: <≤15 words, in the user's language>`; otherwise skip. Never block.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions: `tool_search linear`, verify git repo, ensure plugin-local `data/`.
3. Input:
   - File mode: readable `.md`, read and confirm one-paragraph synthesis.
   - Vibe mode: ask north star, why now, outcomes, constraints, out of scope; persist to `data/vibe-<session>.txt`.
4. Workspace metadata:
   - Fetch teams and project statuses.
   - Ask team only if multiple.
   - Initial status by `status.type`: prefer `backlog`, fallback `planned`; never hardcode status names.
5. Draft:
   - Draft locally or through cheap read-only delegation.
   - Output must be neutral Project-SDD, decomposition proposal, suggested issues, `_unclear_` for unknowns.
6. Clarify:
   - Ask one blocking question at a time for `_unclear_` or suggested questions.
   - Patch until clean or user ships as-is.
7. Preview and approve:
   - Print full draft.
   - Ask `Create this project? (y / edit / cancel)`.
   - Continue only on `y`.
8. Create Linear project:
   - `name`, Project-SDD-only `description`, selected `teamIds`, selected `statusId`.
   - Surface API errors verbatim; do not retry blindly.
9. Write `data/chain-<session>.json` with project fields, decomposition, drafted milestones, drafted issues, timestamp.
10. Handoff to `linear-devotee:create-milestone` or stop.

## Final Report

```text
linear-devotee:create-project report
  Project:         <name> - <url>
  Team:            <team.key>
  Status:          <status.name> (<status.type>)
  Decomposition:   <flat: N | phased: M phases>
  Drafted issues:  <N>
  Chain state:     <path>
  Hand-off:        create-milestone | stop | cancelled | linear_error
```

## Never

- Mutate Linear without explicit approval.
- Hardcode project status names.
- Run `git push`, `git commit`, or `git rebase`.
