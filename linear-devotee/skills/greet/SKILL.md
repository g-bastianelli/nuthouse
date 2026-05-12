---
name: linear-devotee:greet
description: Use in Codex when a Linear issue identifier is supplied or detectable from the current branch. Delegates issue context, optionally prepares branch/status, resolves source spec, writes greet context, then hands off to plan. Never writes implementation code.
---

# Linear Devotee Greet for Codex

Rigid context gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, ask the cheapest available delegation path for one decorative line via `linear-devotee/shared/persona-line-contract.md` with `SUMMARY: <≤15 words, in the user's language>`; otherwise skip. Never block.

## Workflow

1. Track progress with `update_plan`.
2. Preconditions:
   - `tool_search` query `linear`; abort clearly if unavailable.
   - Verify git repo.
   - Detect issue id from argument or branch regex `[A-Z]+-[0-9]+`.
   - Ensure `linear-devotee/data/`.
   - Keep full issue context out of the main model when delegation is available.
3. Delegate issue context:
   ```text
   ISSUE_ID: <id>
   PROJECT_ROOT: <repo root>
   NEEDS_STATUS_METADATA: true
   ```
   The read-only scout returns the SDD issue-context brief, current status, started state id, referenced files, and ambiguities. If no scout is available, gather the same data locally with minimal context. Unknowns stay `_unclear_`.
4. Branch preparation:
   - On `main`, `master`, or `staging`, propose `<git-user>/<id-lowercase>-<kebab-title-trimmed-50char>`.
   - Ask before branch creation; if dirty, ask stash or skip.
   - Never push, commit, or rebase.
5. Optional In Progress:
   - Use delegated status metadata.
   - If not `started`, ask before setting `stateId` to the team's started workflow state.
6. Resolve source spec:
   - Search `docs/acid-prophet/specs/`.
   - Choose only unambiguous matches: `linear-project:` exact project id, exact issue id in body, then project slug/name in body or filename.
   - Ask if multiple; use `_none_` if none.
   - Never compare drift or patch specs here.
7. Write `linear-devotee/data/greet-<ISSUE_ID>.json` with issue id/title, brief markdown, spec file, branch, status, timestamp.
8. Handoff:
   - Auto-chain to `plan` on the happy path. Print `linear-devotee:plan <ISSUE_ID>` and continue immediately — do not ask the user for confirmation. The user's only validation point is the plan's own `Validate this plan? (y / edit / stop)` gate.
   - On error paths (no issue id, brief skipped, branch refused, status flip blocked), stop instead of chaining and report the reason.
   - Do not draft a plan or offer implementation.

## Final Report

```text
linear-devotee:greet report
  Issue:           <id> - <title>
  Status:          <current> (was <prior if changed>)
  Branch:          <current branch> (created: <new-branch> if applicable)
  Brief:           delivered | skipped (<reason>)
  Spec:            <path | _none_>
  Context:         <path>
  Hand-off:        plan | stop
```

## Never

- Mutate Linear without confirmation, except no-op reads.
- Write implementation code.
- Draft plans; use `linear-devotee:plan`.
- Patch Acid Prophet specs.
- Run `git push`, `git commit`, or `git rebase`.
