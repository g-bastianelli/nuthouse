---
name: linear-devotee:create-milestone
description: Use when adding a Linear Milestone to a Project, chained from create-project chain state or standalone with a selected project and phase hint. Drafts via milestone-drafter, clarifies, previews, creates on approval, updates chain state, and can hand off to create-issue.
effort: high
allowed-tools: Read, Glob, Grep
---

# linear-devotee:create-milestone

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `linear-devotee:devotee` with `SUMMARY: <≤15 words, in the user's language>` and print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo.
   - Ensure `${CLAUDE_PLUGIN_ROOT}/data`.
2. Detect mode from `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json`:
   - Chained when `project.id` exists.
   - Standalone otherwise.
3. Gather context:
   - Chained: use project fields and next uncreated `drafts.milestones[]`; exit `nothing-to-do` if all created.
   - Standalone: fetch active projects, ask user to pick, then ask for one-sentence milestone hint.
4. Draft:
   - Dispatch `linear-devotee:milestone-drafter` with:
     ```text
     PROJECT_ID: <id>
     PARENT_DRAFT: <chain path | _none_>
     MILESTONE_HINT: <hint | _none_>
     PROJECT_ROOT: <git root>
     ```
   - Capture milestone draft, suggested issues, open decisions, questions.
5. Clarify:
   - Ask one blocking question at a time for `_unclear_` or suggested questions.
   - Patch draft until clean or user ships as-is.
6. Preview and approve:
   - Print full patched draft.
   - Ask `Create this milestone? (y / edit / cancel)`.
   - Continue only on `y`.
7. Create Linear milestone:
   - `name`, `projectId`, `description` excluding suggested issues/open decisions/questions.
   - `targetDate` only if suggested and confirmed.
   - On API error, surface verbatim and stop with `linear_error`.
8. Update chain state:
   - Parse suggested issues into `{ idx, title, blocked_by }`; drop invalid blocked indices with warning.
   - Append:
     ```json
     {
       "id": "<milestone.id>",
       "name": "<name>",
       "url": "<url>",
       "idx_in_drafts": "<int|null>",
       "suggested_issues": [{ "idx": 0, "title": "<title>", "blocked_by": [] }]
     }
     ```
   - Preserve existing project/draft fields; set `current` and `current_milestone_id`.
   - Backward compatibility: coerce flat suggested issue strings into structured entries.
9. Handoff:
   - Offer `create-issue`.
   - In chained mode with remaining drafted milestones, also offer next milestone.
   - Print final report.

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
- Attach a milestone to the wrong project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
