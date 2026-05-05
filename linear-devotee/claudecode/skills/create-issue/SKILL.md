---
name: linear-devotee:create-issue
description: Use when creating a Linear Issue with a strict SDD-formatted description, chained from create-milestone chain state or standalone with project, optional milestone, and issue hint. Drafts via issue-drafter, clarifies, previews, creates on approval, and updates chain state.
effort: high
allowed-tools: Read, Glob, Grep
---

# linear-devotee:create-issue

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo.
   - Ensure `${CLAUDE_PLUGIN_ROOT}/data`.
2. Detect mode from `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json`:
   - Chained only when project, created milestone, and uncreated suggested issue exist.
   - Standalone otherwise.
3. Gather context:
   - Chained: resolve project/team/current milestone. Coerce legacy flat suggested issue strings.
   - Pick the first uncreated issue whose `blocked_by` dependencies are already created in the same milestone.
   - If none remain, exit `nothing-to-do`; if blocked by cycle/missing dep, exit `dependency_cycle`.
   - Standalone: ask user to pick project, optional milestone, then one-sentence issue hint.
4. Draft:
   - Dispatch `linear-devotee:issue-drafter` with:
     ```text
     PROJECT_ID: <id>
     MILESTONE_ID: <id | _none_>
     PARENT_DRAFT: <chain path | _none_>
     ISSUE_HINT: <hint | _none_>
     PROJECT_ROOT: <git root>
     ```
   - If drafter reports cross-project milestone violation, stop with `cross_project_violation`.
5. Clarify:
   - Ask one blocking question at a time for `_unclear_` or suggested questions.
   - Patch draft until clean or user ships as-is.
6. Preview and approve:
   - Print full patched SDD draft.
   - Ask `Create this issue? (y / edit / cancel)`.
   - Continue only on `y`.
7. Create Linear issue:
   - Resolve chained `blocked_by` indices to created issue identifiers; warn and drop unresolved indices.
   - Use `teamId`, `title`, SDD body as `description`, `projectId`, optional `projectMilestoneId`, confirmed `labelIds`, optional `blockedBy`.
   - On API error, surface verbatim and stop with `linear_error`.
8. Update chain state:
   - Append:
     ```json
     {
       "id": "<issue.id>",
       "identifier": "<issue.identifier>",
       "title": "<title>",
       "url": "<url>",
       "project_id": "<PROJECT_ID>",
       "milestone_id": "<MILESTONE_ID or null>"
     }
     ```
9. Handoff:
   - Standalone: final report.
   - Chained: offer next issue if remaining; otherwise final report.

## Final Report

```text
linear-devotee:create-issue report
  Mode:          <chained | standalone>
  Project:       <project.title> (<PROJECT_ID>)
  Milestone:     <milestone.name> | none
  Issue:         <identifier> - <title> - <url> | (cancelled) | (linear_error) | (cross_project_violation)
  Labels:        <comma-separated names | none>
  Phase queue:   <created>/<total> issues for this milestone
  Hand-off:      next-issue | stop | cancelled | linear_error | cross_project_violation | dependency_cycle | nothing-to-do | standalone-done
```

## Never

- Mutate Linear without explicit approval.
- Attach an issue to a milestone from another project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
