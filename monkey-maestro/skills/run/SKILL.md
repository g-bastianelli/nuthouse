---
name: run
description: Use when the user wants to start the autopilot relay over their Linear backlog — "lance l'autopilote", "enchaîne mes issues", "run the relay", "autopilote on", "conduct my backlog". Arms the repo-scoped autopilot flag, initializes the resumable relay-state, resolves the first startable issue, spawns its worktree primed to continue the relay, then stops. One worktree per issue; the human gate is the per-feature acceptance in monkey-maestro:advance. Do not use to stop the relay (monkey-maestro:halt) or to advance after acceptance (monkey-maestro:advance).
effort: high
argument-hint: [issue-id] [--max <n>]
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

The patron wants the whole backlog conducted as one symphony. This skill raises the
baton: it arms autopilot, writes the relay-state, finds the first movement, and cues
the first worktree. It does **not** implement and it does **not** merge.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse` (the repo's shared `.git` dir, visible from every worktree — see `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md`). Ensure it exists (`mkdir -p` semantics via the Write tool when you first write a file there).
2. `gh auth status` and `superset projects list --json` must succeed (the relay opens PRs and spawns worktrees downstream). On failure, abort with the auth instruction — never run a login on the patron's behalf. (Linear access is verified later by `queue-scout`, which owns the Linear tools — do not gate on it here.)
3. **Single-relay lock.** Read `${STATE_DIR}/autopilot.json`. If it exists with `active: true` and a non-expired `expires_at`, do NOT start a second relay — report the live `relay_id` and its `relay-<id>.json`, and offer to resume or `monkey-maestro:halt` first. Stop here.

## Step 1 — Arm autopilot + initialize relay-state

1. Parse `$ARGUMENTS`: an optional starting `issue-id`, and `--max <n>` (default 5). If
   `<n> < 1`, abort — a relay with a zero/negative budget conducts nothing; do not arm or
   spawn. (The budget is otherwise enforced only in `advance` after acceptance.)
2. Mint a `relay_id` (uuid v4). Write `${STATE_DIR}/autopilot.json` per the
   `${CLAUDE_PLUGIN_ROOT}/shared/pipeline-contract.md` flag schema, with these keys:
   `relay_id`, `active: true`, `repo: <STATE_DIR without the trailing /nuthouse>`,
   `linear_project_id` (fill once queue-scout resolves it), `plan_gate: auto-clean`
   (override from args if given), `max_issues: <n>`, `expires_at` set generously (~24h
   out — the relay is human-paced between movements and `advance` refreshes it each movement).
3. Write `${STATE_DIR}/relay-<relay_id>.json` with `phase: running`, `max_issues: <n>`,
   `completed_count: 0`, `issues: []` (per the relay-state schema).

## Step 2 — Resolve the first movement (dispatch queue-scout)

Dispatch the `monkey-maestro:queue-scout` subagent (see `## Subagent dispatch`). It owns
the Linear tools: it reads the project queue, applies the relay "startable" rule (blockers
actually merged/Done; never an issue already In Progress on Linear), and returns the next
startable issue plus the spawn parameters (branch, base, baton `--prompt`). If `$ARGUMENTS`
named an `issue-id`, pass it as the preferred start.

- If queue-scout reports Linear unreachable → set `phase: halted`, reason `auth_expired`,
  set `autopilot.json active: false`, report, and stop.
- If queue-scout returns no startable issue → set `phase: done`, reason `queue_drained`,
  set `autopilot.json active: false` (disarm so a later re-run is not blocked), report
  "nothing to conduct", and stop.

## Step 3 — Record + cue the first worktree

1. Append the chosen issue to relay-state `issues[]` with a fresh `client_ref` and
   `stage: spawning` — write the file **before** spawning (idempotency / resumability).
2. Auto-chain to `git-gremlin:spawn` with the queue-scout parameters (project, name,
   branch, base-branch `main`, agent, and the relay baton prompt — which begins with the
   exact marker `AUTOPILOT RELAY (monkey-maestro)`). Print the invocation and continue —
   `spawn` drains its own mutation gate because autopilot is on and the prompt carries the
   relay marker. `spawn` creates the worktree, opens it, and the current agent STOPS
   there. The fresh agent in the new worktree picks up the movement via `greet`.

On any precondition or scout failure, do not spawn: set `phase: halted` + `reason`, set
`autopilot.json active: false` (disarm — a halted relay must not wedge the single-relay
lock), report, and stop (stop-ladder).

## Final Report

```text
monkey-maestro:run report
  Relay:        <relay_id> (phase: running | done | halted)
  Autopilot:    armed (repo: <STATE_DIR>, plan_gate: <auto-clean|manual|auto>, max_issues: <n>)
  First issue:  <identifier> - <title> | _none_ (<reason>)
  Worktree:     spawning <branch> via git-gremlin:spawn | not spawned (<reason>)
  Relay state:  <STATE_DIR>/relay-<relay_id>.json
  Next gate:    monkey-maestro:advance (acceptance) in the new worktree
```

## Subagent dispatch (Step 2)

This skill dispatches the `monkey-maestro:queue-scout` subagent. Run `/scaffold-agent` to
scaffold it under `monkey-maestro/agents/`.

```
Agent({
  subagent_type: 'monkey-maestro:queue-scout',
  description: 'resolve the next startable Linear issue + spawn params',
  prompt: `MODE: first
STATE_DIR: <abs git-common-dir>/nuthouse
PREFERRED_ISSUE: <issue-id from $ARGUMENTS | _none_>
RELAY_ID: <relay_id>
Apply the relay startable rule (blockers actually merged/Done; skip any issue already In
Progress on Linear). Report Linear-unreachable if you cannot read the queue. Return the
next issue and the spawn parameters per the pipeline-contract baton prompt.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge anything — the patron merges PRs out-of-band.
- Start a second relay while one is active (honor the single-relay lock).
- Spawn a worktree if any precondition or the scout failed — halt instead.
- Leave the flag `active: true` after `phase: done` — disarm on `done`.
- Invent a Linear issue, a project id, or spawn parameters — they come from queue-scout.
- Mutate Linear status (the relay never marks Done; `Closes <id>` + the patron's merge do).
