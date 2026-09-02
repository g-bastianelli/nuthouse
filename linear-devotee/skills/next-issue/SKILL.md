---
name: next-issue
description: Use when the user says a Linear issue is finished/done/complete and wants the next issue to work on, or asks which Linear issue to take next in the same project. Resolves the current issue, reads project issues, respects completed/canceled states and blockers, and recommends the next startable issue without auto-starting greet or mutating Linear.
argument-hint: [issue-id]
model: haiku
effort: medium
allowed-tools: Read, Agent
---

# linear-devotee:next-issue

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Read-only next-work recommender. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Session state: !`cat "${CLAUDE_PLUGIN_DATA}/state-${CLAUDE_SESSION_ID}.json" 2>/dev/null || echo "no state"`

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo. Capture `PROJECT_ROOT = $(git rev-parse --show-toplevel)`.
   - Do not mutate Linear. This skill recommends only.
2. Resolve current issue:
   - Priority:
     1. explicit issue id in `$ARGUMENTS` or the user prompt
     2. `issue` from the `Session state` JSON in `## Context` (skip when it shows `no state`)
     3. most recent `${CLAUDE_PLUGIN_DATA}/greet-<ISSUE_ID>.json`
     4. current branch name containing an issue identifier
   - If absent, ask for the current Linear issue id.
   - Treat the current issue as completed for recommendation purposes when the user says it is finished/done/complete, even if Linear has not been updated yet. Clearly report this as an assumption. Do not change the Linear status.
3. Fetch Linear context:
   - Provider selection: read `${CLAUDE_PLUGIN_ROOT}/shared/provider-selection.md`.
   - Fetch the current issue, including project id/name, team, status, url, relations/blockers if exposed.
   - Fetch all issues in the current issue's project, including identifier, title, url, status name/type, milestone/project milestone, sort/order fields if exposed, and blockers/blockedBy if exposed.
   - If MCP tools are unavailable, use read-only Linear CLI commands via `Bash` (`which linear`, then `linear issue view`, `linear issue list`, or equivalent available subcommands). If neither provider works, stop with `blocked: Linear context unavailable`.
4. Select next issue:
   - Exclude the current issue.
   - Exclude issues whose status type is `completed` or `canceled`.
   - Treat the current issue as completed if step 2 says so.
   - A candidate is startable when every blocking issue is completed/canceled, or the only incomplete blocker is the current issue and the user said it is finished.
   - Prefer candidates in this order:
     1. same milestone/project milestone as the current issue
     2. earliest project milestone sort/order
     3. explicit issue sort/order from Linear
     4. lowest issue number in the same team key
     5. oldest created issue
   - If multiple candidates tie, show the top 3 and recommend the first.
   - If no issue is startable, report the closest blocked issue and list its unresolved blockers.
   - If no open issues remain, report that the project has no next issue.
5. Output:
   - Print a compact recommendation:
     ```text
     Recommended next issue: <identifier> - <title> - <url>
     Reason: <same milestone | earliest unblocked | all blockers satisfied | current issue treated as done>
     Start with: linear-devotee:greet <identifier>
     ```
   - Do **not** write greet state, invoke `linear-devotee:greet`, invoke `linear-devotee:plan`, or continue automatically.
   - If no recommendation exists, print the blocker/all-done reason and omit the `Start with` line.

## Final Report

```text
linear-devotee:next-issue report
  Current issue:    <identifier> - <title>
  Project:          <project.name> (<project.id>)
  Current treated:  done | not-done | unknown
  Candidates:       <N startable> startable · <N blocked> blocked · <N done/canceled> done-or-canceled
  Recommended next: <identifier> - <title> - <url | _none_>
  Hand-off:         user-starts-greet <identifier> | none | blocked
```

## Never

- Mutate Linear status, assignee, priority, labels, blockers, or comments.
- Invoke `linear-devotee:greet`, `linear-devotee:plan`, or implementation work automatically.
- Recommend a blocked issue without explicitly naming the unresolved blocker assumption.
- Run `git push`, `git commit`, or `git rebase`.
