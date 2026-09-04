---
name: pr
description: Use automatically when the user asks to create, open, draft, or publish a GitHub PR, pull request, review request, "ouvre une PR", "fais la PR", "crée une pull request", or says the branch is ready for review. Drafts from branch history and, after confirmation, publishes the branch before creating the PR. Do not use for commits, plain git status, diff, log, push-only, rebase, or non-GitHub merge requests.
effort: high
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(git diff:*), Bash(git rev-parse:*), Bash(git remote:*), Bash(git config:*), Bash(git push:*), Bash(gh auth status:*), Bash(gh repo view:*), Bash(gh pr create:*), Read
---

# git-gremlin:pr

Rigid approval gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Branch: !`git branch --show-current`
- Commits vs main: !`git log --oneline origin/main..HEAD 2>/dev/null | head -20`

## Workflow

1. Preconditions:
   - Verify `gh` is available and authenticated: `gh auth status`. Abort with `gh auth login` instruction if not.
   - Infer base branch: `gh repo view --json defaultBranchRef` or fallback `main`.
   - Abort on a detached `HEAD`; branch publication requires a named current branch.
   - Abort when the current branch equals the base branch. A PR source must be a distinct named branch.
   - Capture the full commit OID with `git rev-parse HEAD`. This `HEAD_OID` binds the displayed proposal to the exact source content that may later be published.
   - Verify commits exist ahead of base: the `Commits vs main` snapshot in `## Context` covers the common case; re-run `git log <base>...HEAD --oneline` when the base is not `main` or the snapshot is empty. Abort if no commits exist ahead of base.
2. Draft PR title and description:
   - Read `git log <base>...HEAD --oneline` and `git diff <base>...HEAD` directly.
   - Detect Linear issue ids with `/\b[A-Z][A-Z0-9]+-[0-9]+\b/`, preferring the
     branch, then the log, then the diff. When one id is unambiguous, suffix the title
     with ` [<id>]`; when several ids remain ambiguous, add no suffix.
   - Draft an imperative title no longer than 72 characters, including any Linear
     suffix. Preserve the best existing conventional type or scope marker from the
     branch commits, such as `(fix)`, `chore:`, or `feat(scope):`.
   - Draft the body with `## Summary` and one to three bullets, then `## Test plan`
     with a checklist. Append `Closes <id>` on its own line when one unambiguous Linear
     id was detected. Do not invent changes or verification absent from the inputs.
   - Bind the proposal to the captured base, branch, and `HEAD_OID`.
   - Immediately before displaying the proposal, re-run `git branch --show-current` and `git rev-parse HEAD`. If either differs from the captured branch or `HEAD_OID`, discard the stale proposal and restart step 2 with fresh log and diff.
   - Display the proposed title, description, branch, base, and exact `HEAD_OID`, then wait for confirmation or an edit request. State that confirmation authorizes publishing only that commit to the same-named branch on the resolved Git remote, then creating the PR. A Maestro project control record is not PR approval.
3. Create PR:
   - Before any mutation, verify that the current branch and `git rev-parse HEAD` still
     equal the approved values. If either changed, return to step 2 with fresh context
     and require a new confirmation.
   - Resolve only the push remote. Consider configured remotes other than `.` and prefer,
     in order: `branch.<BRANCH>.pushRemote`, `remote.pushDefault`,
     `branch.<BRANCH>.remote`, `origin`, then the sole configured remote. Ignore
     `branch.<BRANCH>.merge`; if no unique remote can be resolved, stop before mutation.
   - Publish the immutable approved commit with
     `git push "<REMOTE>" "<HEAD_OID>:refs/heads/<BRANCH>"`. Never substitute symbolic
     `HEAD`, publish to a differently named branch, or force-push. If push fails, surface
     stderr verbatim and do not retry or create the PR.
   - After a successful push, configure the same-named upstream with
     `git config "branch.<BRANCH>.remote" "<REMOTE>"` and
     `git config "branch.<BRANCH>.merge" "refs/heads/<BRANCH>"`.
   - Run `gh pr create --head "<BRANCH>" --title "<TITLE>" --body "<BODY>" --base "<BASE>"`,
     passing every value as a separately quoted argument without `eval`. If it fails,
     surface stderr verbatim and do not retry. On success, capture the PR URL from stdout.
   - On rejected confirmation, offer to regenerate or cancel. Never create a PR silently.
4. Report and hand off:
   - Return result.
   - Report `Human feature acceptance: pending (mandatory)` unless explicit human
     acceptance evidence already exists. This gate is distinct from PR approval and can
     never be inferred from checklist generation, passing checks, review approval, or an
     open PR.
   - Always report `Merge: manual`. Manual merge remains mandatory; neither this skill,
     GitHub review state, nor Maestro may merge the PR. PR creation also does not
     authorize Linear completion.
   - Stop after the report. If the issue belongs to an active Maestro project, mention only this optional next action: after Linear records the issue completed, the user or a known workflow may invoke `monkey-maestro:orchestrate <project-id>`. Never invoke it automatically and never treat the PR as Linear completion. Reserve `monkey-maestro:reconcile <project-id>` for an explicit Superset runtime-correlation audit or telemetry repair.

## Verification is not optional

**A PR PUBLISHES A COMMIT; THE VERIFICATION MUST HAVE RUN ON THAT EXACT COMMIT.**

| Excuse                                            | Reality                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| "Verification passed before the last commit"      | Earlier evidence describes a tree that no longer exists. Re-run it on `HEAD`. |
| "The tree is dirty but nothing important changed" | Uncommitted content is not in the PR. Commit or stash it, then verify.        |
| "CI will run the checks anyway"                   | CI runs after the PR exists. The gate is here.                                |

When this branch closes work that came through `linear-devotee:plan`, require a clean
flight on the current `HEAD` with no uncommitted changes. If none ran, or commits landed
after it, say so and verify before drafting.

**REQUIRED SUB-SKILL (issue-delivery in a configured Moon workspace only):** Use
`moon-moth:verify` when it is installed. In every other case — including a non-Moon repo
where Moon Moth happens to be installed — run the exact check commands documented in the
repo's `AGENTS.md`, `CLAUDE.md`, or `package.json`. Never block a PR on a verifier the
repository does not have.

## Final Report

```text
git-gremlin:pr report
  PR:     <url>
  Title:  <pr title>
  Base:   <base branch>
  Branch: <branch> published via <remote>
  HEAD:   <approved HEAD_OID>
  Human feature acceptance: pending (mandatory) | accepted (explicit human evidence)
  Merge:  manual
  Project execution: optional monkey-maestro:orchestrate <project-id> after Linear completion | n/a
```

## Never

- Push during drafting or before the user confirms the displayed PR proposal.
- Push when the current branch or `HEAD` differs from the approved proposal.
- Push the base branch or publish `HEAD` to any remote ref other than `refs/heads/<BRANCH>`.
- Force-push or choose between multiple ambiguous remotes.
- Create a PR without explicit user confirmation.
- Skip the `gh auth status` check.
- Retry silently after `git push` or `gh pr create` failure — surface stderr verbatim and stop.
- Reuse verification that ran before the last commit or on a dirty working tree.
- Automatically invoke `monkey-maestro`, accept a feature, merge, or claim Linear
  completion from PR creation, review state, verification, or checklist evidence.
- Treat a PR as Linear completion; Linear lifecycle remains external and explicit.
