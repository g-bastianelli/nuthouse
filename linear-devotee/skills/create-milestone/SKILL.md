---
name: create-milestone
description: Use to add a single Milestone to an existing Linear Project. Drafts through milestone-drafter, clarifies open questions one at a time, and creates the milestone only after explicit approval. Use linear-devotee:create-project for a full project cascade or to resume a partially committed one.
effort: high
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Write, Agent, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__save_milestone
---

# linear-devotee:create-milestone

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid runbook. One milestone, one approval.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo; capture `PROJECT_ROOT`.
   - A partially committed cascade is not this skill's job.
     **REQUIRED SUB-SKILL:** for resume, use `linear-devotee:create-project`.
2. Gather context — fetch active projects with `list_projects`, ask the user to pick one, then
   ask for the one-sentence milestone hint.
3. Draft — dispatch the logical `linear-devotee:milestone-drafter` agent with:
   ```text
   PROJECT_ID: <id>
   MILESTONE_HINT: <hint | _none_>
   PROJECT_ROOT: <git root>
   ```
   Capture the milestone draft, its suggested issues, open decisions, and questions.
4. Clarify — ask one blocking question at a time for every `_unclear_` field or suggested
   question. Patch the draft until it is clean, or until the user ships it as is.
5. Preview and approve:
   - Mint one stable `client_ref` and append `<!-- nuthouse-client-ref: <client_ref> -->` to the
     exact milestone description. The marker is part of the approved description and can never be
     added or changed later.
   - Print the full patched draft including the marker and ask
     `Create this milestone? (y / edit / cancel)`.
   - Continue only on `y`.
6. Create — call `save_milestone` with the approved description, resolved `projectId`, and the
   confirmed nullable target date. On timeout or API error, surface it verbatim and stop with
   `linear_error`; a retry must first reload Linear by the exact marker.
7. Hand off — report the suggested issues this milestone implies.
   **REQUIRED SUB-SKILL:** to add one of them, use `linear-devotee:create-issue`.

## Nothing reaches Linear unapproved

**THE PREVIEW IS THE CONTRACT.** What the user approved in step 5 is what gets written, byte for
byte. Never widen it afterwards.

| Excuse                                              | Reality                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| "The target date was obviously meant to shift"      | Then re-preview. An unapproved field is an unapproved write.            |
| "The user approved the project, this is part of it" | Approval is per milestone, at the preview.                              |
| "The API rejected a field, I'll adjust and retry"   | Surface the error and stop. A silent adjustment is an unapproved write. |

## Final Report

```text
linear-devotee:create-milestone report
  Project:           <project.title> (<project.id>)
  Milestone:         <name> - <url> | (cancelled) | (linear_error)
  Suggested issues:  <N>
  Next:              linear-devotee:create-issue | stop
```

## Never

- Mutate Linear without explicit approval at the preview.
- Attach a milestone to the wrong project.
- Retry a failed Linear write blindly.
- Run `git push`, `git commit`, or `git rebase`.
