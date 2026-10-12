---
name: finish-pr
description: Finish an existing GitHub PR through native Codex or Claude review, scoped fixes, CI, review comments, and a protected merge. Use for explicit PR completion or an authorized full-delivery handoff; inspection and review alone do not authorize merge.
effort: high
argument-hint: "<PR URL>"
allowed-tools: Read, Edit, Write, Bash(node:*), Skill(git-gremlin:commit), Skill(git-gremlin:handle-review-comments), Skill(moon-moth:verify), Skill(code-review), Bash(git status:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git remote:*), Bash(git config:*), Bash(git fetch:*), Bash(git merge-base:*), Bash(git merge --ff-only:*), Bash(git push:*), Bash(git check-ignore:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(gh pr ready:*), Bash(gh pr merge:*), Bash(gh api:*), Bash(codex review:*)
---

# git-gremlin:finish-pr

Finish the existing PR and report what GitHub actually did. A queued merge is still waiting.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output until the final
report. Match the user's language and keep technical identifiers unchanged.

## Authority and inputs

An explicit request to finish the PR, or a full-delivery caller that already includes merge,
authorizes scoped fixes, checks, commits, pushes, review-thread replies/resolution, marking the
draft ready, and merging that PR under repository policy. Preserve narrower user limits. An
inspection, review-only request, or ordinary `git-gremlin:pr` draft handoff supplies no merge
authority. Report the missing boundary rather than acquiring it through a skill chain.

Use the PR URL, issue/source Acceptance when present, the intended repository/head/base, existing
verification, and caller authority. Resolve the runtime from the active session. Preserve the
issue's workspace and branch. This skill owns no Linear transition or project dispatch.

Claude's tool grants apply to the invoking turn; runtime permission rules still govern every
operation. If a required operation needs permission, report that precise boundary. Do not
change permission modes or accept a permission prompt automatically to keep delivery moving.

## Workflow

1. **Reconcile the PR first.** Read its live repository, head repository/branch/OID, base
   branch/OID, state, and merge result. Match them to the caller and local Git repository before
   editing or pushing; a branch-name match alone is insufficient for forks. Reuse that PR.
   - Already merged: return `merged` with GitHub's `mergedAt` and merge commit, even if an
     earlier session never reported completion. Do not replay review or merge.
   - Closed without merge, conflicting identities, or an unrelated dirty/staged selection:
     return `blocked` with the concrete mismatch. Do not reopen or create a replacement.
   - Local commits ahead on the authorized branch: inspect their scope and verify them. Push
     only when the observed remote PR head is an ancestor of local HEAD. If local HEAD is
     behind, fast-forward the clean owned branch; divergent history requires reconciliation,
     never a force-push. Refresh and verify the remote head after publishing.
2. **Review the actual PR diff.** Fetch the intended base through its verified remote and record
   local HEAD plus base OID. Reuse a completed native review only if its head, base, scope, and
   finding dispositions still match. Otherwise start the runtime's native reviewer, await its
   completed findings, and read the result. An exit code of zero, successful tool envelope, or neutral GitHub review
   check is not a clean review.
   - In Codex, read [references/codex-review.md](references/codex-review.md) before review.
   - In Claude Code, read [references/claude-review.md](references/claude-review.md) before review.

   Adjudicate each finding against reachable code, intended behavior, and source Acceptance.
   Repair supported defects within scope; record the technical reason for a false positive or
   out-of-scope suggestion. Do not expand the issue to satisfy speculative reviewer text. A
   material product tradeoff or contradictory requirement becomes one actionable question.

3. **Repair and verify.** Read all current review threads and review bodies with pagination;
   include outdated unresolved threads and actionable feedback in ordinary PR comments. Fix
   supported defects and relevant CI failures. Run repository-required checks and tests that
   demonstrate the repair. In a configured Moon workspace, use the available `moon-moth:verify`.
   Preserve the existing authority and stage only this delivery's paths.

   **REQUIRED SUB-SKILL:** Use `git-gremlin:commit` for verified scoped changes.

   Publish commits to the verified PR head repository/branch using a normal fast-forward push,
   with each argument separately quoted. Compare GitHub's new head with local HEAD before any
   reply claiming a fix. On push failure, read back the remote before deciding what landed;
   stop retries until the failure is understood. Do not call `pr` to create another PR.

   **REQUIRED SUB-SKILL:** Use `git-gremlin:handle-review-comments` when handling PR feedback.

   Explain declined feedback before resolving its thread. An unresolved serious concern or
   requested product decision stays open; do not classify it as a refusal just to clear the
   gate. Never dismiss a review or invent approval. A review requesting changes remains a
   blocker until the reviewer or authorized owner clears it through GitHub's normal process.
   After code or relevant base changes, refresh checks and native review against the new diff.
   Reuse a completed review only when its head, base, and scope still match.

4. **Observe readiness.** Once native findings are addressed and local verification is current,
   mark an owned draft ready if authorized. For an open PR, read
   [references/github-readiness.md](references/github-readiness.md) and use its direct `gh`
   observations. Inspect the current head/base, CI, expected external reviews, required review
   decision, every unresolved thread, latest opinionated reviews, and GitHub merge restrictions.
   Compare head/base before and after fetching pages; changed or partial evidence requires a
   fresh read.

   When a caller supplies an automatic continuation destination, read
   [references/wait-for-pr.md](references/wait-for-pr.md) and capture its baseline **before** the
   final readiness read. Return an exact pending condition and observation request as soon as
   external progress is needed. The delivery owner starts one bounded observer; this skill
   never waits by spending repeated model turns on unchanged GitHub reads.

   Require explicit completion evidence for each expected external reviewer on the current head,
   independently of CI buckets and approval requirements. A green draft-skipped CodeRabbit check
   does not satisfy this gate. Missing, pending, skipped, stale, or ambiguous review evidence
   keeps the PR waiting. After external review completes, reload its findings and all threads;
   return to repair and verification when needed, then refresh readiness for the resulting head.

   All reported CI must be successful or completed conditional skips, with at least one
   successful check. No CI, unavailable evidence, unknown mergeability, missing required
   checks/approvals, unresolved threads, or GitHub restrictions leave the gate closed. Use
   GitHub's merge and review decisions instead of reproducing ruleset policy. A repository with
   no CI needs an explicit verification-policy decision; do not silently waive the user's CI gate.

5. **Request the protected merge.** Immediately before merging, confirm a clean relevant worktree,
   local/remote head equality, the reviewed base, fresh GitHub readiness, completed native and
   expected external reviews with addressed findings, and the repository's permitted merge
   method. Follow its configured method; use the sole allowed method when unambiguous. If a merge
   queue is required, use its native queue path.

   ```text
   gh pr merge <PR-URL> --match-head-commit <expected-head-oid> <permitted-method-flag>
   ```

   Omit the method flag when the required queue owns it. Never pass `--admin`, disable a branch
   rule, forge approval, delete the workspace/branch, or enable auto-merge while review findings
   remain. `--match-head-commit` prevents a newer unreviewed head from being merged by this
   request. GitHub still enforces current protections; observations never authorize a bypass.

6. **Confirm the result.** Read back GitHub state after every merge attempt, including errors or
   timeouts. Return `merged` only with the actual merged timestamp and commit. Auto-merge enabled,
   accepted queue entry, and a successful command with an open PR are `waiting`. If the head or
   base moved, refresh the affected review/checks before any further merge request. Do not resend
   a merge request while the matching PR is already queued.

## Waiting and recovery

Keep moving while scoped repairs make observable progress. Two consecutive repair/review passes
that leave the same blocker unchanged return `blocked` with the attempted fixes and the smallest
decision needed. For external reviews, checks, approval, or queue progress, refresh after a
relevant event; return `waiting` immediately with the exact PR, observed head/base, pending
condition, and next observation needed. A standalone caller receives an explicit resume action.
An automatic delivery caller owns the single observer described in
[references/wait-for-pr.md](references/wait-for-pr.md), its runtime completion, and resuming this
same PR. Expiration or observation failure returns control with a concrete manual next action;
it does not silently start another observer. Missing external approval is not a reason to ask
the user to repeat merge authorization.

When a caller owns a compaction ledger, add only the PR, latest observed head/base, completed
review/check summary, current reason/question, and next action there. Otherwise create a disposable
`.nuthouse/pr-<number>/progress.md` at the repository root only if continuity needs it, starting
with `# ledger — PR: <URL>`. Before writing, confirm the path is untracked and ignored with
`git check-ignore`; if needed, append `/.nuthouse/` to the local exclude file resolved by
`git rev-parse --git-path info/exclude`, preserving its existing contents, then verify again.
Do not change tracked `.gitignore` solely for this ledger or stage the ledger.

On resume, refresh GitHub and Git before using those notes; reuse the existing PR and
already-visible replies. A failed Linear update after a successful merge belongs to the caller
and never reopens this delivery cycle.

## Report

Survived the pipeline. Report the actual outcome without announcing a merge early:

```text
git-gremlin:finish-pr report
  Outcome:      merged | waiting | blocked
  PR:           <url>
  Head:         <latest observed head OID>
  Review:       <runtime, reviewed head/base, expected external-review completion evidence, finding dispositions>
  Verification: <local checks and current GitHub evidence>
  Merge:        <mergedAt + merge commit, queue/open state, or not requested>
  Pending:      <exact external condition; operation/request for an automatic caller, otherwise resume action>
  Next:         <specific observation/action, or one question with context>
```
