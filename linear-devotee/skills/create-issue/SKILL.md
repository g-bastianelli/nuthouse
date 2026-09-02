---
name: create-issue
description: Use to add a single Linear Issue with an SDD-formatted description to an existing project. Drafts and previews through issue-drafter, clarifies open questions one at a time, and creates the issue only after explicit approval. Use linear-devotee:create-project for a full project cascade or to resume a partially committed one.
effort: high
allowed-tools: Read, Glob, Grep, Bash(git rev-parse:*), Write, Agent, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__list_milestones, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_issue
---

# linear-devotee:create-issue

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid runbook. One issue, one approval.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo; capture `PROJECT_ROOT`.
   - A partially committed cascade is not this skill's job.
     **REQUIRED SUB-SKILL:** for resume, use `linear-devotee:create-project`.
2. Gather context:
   - Fetch active projects with `list_projects` and ask the user to pick one.
   - Fetch that project's milestones with `list_milestones`, ask whether to attach one.
   - Ask for the one-sentence issue hint.
   - **Labels**: fetch the team's labels with `list_issue_labels` and hold an immutable
     `LABEL_MAP` of exact name → id before drafting. Never create a label implicitly.
   - **Source Acceptance namespace**: search `docs/acid-prophet/specs/` for a single spec whose
     `linear-project:` equals the chosen project id and extract its active `AC-###` ids. Multiple
     matches are a blocking clarification. Otherwise `SOURCE_ACCEPTANCE_IDS: _none_`. Never merge
     ids from two specs.
3. Draft — dispatch the logical `linear-devotee:issue-drafter` agent with:
   ```text
   PROJECT_ID: <id>
   MILESTONE_ID: <id | _none_>
   ISSUE_HINT: <hint>
   SOURCE_ACCEPTANCE_IDS: <comma-separated AC-### ids | _none_>
   PROJECT_ROOT: <git root>
   ```
   A cross-project milestone violation stops with `cross_project_violation`.
4. Clarify — ask one blocking question at a time for every `_unclear_` field or suggested
   question. Patch the draft until it is clean, or until the user ships it as is.
5. Preview and approve:
   - Mint one stable `client_ref` and append `<!-- nuthouse-client-ref: <client_ref> -->` to the
     body. The marker is part of the approved description and can never be added or changed later.
   - Print the exact full patched SDD draft and ask `Create this issue? (y / edit / cancel)`.
   - Continue only on `y`.
6. Create — call `save_issue` with the approved body, resolved `projectId`, nullable
   `projectMilestoneId`, and label ids resolved through `LABEL_MAP`. Warn and drop an unknown
   label name rather than inventing one. On timeout or API error, surface it verbatim and stop
   with `linear_error`; a retry must first reload Linear by the exact marker.
7. Hand off — recommend the created issue as the next thing to work on. Print
   `Start with: linear-devotee:greet <identifier>`. Never write greet state or start it yourself.

## Nothing reaches Linear unapproved

**THE PREVIEW IS THE CONTRACT.** What the user approved in step 5 is what gets written, byte for
byte. Never widen it afterwards.

| Excuse                                            | Reality                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| "The draft obviously needed one more label"       | Then re-preview. An unapproved field is an unapproved write.            |
| "The user said yes to the project earlier"        | Approval is per issue, at the preview.                                  |
| "The API rejected a field, I'll adjust and retry" | Surface the error and stop. A silent adjustment is an unapproved write. |

## Final Report

```text
linear-devotee:create-issue report
  Project:    <project.title> (<PROJECT_ID>)
  Milestone:  <milestone.name> | none
  Issue:      <identifier> - <title> - <url> | (cancelled) | (linear_error) | (cross_project_violation)
  Labels:     <comma-separated names | none>
  Next:       Start with linear-devotee:greet <identifier>
```

## Never

- Mutate Linear without explicit approval at the preview.
- Attach an issue to a milestone from another project.
- Retry a failed Linear write blindly.
- Create a label implicitly.
- Run `git push`, `git commit`, or `git rebase`.
