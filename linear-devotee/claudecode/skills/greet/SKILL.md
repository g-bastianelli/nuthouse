---
name: linear-devotee:greet
description: Use immediately at session start when a Linear issue identifier is detected from branch or first prompt. Delegates issue context to issue-context, optionally prepares branch/status, resolves source spec, writes greet context, then hands off to plan. Never writes implementation code.
effort: high
allowed-tools: Read, Glob, Grep
---

# linear-devotee:greet

Rigid context gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `linear-devotee:devotee` with `SUMMARY: <≤15 words, in the user's language>` and print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo.
   - Read `${CLAUDE_PLUGIN_DATA}/state-<session_id>.json`; extract `issue`, `current_branch`, `needs_branch`.
   - Stop if `greeted: true` or no issue id.
   - Do not fetch full issue context in main context.
2. Delegate context:
   - Dispatch `linear-devotee:issue-context` with:
     ```text
     ISSUE_ID: <id>
     PROJECT_ROOT: <git root>
     NEEDS_STATUS_METADATA: true
     ```
   - Present the returned SDD brief unchanged.
   - If issue does not exist, mark `greeted: true`, report `Brief: skipped`, and stop.
3. Branch preparation when `needs_branch: true`:
   - Build `<git-user>/<id-lowercase>-<kebab-title-trimmed-50char>`.
   - Ask before creating.
   - If dirty, ask stash or abort branch creation.
   - Optional `git pull --ff-only` only after asking.
   - Create or checkout existing branch.
   - Never push, commit, or rebase.
4. In Progress status:
   - Use `issue-context` status metadata.
   - If status type is not `started`, update Linear with the returned started `stateId`.
   - This flip is authorized by greet; no extra confirmation.
5. Resolve Acid Prophet spec:
   - Search `<PROJECT_ROOT>/docs/acid-prophet/specs/`.
   - Choose only unambiguous matches, priority:
     1. `linear-project:` equals issue project id.
     2. Spec body contains exact issue id.
     3. Body or filename matches project slug/name.
   - Ask if multiple candidates; use `_none_` if none.
   - Never compare drift or patch specs here.
6. Write context:
   - Update state: `greeted: true`, `issue_context_brief`, `spec_file`.
   - Write `${CLAUDE_PLUGIN_ROOT}/data/greet-<ISSUE_ID>.json`:
     ```json
     {
       "issue_id": "<ID>",
       "issue_title": "<title>",
       "issue_context_brief": "<markdown>",
       "spec_file": "<path | _none_>",
       "branch": "<current branch>",
       "status": "<status.name> (<status.type>)",
       "created_at": "<ISO 8601>"
     }
     ```
7. Handoff:
   - Auto-chain to `plan` on the happy path. Print `linear-devotee:plan <ISSUE_ID>` and continue immediately — do not ask the user for confirmation. The user's only validation point is the plan's own `Validate this plan? (y / edit / stop)` gate.
   - On error paths (no issue id, brief skipped, branch refused, status flip blocked), stop instead of chaining and report the reason.
   - Do not draft a plan or offer code.

## Final Report

```text
linear-devotee:greet report
  Issue:           <id> - <title>
  Status:          <current> (was <prior if changed>)
  Branch:          <current branch> (created: <new-branch> if applicable)
  Brief:           delivered (issue-context) | skipped (reason)
  Spec:            <path | _none_>
  Context:         ${CLAUDE_PLUGIN_ROOT}/data/greet-<ISSUE_ID>.json
  Hand-off:        plan | stop
```

## Never

- Write implementation code.
- Draft or validate implementation plans; use `linear-devotee:plan`.
- Patch Acid Prophet specs.
- Re-greet a session.
- Mutate Linear except the authorized In Progress flip.
- Run `git push`, `git commit`, or `git rebase`.
