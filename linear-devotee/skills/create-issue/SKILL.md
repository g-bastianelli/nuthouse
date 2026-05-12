---
name: create-issue
description: Use to create a single Linear Issue with a strict SDD-formatted description (standalone add-on) or to resume a partially-committed create-project cascade. Reads chain-state to detect resume mode and pick the next issue whose `id` is still null, dispatches issue-drafter, previews, creates on approval, updates chain state, can auto-chain to greet when the cascade completes.
effort: high
allowed-tools: Read, Glob, Grep, Write
---

# linear-devotee:create-issue

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo.
   - Ensure `${CLAUDE_PLUGIN_ROOT}/data`.
2. Detect mode from `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json`:
   - **Resume**: chain-state exists with `phase: "partial_failure"`, `project.id != null`, all required `drafts.milestones[].id` set, and at least one `drafts.issues[].id == null`.
   - **Chained (legacy)**: chain-state exists with project, created milestone, and uncreated suggested issue.
   - **Standalone**: no chain-state, or `phase: "committed" | "cancelled"`.
3. Gather context:
   - **Resume**: project + team + milestone come from chain-state. Pick the first `drafts.issues[]` entry with `id == null` whose `blocked_by_refs` all resolve to entries with `id != null` (topological order). If none remain, exit `nothing-to-do`. If none unblocked but some remain, exit `dependency_cycle`.
   - **Chained (legacy)**: resolve project/team/current milestone. Coerce legacy flat suggested issue strings. Pick the first uncreated issue whose `blocked_by` dependencies are already created in the same milestone. If none remain, exit `nothing-to-do`; if blocked by cycle/missing dep, exit `dependency_cycle`.
   - **Standalone**: ask user to pick project, optional milestone, then one-sentence issue hint.
4. Draft:
   - Dispatch `linear-devotee:issue-drafter` with:
     ```text
     PROJECT_ID: <id>
     MILESTONE_ID: <id | _none_>
     PARENT_DRAFT: <chain path | _none_>
     ISSUE_HINT: <hint | drafted title from chain-state in resume mode>
     PROJECT_ROOT: <git root>
     ```
   - If drafter reports cross-project milestone violation, stop with `cross_project_violation`.
5. Clarify:
   - Ask one blocking question at a time for `_unclear_` or suggested questions.
   - Patch draft until clean or user ships as-is.
   - Resume mode usually has no `_unclear_` left (validated upstream); skip if clean.
6. Preview and approve:
   - Print full patched SDD draft.
   - Ask `Create this issue? (y / edit / cancel)`.
   - Continue only on `y`.
7. Create Linear issue:
   - Resolve `blocked_by` references to created issue identifiers — by `client_ref` in resume mode, by index in legacy chained mode; warn and drop unresolved references.
   - Use `teamId`, `title`, SDD body as `description`, `projectId`, optional `projectMilestoneId`, confirmed `labelIds`, optional `blockedBy`.
   - **`blockedBy` runtime guard**: if `save_issue` rejects `blockedBy` with a schema error, retry once without `blockedBy`, then append `{from_ref, to_ref}` edges to chain-state `blocked_by_pending` for a post-pass. The cascade tail is responsible for flushing them.
   - On API error, surface verbatim and stop with `linear_error`.
8. Update chain state:
   - **Resume**: update the matched `drafts.issues[]` entry **in place** (key on `client_ref`). Set `id`, `identifier`, `url`. If all `drafts.issues[]` now have an `id` and all `drafts.milestones[]` also do, set `phase: "committed"`; otherwise leave `phase: "partial_failure"`.
   - **Chained / standalone (legacy)**: append:
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
   - **Resume**: if more `drafts.issues[].id == null` remain, announce next iteration (the same skill is invoked again). If `phase: "committed"`: rewrite `${CLAUDE_PLUGIN_DATA}/state-${CLAUDE_SESSION_ID}.json` (per `create-project` step 11) and announce auto-chain to `linear-devotee:greet <identifier-of-first-created-issue>` and continue immediately.
   - **Chained (legacy)**: offer next issue if remaining; otherwise final report.
   - **Standalone**: final report.

## Final Report

```text
linear-devotee:create-issue report
  Mode:          <resume | chained | standalone>
  Project:       <project.title> (<PROJECT_ID>)
  Milestone:     <milestone.name> | none
  Issue:         <identifier> - <title> - <url> | (cancelled) | (linear_error) | (cross_project_violation)
  Labels:        <comma-separated names | none>
  Cascade:       <created>/<total> issues · phase: committing | partial_failure | committed | n/a
  Hand-off:      greet <identifier> | next-issue | stop | cancelled | linear_error | cross_project_violation | dependency_cycle | nothing-to-do | standalone-done
```

## Never

- Mutate Linear without explicit approval.
- Attach an issue to a milestone from another project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
