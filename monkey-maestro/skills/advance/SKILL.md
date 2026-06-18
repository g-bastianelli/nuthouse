---
name: advance
description: Use when a feature is implemented, verified, and its PR is open and the autopilot relay must move on — auto-invoked by git-gremlin:pr in autopilot, or "issue suivante", "continue le relais", "next movement". Runs a blocking code review of the PR, holds the human acceptance gate, updates only the repo-scoped autopilot control flag, then asks Linear for the next startable issue and spawns it. Does not merge. Does not use local relay-state as queue authority.
effort: high
argument-hint: [issue-id]
allowed-tools: Bash(git rev-parse:*), Bash(git branch --show-current), Bash(gh pr view:*), Bash(gh pr checks:*), Read, Write, Agent
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

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw,
> unexpanded dynamic-context commands, run them manually before Step 0.

- Current branch: !`git branch --show-current 2>/dev/null`
- Relay flag: !`cat "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/nuthouse/autopilot.json" 2>/dev/null || echo "none"`

## When you're invoked

The movement is played: the feature is implemented, `moon-moth:verify` is green, and
`git-gremlin:pr` opened the PR. The maestro turns to the box seat. This is the **one
human gate per issue** — the patron's nod — after which the baton asks Linear for the
next movement.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse` (the repo's shared `.git` dir, identical across worktrees — see `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md`).
2. Read `${STATE_DIR}/autopilot.json`. Honor autopilot only if `active: true` and
   `expires_at` is in the future. If the flag is off/invalid, present a plain `(s) stop`
   and tell the patron the relay is not armed (start it with `monkey-maestro:run`).
3. Resolve the current issue from `$ARGUMENTS` first, then the current branch. Do not read
   `relay-<relay_id>.json`; local relay-state is obsolete and must never block a movement
   that Linear/GitHub says exists.

## Step 1 — Present the finished movement

Resolve the PR for the current branch: `gh pr view --json number,title,url,state` and
`gh pr checks`. Show the patron, plainly:

- the current Linear issue id,
- the PR (number, title, url),
- the verify evidence (checks green / the `moon-moth:verify` result),
- a short "how to test" derived from the issue's acceptance criteria when available.

If no PR exists, or checks are failing, do NOT offer acceptance — report the gap and hand
back to the implementation turn. The movement is not done.

## Step 2 — Code review the PR (always; blocking)

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

## Step 3 — The acceptance gate (the human gate)

Reached only after Step 2 has either a clean review or an explicit review-unavailable
escalation. With the PR, verify evidence, and review status shown above, present:

```text
<voice intro line — monkey-maestro>
(o) oui   → feature tested & good — accept it and cue the next movement
(n) non   → not good — hand back to the implementation turn with your notes
(s) stop  → baton down — disarm autopilot and stop the relay
```

Branch on the response:

- **non** → ask for the specific fix and hand control to the implementation turn with the
  patron's notes verbatim. Stop. Do not write queue state.
- **stop** → auto-chain to `monkey-maestro:halt`. Stop.
- **oui** → continue to Step 4.

## Step 4 — Accept + budget check

Update only the control flag, never a local issue queue:

1. Refresh `autopilot.json` `expires_at` (~24h forward).
2. Set `last_issue: <current issue>`, `last_pr: <current PR url>`, and
   `last_halt_reason: null` for audit/baton context.
3. If the current issue's Linear project id is known, set `linear_project_id` as a cached
   hint only. Queue-scout must still verify the project from Linear.
4. Increment `accepted_count` by 1 for budget enforcement only. This counter never decides
   issue status or queue membership.
5. If `accepted_count >= max_issues` → set `active: false`, `last_halt_reason:
budget_reached`, report the budget reached, and stop without spawning.

## Step 5 — Resolve + cue the next movement (dispatch queue-scout)

Dispatch `monkey-maestro:queue-scout` in `MODE: next`, passing the just-accepted issue,
the cached Linear project id, and the audit breadcrumbs from the control flag. Queue-scout
reads Linear fresh, applies the startable rule, checks local branches/worktrees for
duplicate-spawn protection, and returns the next startable issue plus spawn parameters.

- If queue-scout returns no startable issue → set `autopilot.json active: false`,
  `last_halt_reason: queue_drained`. Report it; if open PRs are blocking dependents, tell
  the patron to merge them and re-run `monkey-maestro:run` to resume. Stop.
- Otherwise → auto-chain to `git-gremlin:spawn` with the queue-scout parameters
  (base-branch `main`, baton prompt beginning with `AUTOPILOT RELAY (monkey-maestro)`).
  `spawn` drains its gate, creates the worktree, opens it, and this agent STOPS.

On any scout/spawn failure: set `autopilot.json active: false`,
`last_halt_reason: <reason>`, report, and stop.

## Final Report

```text
monkey-maestro:advance report
  Accepted:     <identifier> - <title> (PR <url>)
  Review:       clean | overridden by patron | unavailable: <reason>
  Budget:       <accepted_count>/<max_issues>
  Next issue:   <identifier> - <title> | _none_ (<queue_drained|budget_reached>)
  Worktree:     spawning <branch> via git-gremlin:spawn | not spawned (<reason>)
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

**Step 5 — resolve the next startable issue** (`monkey-maestro:queue-scout`):

```
Agent({
  subagent_type: 'monkey-maestro:queue-scout',
  description: 'resolve the next startable Linear issue + spawn params',
  prompt: `MODE: next
RELAY_ID: <relay_id>
LINEAR_PROJECT_ID: <cached project id from flag | _none_>
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
- Spawn the next worktree if the scout failed.
- Leave the flag `active: true` after queue drained, budget reached, or halt.
