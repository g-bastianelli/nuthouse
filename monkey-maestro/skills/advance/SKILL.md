---
name: advance
description: Use when a feature is implemented, verified, and its PR is open or merged and the autopilot relay must move on — auto-invoked by git-gremlin:pr in autopilot, or "issue suivante", "continue le relais", "next movement". Reviews an open PR and records the human acceptance, then waits for that exact PR to be merged into its base branch. Only a verified merged PR can resolve and spawn the next issue. Does not merge. Does not use local relay-state as queue authority.
effort: high
argument-hint: [issue-id]
allowed-tools: Bash(git rev-parse:*), Bash(git branch --show-current), Bash(git status:*), Bash(git fetch:*), Bash(git merge-base:*), Bash(gh pr view:*), Bash(gh pr checks:*), Bash(superset workspaces list:*), Bash(cat:*), Bash(rmdir:*), Read, Write, Agent, mcp__claude_ai_Linear__get_issue
---

# advance

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

## Voice

Read `../../persona.md` at the start of this skill. The monkey-maestro voice is canonical
for all output here — apply it to the gate and wrapper lines; keep the report block plain.

**Scope:** local to this skill's execution only. Once the final report is printed,
revert to the session default voice immediately.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. Technical identifiers (issue ids, file
paths, CLI flags, tool names, branches) stay in their original form.

## When you're invoked

The movement is played: the feature is implemented, `moon-moth:verify` is green, and
`git-gremlin:pr` opened the PR. The maestro turns to the box seat. This is the **one
human gate per issue** — the patron's nod — after which the relay waits for the PR merge.
It never asks Linear for the next movement while the current PR is unmerged.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_ROOT = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse/relays` (the repo's shared `.git` dir, identical across worktrees — see `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md`).
2. Resolve the current issue from `$ARGUMENTS` first, then the current branch. Fetch that
   issue from Linear and capture its authoritative `linear_project_id`. Do not infer the
   project from another active flag or from a directory name.
3. Set `PROJECT_STATE_DIR = ${STATE_ROOT}/<linear_project_id>`,
   `RELAY_FLAG = ${PROJECT_STATE_DIR}/autopilot.json`, and `LOCK_DIR = ${PROJECT_STATE_DIR}/lock`.
   Read `RELAY_FLAG`. Honor autopilot only when it is active, unexpired, and its embedded
   `linear_project_id` equals the current issue's project. Otherwise present a plain `(s)`
   stop and tell the patron this project has no armed relay (start it with
   `monkey-maestro:run <issue-id>`).
4. Do not read `relay-<relay_id>.json`; local relay-state is obsolete and must never block
   a movement that Linear/GitHub says exists.

## Step 1 — Classify the current PR

Resolve the PR for the current branch with `gh pr view --json
number,title,url,state,mergedAt,mergeCommit,baseRefName,headRefName,headRefOid`. If no PR
exists, stop. Branch by its state before any review, acceptance, queue lookup, or spawn:

- **`OPEN`**: before running checks or review, verify the submitted worktree exactly
  matches the PR:
  1. `git status --porcelain` must be empty.
  2. Run `git fetch origin <headRefName>`, then verify both local `HEAD` and
     `origin/<headRefName>` equal the PR `headRefOid`.
     If any check fails, report `push unverified` and stop. Do not review, accept, look up,
     propose, or spawn another issue from an unpushed or dirty worktree.
     Then run `gh pr checks`. If checks are failing, do NOT offer acceptance — report the gap
     and hand back to the implementation turn. Otherwise show the patron:
  - the current Linear issue id,
  - the PR (number, title, url),
  - the verify evidence (checks green / the `moon-moth:verify` result),
  - a short "how to test" derived from the issue's acceptance criteria when available.
- **`MERGED`**: this is the only state allowed to continue to Step 5. Before continuing:
  1. Verify `RELAY_FLAG.last_issue` equals the current issue and `last_pr` equals this PR
     URL. If not, stop: the PR was never reviewed and accepted through this relay.
  2. Run `git fetch origin <baseRefName>`, then verify the PR `mergeCommit` is an ancestor
     of `origin/<baseRefName>` with `git merge-base --is-ancestor`. If either check fails,
     stop and report `merge unverified`; do not look up or propose a next issue.
  3. Report the accepted PR as merged into its base, then skip Steps 2–4 and continue at
     Step 5.
- **Any other state** (`CLOSED`, `DRAFT`, unknown): stop. A closed-but-unmerged PR never
  permits a spawn.

## Step 2 — Code review the open PR (blocking)

Every movement gets a code review before the patron is asked to accept. Dispatch the
`git-gremlin:reviewer` subagent (see `## Subagent dispatch`) against the PR diff (current
branch vs base `main`, the diff `git-gremlin:pr` just opened). It is read-only: it never
touches git state, the PR, or any file.

Triage the reviewer's severity-ranked findings. **`BLOCKER` and `HIGH` are blocking**;
`MEDIUM`/`LOW`/`NIT`/`INFO` are surfaced but never block.

- **Blocking findings present** → the movement is NOT done. Do **not** present the
  acceptance gate and do **not** spawn the next movement. Hand control back to the
  implementation turn with the blocking findings as concrete fix instructions
  (`file:line` + the reviewer's `Fix`). This skill has no `Edit`/`commit`/`push`; it never
  fixes itself. The implementation turn corrects the code, then re-runs the movement tail:
  `moon-moth:verify` → `git-gremlin:commit` → `git-gremlin:pr` → `monkey-maestro:advance`.
  Stop.
- **No blocking findings** → say so (`No blocking findings`), carry any `MEDIUM`/`LOW`
  residual risk into the presentation, and continue to the acceptance gate.
- **Reviewer unavailable or errors** → the review gate cannot be certified. Surface
  `review unavailable: <reason>` and present the acceptance gate only as an explicit
  patron escalation; an `oui` means "accept without review".

No local review counter is kept. If the same review keeps failing, the evidence is in the
current PR/review output, not in a private relay file.

## Step 3 — The acceptance gate for the open PR

Reached only after Step 2 has either a clean review or an explicit review-unavailable
escalation. With the PR, verify evidence, and review status shown above, present:

```text
<voice intro line — monkey-maestro>
(o) oui   → feature tested & good — record approval and wait for PR merge
(n) non   → not good — hand back to the implementation turn with your notes
(s) stop  → baton down — disarm autopilot and stop the relay
```

Branch on the response:

- **non** → ask for the specific fix and hand control to the implementation turn with the
  patron's notes verbatim. Stop. Do not write queue state.
- **stop** → auto-chain to `monkey-maestro:halt <current issue id>`. Stop.
- **oui** → continue to Step 4.

## Step 4 — Accept + wait for merge

Update only this project's `RELAY_FLAG`, never a local issue queue:

1. Refresh `RELAY_FLAG` `expires_at` (~24h forward).
2. Set `last_issue: <current issue>`, `last_pr: <current PR url>`, and
   `last_halt_reason: null` for audit/baton context.
3. Preserve `linear_project_id` exactly as the current issue's validated Linear project
   id. If the stored value differs, stop with `project_scope_mismatch`; never repair a
   foreign flag in place.
4. Report `accepted, awaiting merge` and stop. Do not dispatch `queue-scout`, propose a
   spawn, or remove this worktree. After the patron merges the PR, invoke
   `monkey-maestro:advance <current issue id>` again; Step 1 verifies the merge before it
   may continue.

## Step 5 — Resolve + cue the next movement after verified merge

This step is reachable **only** from the `MERGED` branch of Step 1, after the exact
accepted PR's merge commit is verified on `origin/<baseRefName>`. Never infer that an open
PR will merge or treat an independent next issue as an exception.

Resolve the current workspace cleanup target before dispatch:

1. Run `git status --porcelain`. If it is non-empty, set cleanup to
   `skipped: dirty_worktree`.
2. Otherwise run `superset workspaces list --local --json` and match the current branch.
   If exactly one local workspace has `type: "worktree"` and `branch` equal to the current
   branch, set `cleanup_workspace_id` to that id. If none, multiple, or `type: "main"`,
   set cleanup to `skipped: not_a_unique_worktree`.
3. This cleanup target is advisory. It is passed to `git-gremlin:spawn`, which verifies
   and opens the next workspace, then asks the patron whether to delete it.

Then dispatch `monkey-maestro:queue-scout` in `MODE: next`, passing the just-accepted
issue, the cached Linear project id, and the audit breadcrumbs from the control flag.
Queue-scout reads Linear fresh, applies the startable rule, checks local branches/worktrees
for duplicate-spawn protection, and returns the next startable issue plus spawn
parameters. It must not choose a spawned agent; `git-gremlin:spawn` asks the user for
`codex` or `claude` every time.

- If queue-scout returns no startable issue → set this `RELAY_FLAG active: false`,
  `last_halt_reason: queue_drained`, remove only this `LOCK_DIR`. Report it; if open PRs
  are blocking dependents, tell the patron to merge them and re-run
  `monkey-maestro:run <issue-id>` to resume. Stop.
- If queue-scout reports `project_scope_mismatch` or returns `next: null` with
  `drained: false`, set this `RELAY_FLAG active: false`, set
  `last_halt_reason: project_scope_mismatch`, remove only this `LOCK_DIR`, report the
  mismatch, and stop. Never spawn from an ambiguous scout result.
- Otherwise → auto-chain to `git-gremlin:spawn` with the queue-scout parameters
  (base-branch `main`, baton prompt beginning with `AUTOPILOT RELAY (monkey-maestro)`,
  plus `cleanup_workspace_id` when one was resolved). `spawn` asks the user to choose
  `codex` or `claude`, then drains its final gate, creates and verifies the worktree, opens
  it, and asks before deleting the previous workspace. This agent stops after that choice.

On any scout/spawn failure: set this `RELAY_FLAG active: false`,
`last_halt_reason: <reason>`, remove only this `LOCK_DIR`, report, and stop.

## Final Report

```text
monkey-maestro:advance report
  Accepted PR:  <identifier> - <title> (PR <url>)
  Project:      <linear project id>
  State:        awaiting merge | merged and verified
  Review:       clean | overridden by patron | unavailable: <reason> | previously accepted
  Next issue:   <identifier> - <title> | not proposed (awaiting merge) | _none_ (<queue_drained>)
  Worktree:     spawning <branch> via git-gremlin:spawn | not spawned (<reason>)
  Cleanup:      previous workspace <id> offered for confirmation | skipped (<reason>)
  Authority:    Linear queue + GitHub PRs; no local relay-state queue
  Reminder:     merge the open PRs at your own tempo — the relay never merges
```

## Subagent dispatch

This skill dispatches two subagents: `git-gremlin:reviewer` (Step 2) and
`monkey-maestro:queue-scout` (Step 5).

**Step 2 — code review the PR** (`git-gremlin:reviewer`, read-only):

```
Agent({
  subagent_type: 'git-gremlin:reviewer',
  description: 'code review the relay movement PR diff vs main',
  prompt: `Review the PR diff for the current relay movement: branch <BRANCH> vs base
\`main\` — the diff git-gremlin:pr just opened. Run your context compiler with
\`--base main\`, load the applied repo rules, run the portable review passes, and return
your severity-ranked Final Report (findings first, then the manifest summary). Read-only:
never touch git state, the PR, or any file.`,
})
```

**Step 5 — resolve the next startable issue after merge** (`monkey-maestro:queue-scout`):

```
Agent({
  subagent_type: 'monkey-maestro:queue-scout',
  description: 'resolve the next startable Linear issue + spawn params',
  prompt: `MODE: next
RELAY_ID: <relay_id>
LINEAR_PROJECT_ID: <validated current issue project id>
PREFERRED_ISSUE: _none_
ACCEPTED_ISSUE: <identifier just accepted>
LAST_ISSUE: <current issue>
LAST_PR: <current PR url>
Apply the startable rule from pipeline-contract. The accepted-but-unmerged issue does NOT
unblock dependents unless Linear/GitHub already marks it complete. Return the next issue
and spawn parameters per the pipeline-contract baton prompt, or _none_ if drained.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge the PR or mark the Linear issue Done — the patron merges; `Closes <id>` closes it.
- Auto-answer the acceptance gate — it is always the patron's, even with autopilot on.
- Skip the PR code review.
- Present the acceptance gate while blocking (`BLOCKER`/`HIGH`) findings stand.
- Fix code, commit, or push from this skill — hand findings to the implementation turn.
- Accept a feature whose checks are failing or whose PR is missing.
- Create, read, or trust `relay-<relay_id>.json` as queue state.
- Dispatch `queue-scout` or propose/spawn a next worktree unless the current accepted PR is
  `MERGED` and its merge commit is verified on the base branch.
- Spawn the next worktree if the scout failed.
- Update, disarm, or remove a flag/lock belonging to another Linear project.
- Leave this project's flag `active: true` or its lock present after queue drained, spawn
  failure, or halt.
