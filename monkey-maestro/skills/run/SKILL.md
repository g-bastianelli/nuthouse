---
name: run
description: Use when the user wants to start the autopilot relay over a Linear project — "lance l'autopilote", "enchaîne mes issues", "run the relay", "autopilote on", "conduct my backlog". Resolves the project from a starting issue, atomically arms that project's control flag, and spawns its first worktree. Several Linear projects can run concurrently in one Git repo; one project cannot have two relays. Linear remains the source of truth; no local relay queue is maintained. Do not use to stop the relay (monkey-maestro:halt) or to advance after acceptance (monkey-maestro:advance).
effort: high
argument-hint: "<issue-id> [--max <n>]"
allowed-tools: Bash(git rev-parse:*), Bash(gh auth status), Bash(superset projects list:*), Bash(mkdir:*), Bash(rmdir:*), Bash(stat:*), Bash(cat:*), Read, Write, Agent
---

# run

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

## Voice

Read `../../persona.md` at the start of this skill. The monkey-maestro voice is canonical
for all output here — apply it to the wrapper lines around the report; keep the report
block itself plain.

**Scope:** local to this skill's execution only. Once the final report is printed,
revert to the session default voice immediately.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. Technical identifiers (issue ids, file
paths, CLI flags, tool names, branches) stay in their original form.

## When you're invoked

The patron wants one Linear project conducted as a relay. This skill first resolves that
project from the required starting issue, atomically locks that project only, then cues
the first worktree. It does **not** implement, merge, or maintain a local issue queue.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_ROOT = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse/relays` (the repo's shared `.git` dir, visible from every worktree — see `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md`).
2. `gh auth status` and `superset projects list --json` must succeed (the relay opens PRs and spawns worktrees downstream). On failure, abort with the auth instruction — never run a login on the patron's behalf. Linear access is verified later by `queue-scout`.
3. Parse `$ARGUMENTS`: a required starting `issue-id` and optional `--max <n>` (default 5). If no issue id is present, abort before writing any state: the project cannot be inferred safely. If `<n> < 1`, abort — a relay with a zero/negative budget conducts nothing.
4. Read the legacy `<git-common-dir>/nuthouse/autopilot.json` only for migration. If it is active and unexpired, stop and report that an older global relay is still armed; it must finish or be halted before project-scoped relays are started.

## Step 1 — Resolve the target project + first movement

1. Mint a `relay_id` (uuid v4). Do not write state yet.
2. Dispatch the `monkey-maestro:queue-scout` subagent (see `## Subagent dispatch`). It owns
   the Linear read path: it reads the project queue, applies the startable rule, checks local
   branches/worktrees for duplicate-spawn protection, and returns the next startable issue
   plus `git-gremlin:spawn` parameters. It must not choose a spawned agent; `git-gremlin:spawn`
   asks the user for `codex` or `claude` every time. Pass the required issue as
   `PREFERRED_ISSUE`; queue-scout returns the authoritative `linear_project_id` even when
   the issue is not startable.

- If queue-scout reports Linear unreachable, a missing project, or no startable issue,
  report the reason and stop. No flag or lock exists yet, so do not write an inactive one.

## Step 2 — Atomically arm this project only

1. From queue-scout, set `PROJECT_STATE_DIR = ${STATE_ROOT}/<linear_project_id>`,
   `RELAY_FLAG = ${PROJECT_STATE_DIR}/autopilot.json`, and `LOCK_DIR = ${PROJECT_STATE_DIR}/lock`.
   The returned project id must be safe as one path segment; reject it if not.
2. Create `PROJECT_STATE_DIR`, then acquire the lock with `mkdir ${LOCK_DIR}`. This is the
   single-project lock and must be the first mutation. Do not use a read-then-write check.
3. Immediately after a successful `mkdir`, read any existing `RELAY_FLAG`. If it is active
   and unexpired with the same `linear_project_id`, remove the lock directory just acquired,
   report its `relay_id`, and stop. If its embedded project id differs, remove the lock and
   stop with `project_scope_mismatch`. A missing lock must never permit overwriting a live
   or foreign flag.
4. If the `mkdir` fails, read `RELAY_FLAG`:
   - If it is active and unexpired with the same `linear_project_id`, report its `relay_id`
     and stop: that Linear project already has a relay.
   - If the lock is fresh but the flag is absent/invalid, report `initialization in progress`
     and stop. Do not remove a fresh lock.
   - Only when the lock mtime is older than 30 minutes and the flag is absent, inactive, or
     expired may you `rmdir ${LOCK_DIR}` and retry `mkdir` once. On any retry failure, stop.
5. After the live-flag check, write `RELAY_FLAG` per the pipeline contract:
   `relay_id`, `active: true`, `repo: <git common dir>`,
   `linear_project_id: <queue-scout project id>`, `plan_gate: auto-clean`,
   `max_issues: <n>`, `accepted_count: 0`, `last_issue: null`, `last_pr: null`,
   `last_halt_reason: null`, and `expires_at` (~24h). Do **not** create or read
   `relay-<relay_id>.json`.

## Step 3 — Cue the first worktree

Auto-chain to `git-gremlin:spawn` with the queue-scout parameters (project, name, branch,
base-branch `main`, and a baton prompt beginning with the exact marker
`AUTOPILOT RELAY (monkey-maestro)`). Print the invocation and continue. `spawn` must ask
the user to choose `codex` or `claude`; after that, it drains its own final mutation gate
because autopilot is on and the prompt carries the relay marker. `spawn` creates the
worktree, opens it, and the current agent STOPS there. The fresh agent in the new
worktree picks up the movement via `linear-devotee:greet`.

The baton prompt must contain the exact `LINEAR_PROJECT_ID`, `RELAY_ID`, and `RELAY_FLAG`
from Step 2. On any spawn failure, set this `RELAY_FLAG` to `active: false`, set
`last_halt_reason: <reason>`, remove only this `LOCK_DIR`, report, and stop.

## Final Report

```text
monkey-maestro:run report
  Relay:        <relay_id> (armed | done | halted)
  Project:      <Linear project id>
  Autopilot:    <RELAY_FLAG> (plan_gate: <auto-clean|manual|auto>, max_issues: <n>)
  First issue:  <identifier> - <title> | _none_ (<reason>)
  Worktree:     spawning <branch> via git-gremlin:spawn | not spawned (<reason>)
  Authority:    Linear queue + GitHub PRs; no local relay-state queue
  Next gate:    monkey-maestro:advance (acceptance) in the new worktree
```

## Subagent dispatch (Step 2)

```
Agent({
  subagent_type: 'monkey-maestro:queue-scout',
  description: 'resolve the next startable Linear issue + spawn params',
  prompt: `MODE: first
RELAY_ID: <relay_id>
LINEAR_PROJECT_ID: _none_
PREFERRED_ISSUE: <required issue-id from $ARGUMENTS>
ACCEPTED_ISSUE: _none_
LAST_ISSUE: _none_
LAST_PR: _none_
Apply the startable rule from pipeline-contract. If PREFERRED_ISSUE is startable, pick it
first. Report Linear-unreachable if you cannot read the queue. Return the next issue and
the spawn parameters per the pipeline-contract baton prompt.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge anything — the patron merges PRs out-of-band.
- Start a second relay for the same Linear project while its lock is active.
- Treat a flag from another Linear project in this repo as a lock on this one.
- Create, read, or trust `relay-<relay_id>.json` as queue state.
- Spawn a worktree if any precondition or the scout failed.
- Leave this project's flag `active: true` or its lock present after spawn failure or halt.
- Invent a Linear issue, a project id, or spawn parameters — they come from queue-scout.
- Mutate Linear status (the relay never marks Done; `Closes <id>` + the patron's merge do).
