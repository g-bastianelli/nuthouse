---
name: linear-devotee:create-project
description: Use when creating a Linear Project from a spec file or vibe-mode Q&A. Drafts a Project-SDD via project-drafter, clarifies, previews, creates the project on approval, writes chain state, and can hand off to create-milestone.
effort: high
allowed-tools: Read, Glob, Grep
---

# linear-devotee:create-project

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `linear-devotee:devotee` with `SUMMARY: <≤15 words, in the user's language>` and print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`; abort clearly if unavailable.
   - Verify git repo with `git rev-parse --is-inside-work-tree`.
   - Ensure `${CLAUDE_PLUGIN_ROOT}/data`.
2. Input mode:
   - File mode: argument is an existing `.md`; read it, summarize in one paragraph, confirm.
   - Vibe mode: ask one at a time: north star, why now, measurable outcomes, constraints, out of scope. Persist Q&A to `${CLAUDE_PLUGIN_ROOT}/data/vibe-${CLAUDE_SESSION_ID}.txt`.
3. Linear workspace:
   - Fetch teams and existing project statuses.
   - If multiple teams, ask user to choose.
   - Pick initial project status by `status.type`: prefer `backlog`, fallback `planned`; never hardcode status names.
4. Draft:
   - Dispatch `linear-devotee:project-drafter` with:
     ```text
     SPEC_FILE: <abs path | _none_>
     VIBE_BULLETS: <abs path | _none_>
     PROJECT_ROOT: <git root>
     ```
   - Capture the returned Project-SDD, decomposition, and suggested issues.
5. Clarify:
   - Scan `_unclear_` and `Suggested clarifying questions`.
   - Ask one blocking question at a time, patch the draft, repeat until clean or user ships as-is.
6. Preview and approve:
   - Print the full patched draft.
   - Ask `Create this project? (y / edit / cancel)`.
   - Continue only on `y`.
7. Create Linear project:
   - `name`: title extracted from draft.
   - `description`: Project-SDD sections only, excluding decomposition and suggested issues.
   - `teamIds`: selected team id.
   - `statusId`: selected default status id.
   - On API error, surface verbatim and stop with `linear_error`.
8. Patch source spec frontmatter when `SPEC_FILE` exists:
   - `linear-project: <project.id>`
   - `status: ready`
   - `last-reviewed: <today ISO date>`
   - Warn, do not abort, if frontmatter patch fails.
9. Write `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json`:
   ```json
   {
     "current": "create-project",
     "project": { "id": "<id>", "url": "<url>", "name": "<name>", "team_id": "<team.id>", "team_key": "<team.key>" },
     "drafts": {
       "decomposition": "flat | phased",
       "milestones": [{ "name": "Phase 1: <name>", "scope": "<one line>", "target_date": null }],
       "issues": [{ "title": "<title>", "milestone_idx": 0 }]
     },
     "created_at": "<ISO 8601>"
   }
   ```
10. Handoff:
   - Offer `create-milestone` or stop.
   - Print the final report.

## Final Report

```text
linear-devotee:create-project report
  Project:         <name> - <url>
  Team:            <team.key>
  Status:          <status.name> (<status.type>)
  Decomposition:   <flat: N | phased: M phases>
  Drafted issues:  <N>
  Chain state:     ${CLAUDE_PLUGIN_ROOT}/data/chain-<session>.json
  Hand-off:        create-milestone | stop | cancelled | linear_error
```

## Never

- Mutate Linear without explicit approval.
- Run `git push`, `git commit`, or `git rebase`.
- Retry failed Linear writes blindly.
- Write outside plugin `data/`, except the confirmed spec frontmatter patch.
- Invoke another skill programmatically; print the handoff suggestion.
