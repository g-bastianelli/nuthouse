---
name: run
description: Use when the user wants to start the autopilot relay over their Linear backlog — "lance l'autopilote", "enchaîne mes issues", "run the relay", "autopilote on", "conduct my backlog". Arms the repo-scoped autopilot control flag, resolves the first startable Linear issue, spawns its worktree primed to continue the relay, then stops. Linear remains the source of truth; no local relay queue is maintained. Do not use to stop the relay (monkey-maestro:halt) or to advance after acceptance (monkey-maestro:advance).
effort: high
argument-hint: "[issue-id] [--max <n>]"
allowed-tools: Bash(git rev-parse:*), Bash(gh auth status), Bash(superset projects list:*), Read, Write, Agent
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

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw,
> unexpanded dynamic-context commands, run them manually before Step 0.

- State dir: !`echo "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/nuthouse"`
- Existing relay flag: !`cat "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/nuthouse/autopilot.json" 2>/dev/null || echo "none"`

## When you're invoked

The patron wants the backlog conducted as one relay. This skill raises the baton: it arms
autopilot, asks Linear for the first startable movement, and cues the first worktree. It
does **not** implement, merge, or maintain a local issue queue.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse` (the repo's shared `.git` dir, visible from every worktree — see `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md`). Ensure it exists (`mkdir -p` semantics via the Write tool when you first write a file there).
2. `gh auth status` and `superset projects list --json` must succeed (the relay opens PRs and spawns worktrees downstream). On failure, abort with the auth instruction — never run a login on the patron's behalf. Linear access is verified later by `queue-scout`.
3. **Single-relay lock.** Read `${STATE_DIR}/autopilot.json`. If it exists with `active: true` and a non-expired `expires_at`, do NOT start a second relay. Report the live `relay_id`, the control flag path, and offer `monkey-maestro:halt` first. Stop here.

## Step 1 — Arm the autopilot control flag

1. Parse `$ARGUMENTS`: an optional starting `issue-id`, and `--max <n>` (default 5). If
   `<n> < 1`, abort — a relay with a zero/negative budget conducts nothing; do not arm or
   spawn.
2. Mint a `relay_id` (uuid v4). Write `${STATE_DIR}/autopilot.json` per the
   `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md` control-flag schema:
   `relay_id`, `active: true`, `repo: <STATE_DIR without trailing /nuthouse>`,
   `linear_project_id: null`, `plan_gate: auto-clean` (override from args if supported),
   `max_issues: <n>`, `accepted_count: 0`, `last_issue: null`, `last_pr: null`,
   `last_halt_reason: null`, and `expires_at` set generously (~24h).
3. Do **not** create or read `relay-<relay_id>.json`. Linear and GitHub are the sources of
   truth; the local flag is only a control plane.

## Step 2 — Resolve the first movement (dispatch queue-scout)

Dispatch the `monkey-maestro:queue-scout` subagent (see `## Subagent dispatch`). It owns
the Linear read path: it reads the project queue, applies the startable rule, checks local
branches/worktrees for duplicate-spawn protection, and returns the next startable issue
plus `git-gremlin:spawn` parameters. It must not choose a spawned agent; `git-gremlin:spawn`
asks the user for `codex` or `claude` every time. If `$ARGUMENTS` named an `issue-id`,
pass it as the preferred start; `queue-scout` should pick it first if it is startable.

- If queue-scout reports Linear unreachable → set `autopilot.json active: false`,
  `last_halt_reason: auth_expired`, report, and stop.
- If queue-scout returns no startable issue → set `autopilot.json active: false`,
  `last_halt_reason: queue_drained`, report "nothing to conduct", and stop.
- If queue-scout returns a `linear_project_id`, patch it into the control flag as a cached
  hint only. It is not authority; `queue-scout` verifies the project from Linear on every
  run.

## Step 3 — Cue the first worktree

Auto-chain to `git-gremlin:spawn` with the queue-scout parameters (project, name, branch,
base-branch `main`, and the relay baton prompt beginning with the exact marker
`AUTOPILOT RELAY (monkey-maestro)`). Print the invocation and continue. `spawn` must ask
the user to choose `codex` or `claude`; after that, it drains its own final mutation gate
because autopilot is on and the prompt carries the relay marker. `spawn` creates the
worktree, opens it, and the current agent STOPS there. The fresh agent in the new
worktree picks up the movement via `linear-devotee:greet`.

On any scout/spawn failure, do not spawn: set `autopilot.json active: false`,
`last_halt_reason: <reason>`, report, and stop.

## Final Report

```text
monkey-maestro:run report
  Relay:        <relay_id> (armed | done | halted)
  Autopilot:    <STATE_DIR>/autopilot.json (plan_gate: <auto-clean|manual|auto>, max_issues: <n>)
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
LINEAR_PROJECT_ID: <cached project id from flag | _none_>
PREFERRED_ISSUE: <issue-id from $ARGUMENTS | _none_>
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
- Start a second relay while one is active (honor the single-relay lock).
- Create, read, or trust `relay-<relay_id>.json` as queue state.
- Spawn a worktree if any precondition or the scout failed.
- Leave the flag `active: true` after queue drained or halted.
- Invent a Linear issue, a project id, or spawn parameters — they come from queue-scout.
- Mutate Linear status (the relay never marks Done; `Closes <id>` + the patron's merge do).
