---
name: pr
description: Draft a GitHub PR, run native code review, and publish it as a draft after approval or an authorized implementation handoff. Text-only requests stop at the proposal; publication does not authorize merge.
effort: high
allowed-tools: Read, Edit, Write, Bash(git status:*), Bash(git log:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git remote:*), Bash(git config:*), Bash(git fetch:*), Bash(git push:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(gh pr create:*), Bash(codex review:*), Bash(claude -p:*), Skill(code-review), Skill(git-gremlin:commit), Skill(moon-moth:verify)
---

# git-gremlin:pr

Draft, review, publish as draft. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the line below still shows a raw,
> unexpanded dynamic-context command, run it manually before step 1.

- Branch: !`git branch --show-current`

## Workflow

For a text-only title/body request, use the supplied changes or available local history/diff
and follow step 2's drafting rules, then display the proposal and stop. This path does not
require GitHub authentication, a feature branch, or commits ahead, and skips publication
checkpoints, native review, repairs, and mutations. Disclose missing change evidence rather
than inventing PR content.

1. Check the minimum preconditions.
   - Verify `gh` is available and authenticated with `gh auth status`.
   - Resolve the intended base from the caller, otherwise use
     `gh repo view --json defaultBranchRef`, falling back to `main`.
   - Stop on a detached `HEAD`, when the current branch is the base branch, or when no
     commits exist ahead of the base.
   - Capture the current branch and `HEAD_OID = git rev-parse HEAD`.
   - Run the checkpoint below only when the delivery context names a spec or issue
     Acceptance, or the branch carries a Linear issue id. Otherwise skip it: ad-hoc work
     without a source skips drift without asking, and the proposal says drift was not
     assessed. Approval and native code review still apply. A `skipped: no source` result
     from the checkpoint is handled the same way.

   **REQUIRED SUB-SKILL:** Use `acid-prophet:check-drift` when available, with the source,
   resolved intended base, intended PR scope, the plan path when the delivery context has one, and
   `--scope committed` — only HEAD ships, so there is no separate worktree pass here.
   Relevant uncommitted changes are reported as outside the PR, not analyzed. Reuse a report from this session that already covers this source,
   scope, and content (a worktree report whose assessed paths were then committed with
   nothing relevant left dirty). Follow its plugin's `shared/development-drift.md` for
   findings and existing repair authority. Do not publish with unresolved drift or
   ambiguous findings. Local fixes must enter HEAD through an authorized commit workflow
   before clearing committed drift. If the skill is unavailable, disclose that limitation
   without claiming a clean result. After any authorized repairs, refresh branch and
   `HEAD_OID` before drafting.

2. Read `git log <base>...HEAD --oneline` and `git diff <base>...HEAD`. Detect Linear
   issue ids with `/\b[A-Z][A-Z0-9]+-[0-9]+\b/`, preferring the branch, then the log, then
   the diff. When exactly one id is unambiguous, suffix the title with ` [<id>]`; when
   several ids remain ambiguous, add no suffix. Draft an imperative title no longer than
   72 characters including any Linear suffix, preserving a useful conventional type or
   scope from the commits. Draft a body with `## Summary` and one to three bullets, then
   `## Test plan` with a checklist, then `Closes <id>` on its own line when one unambiguous
   Linear id was detected. Do not invent changes or verification absent from the inputs.
3. When a workflow chained to this skill as its delivery step
   (such as `linear-devotee:plan` after a verified implementation),
   that chain is the approval: display the proposal and continue at step 5. Otherwise display
   the title, body, and `<branch> → <base>`, then wait for confirmation or edits. This is the
   only extra approval gate.
4. After confirmation, verify that the branch and `HEAD_OID` still match the proposal. If they
   changed, regenerate it and ask again.
   Revalidate drift report inputs too: base, source (including remote Acceptance when used),
   recorded decisions, relevant worktree changes, and intended scope. Refresh affected
   comparisons if any changed during the approval wait; unresolved findings stop publication.
   If that changes the PR proposal, present the updated proposal for approval.
5. Before publishing, read [the shared native-review procedure](../../shared/native-review.md)
   and apply it to the complete committed PR diff. This gate also applies without a spec or
   Linear issue. Read only the active runtime's provider reference before invoking review:
   - Codex: [native Codex review](../../shared/codex-review.md).
   - Claude Code: [native Claude Code review](../../shared/claude-review.md).

   Await findings and resolve them under the existing implementation authority. A PR-only
   request with supported defects returns the findings and missing repair authority without
   pushing. An implementation handoff authorizes scoped repairs, their checks, and the
   following commit; it does not need another approval.

   **REQUIRED SUB-SKILL:** Use `git-gremlin:commit` for verified authorized review repairs only.

   After repairs, refresh `HEAD_OID`, source drift when applicable, and the title/body from
   the final commits and verification. Under standalone PR approval, present a changed proposal
   for confirmation; under an authorized implementation handoff, display it and continue.
   Retain the completed review evidence for the caller. Immediately before pushing, compare
   branch, head, base OID, scope, and relevant worktree with that review and the approved
   proposal; refresh affected review/drift evidence and approval if they changed. Unavailable
   review, unresolved supported findings, or stale evidence prevents publication.

6. Resolve the push remote in this order: `branch.<BRANCH>.pushRemote`,
   `remote.pushDefault`, `branch.<BRANCH>.remote`, `origin`, then the sole configured remote.
   Stop if the result is local (`.`), missing, or ambiguous.
7. Run `git push --set-upstream "<REMOTE>" "HEAD:refs/heads/<BRANCH>"`. Never force-push.
   `--set-upstream` is what leaves the branch with an upstream: it is silently ignored on an
   OID refspec, and `push.autoSetupRemote` only covers a push with no refspec, so a branch
   pushed either of those ways has none and tooling that maps a branch to its PR finds
   nothing. If the push fails, surface stderr verbatim and do not retry or create the PR.
8. Verify what actually landed: `git rev-parse "<REMOTE>/<BRANCH>"` must equal `<HEAD_OID>`.
   On mismatch, stop without creating the PR and report both OIDs — the remote holds
   something the user never approved.
9. Run
   `gh pr create --draft --head "<BRANCH>" --title "<TITLE>" --body "<BODY>" --base "<BASE>"`,
   passing every value as a separately quoted argument without `eval`. Omit `--draft` only
   when the user explicitly asked for a PR ready for review. If it fails,
   surface stderr verbatim and do not retry. On success, capture the PR URL from stdout.

Reuse current implementation verification; run checks when review repairs require fresh evidence.
Native code review and source drift are distinct pre-publication checkpoints. This skill does
not merge the PR, update issue or project state, orchestrate follow-up work, or infer human
acceptance unless the user asks for that work separately.

## Final Report

```text
git-gremlin:pr report
  PR:     <url>
  Title:  <pr title>
  Base:   <base branch>
  Branch: <branch> published via <remote>
  Review: <runtime, reviewed head/base, scope, findings and dispositions, repair/check results>
```

## Never

- Push during drafting or before the user confirms the displayed PR proposal, unless a
  chaining workflow authorized it (step 3).
- Push when the current branch or `HEAD` differs from the approved proposal.
- Push the base branch, force-push, or choose between ambiguous remotes.
- Create a PR without explicit user confirmation or a chaining workflow's authorization.
- Retry silently after `git push` or `gh pr create` failure.
- Publish without completed native review of the current PR diff, or treat passing tests,
  drift checks, or the implementing agent's self-review as a substitute.
- Repair code without existing implementation authority, merge, update external issue state,
  or invoke unrelated workflows. Scoped review repairs and their checks belong to the
  authorized implementation handoff.
