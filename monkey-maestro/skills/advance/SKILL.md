---
name: advance
description: Use when a feature is implemented, verified, and its PR is open and the autopilot relay must move on — auto-invoked by git-gremlin:pr in autopilot, or "issue suivante", "continue le relais", "next movement". Always runs a blocking git-gremlin:review code review of the PR — on blocking findings it hands back to fix and re-test, looping until the review is clean — then holds the per-feature acceptance gate ("tested, it's good?"); on approval resolves and spawns the next startable issue's worktree, then stops. Does not merge (the patron merges PRs). Do not use to start the relay (monkey-maestro:run) or to stop it (monkey-maestro:halt).
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
human gate per issue** — the patron's nod — after which the baton cues the next movement.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse` (the repo's shared `.git` dir, identical across worktrees — see `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md`).
2. Read `${STATE_DIR}/autopilot.json`. Honor autopilot ONLY if `active: true` and
   `expires_at` is in the future. If the flag is off/invalid, present a plain `(s) stop`
   and tell the patron the relay is not armed (start it with `monkey-maestro:run`).
3. Read the active `${STATE_DIR}/relay-<relay_id>.json` (relay_id comes from the flag).
   Resolve the current issue from the branch name (or `$ARGUMENTS`); find its entry. If
   `stage` is already `accepted`, stop (idempotency — this movement was already accepted;
   do not double-spawn). If **no entry** for the current issue exists in this relay-state
   (e.g. the relay was re-armed with a fresh `relay_id` while this worktree stayed open
   from a previous relay), do NOT proceed — report the mismatch and stop; never create or
   mutate an entry under the wrong relay.

## Step 1 — Present the finished movement

Resolve the PR for the current branch: `gh pr view --json number,title,url,state` and
`gh pr checks`. Show the patron, plainly:

- the PR (number, title, url),
- the verify evidence (checks green / the `moon-moth:verify` result),
- a short "how to test" derived from the issue's acceptance criteria.

If no PR exists, or checks are failing, do NOT offer acceptance — report the gap and
hand back to the implementation turn (a wrong note; the movement is not done).

## Step 2 — Code review the PR (always; blocking)

Every movement gets a code review before the patron is asked to accept — green checks
prove it runs, the review proves it reads right. The review is a **hard gate**: the
acceptance gate is never reached while blocking findings stand. Dispatch the
`git-gremlin:reviewer` subagent (see `## Subagent dispatch`) against the PR diff (current
branch vs base `main`, the diff `git-gremlin:pr` just opened). It is read-only: it never
touches git state, the PR, or any file.

Triage the reviewer's severity-ranked findings. **`BLOCKER` and `HIGH` are blocking**;
`MEDIUM`/`LOW`/`NIT`/`INFO` are surfaced but never block (per git-gremlin's scale, `NIT`
never blocks and `INFO` is not a requested change).

- **Blocking findings present** → the movement is NOT done. Do **not** present the
  acceptance gate and do **not** spawn the next movement. Read the issue entry's
  `review_rounds` (absent = `0`):
  - `review_rounds < 3` → increment it, set the issue `stage: spawning` (still in-flight,
    not accepted), write relay-state, then hand control back to the implementation turn
    with the blocking findings as **concrete fix instructions** (`file:line` + the
    reviewer's `Fix`). This skill has no `Edit`/`commit`/`push` — it never fixes itself;
    the implementation turn corrects the code, then re-runs the movement tail —
    `moon-moth:verify` (test) → `git-gremlin:commit` → `git-gremlin:pr` (updates the PR)
    → `monkey-maestro:advance` — which re-reviews. The loop repeats until the review is
    clean. Print the hand-off (findings + "handing back to fix, round N/3") and **stop**.
  - `review_rounds >= 3` → the findings won't converge unattended. Do not loop again:
    surface the persistent findings and escalate to the patron with a decision — `(c)
continue fixing` (one more hand-back round) / `(o) accept anyway` (override → Step 4)
    / `(s) stop` (→ `monkey-maestro:halt`). The relay never silently accepts past a
    persistent blocker.
- **No blocking findings** → say so (`No blocking findings`), carry any `MEDIUM`/`LOW`
  residual risk into the presentation, and continue to the acceptance gate (Step 3).
- **Reviewer unavailable or errors** → the review gate cannot be certified. Do not
  silently accept: surface `review unavailable: <reason>` and present the acceptance gate
  as an explicit patron escalation — the voice intro must state the review did not run, so
  an `oui` is a conscious "accept without review". A review-tool failure must not wedge the
  relay in a loop.

## Step 3 — The acceptance gate (the human gate)

Reached only on a clean review (Step 2). With the PR, verify evidence, and the clean
review (plus any `MEDIUM`/`LOW` residual) shown above, present, in voice intro + plain
options:

```
<voice intro line — monkey-maestro>
(o) oui   → feature tested & good — accept it and cue the next movement
(n) non   → not good — hand back to the implementation turn with your notes
(s) stop  → baton down — disarm autopilot and stop the relay
```

Branch on the response:

- **non** → ask for the specific fix, set the issue entry back to `stage: spawning`
  (still in-flight, not accepted), and hand control to the implementation turn with the
  patron's notes verbatim. Stop.
- **stop** → auto-chain to `monkey-maestro:halt` (disarm flag, `phase: stopped`). Stop.
- **oui** → continue to Step 4.

## Step 4 — Accept + budget check

1. Update the current issue entry **in place**: `stage: accepted`, record the `pr`.
   Increment `completed_count`. Write relay-state before anything else. Also refresh
   `autopilot.json` `expires_at` (~24h forward) so an actively-advancing relay never
   self-expires between movements.
2. If `completed_count >= max_issues` → set `phase: done`, reason `budget_reached`, set
   `autopilot.json active: false` (disarm), report "the coda — budget reached", and stop
   (do not spawn).

## Step 5 — Resolve + cue the next movement (dispatch queue-scout)

Dispatch `monkey-maestro:queue-scout` (see `## Subagent dispatch`) in `MODE: next`, passing
the just-accepted issue. It applies the relay "startable" rule — **blockers must be
actually merged/Done** (so a dependent of the just-accepted-but-unmerged issue is NOT yet
startable) and the candidate **must not already be In Progress on Linear** (no second
worktree over work already underway).

- If queue-scout returns no startable issue → set `phase: done`, reason `queue_drained`,
  set `autopilot.json active: false` (disarm so a later re-run is not blocked). Report it;
  if open PRs are blocking dependents, tell the patron to merge them and re-run
  `monkey-maestro:run` to resume the chain. Stop.
- Otherwise → append the next issue to `issues[]` with a fresh `client_ref` and
  `stage: spawning` (write **before** spawn), then auto-chain to `git-gremlin:spawn` with
  the queue-scout parameters (base-branch `main`, the relay baton prompt beginning with
  `AUTOPILOT RELAY (monkey-maestro)`). `spawn` drains its gate (marker + flag), creates the
  worktree, opens it, and this agent STOPS.

On any scout/spawn failure: set `phase: halted` + `reason`, set `autopilot.json active: false`
(disarm — a halted relay must not wedge the single-relay lock), report, stop (stop-ladder).

## Final Report

```text
monkey-maestro:advance report
  Accepted:     <identifier> - <title> (PR <url>)
  Review:       clean after <review_rounds> fix round(s) | overridden by patron (<n> blocking) | unavailable: <reason> (git-gremlin:reviewer)
  Completed:    <completed_count>/<max_issues>
  Next issue:   <identifier> - <title> | _none_ (<queue_drained|budget_reached>)
  Worktree:     spawning <branch> via git-gremlin:spawn | not spawned (<reason>)
  Relay state:  <STATE_DIR>/relay-<relay_id>.json
  Reminder:     merge the open PRs at your own tempo — the relay never merges
```

## Subagent dispatch

This skill dispatches two subagents: `git-gremlin:reviewer` (Step 2) and
`monkey-maestro:queue-scout` (Step 5).

**Step 2 — code review the PR** (`git-gremlin:reviewer`, read-only, returns severity-ranked findings):

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
STATE_DIR: <abs git-common-dir>/nuthouse
ACCEPTED_ISSUE: <identifier just accepted>
RELAY_ID: <relay_id>
Apply the relay startable rule (blockers actually merged/Done; the accepted-but-unmerged
issue does NOT unblock its dependents; skip any issue already In Progress on Linear).
Return the next issue and spawn parameters per the pipeline-contract baton prompt, or
_none_ if the queue is drained.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge the PR or mark the Linear issue Done — the patron merges; `Closes <id>` closes it.
- Auto-answer the acceptance gate — it is always the patron's, even with autopilot on.
  (The gate is only _reached_ on a clean review; its answer is still never the maestro's.)
- Skip the PR code review — it runs every movement; it is a blocking gate.
- Present the acceptance gate while blocking (`BLOCKER`/`HIGH`) findings stand — hand back
  to fix and re-test first; loop until clean, escalate to the patron after 3 rounds.
- Loop the review-fix cycle unattended forever — bound it at 3 rounds, then escalate.
- Fix code, commit, or push from this skill — it has no `Edit`/`commit`/`push`; it hands
  the findings to the implementation turn and re-enters after the re-verify.
- Accept a feature whose checks are failing or whose PR is missing — hand back instead.
- Double-spawn an issue already `accepted` in relay-state.
- Spawn the next worktree if the scout failed — halt instead.
- Leave the flag `active: true` after `phase: done` — disarm on `done`.
