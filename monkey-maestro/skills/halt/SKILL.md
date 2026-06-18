---
name: halt
description: Use when the user wants to stop the autopilot relay — "arrête l'autopilote", "baton down", "stop the relay", "autopilote off", "coupe le relais". Disarms the repo-scoped autopilot flag and marks the relay-state stopped so no further worktrees are spawned. The already-open PRs and worktrees stay — the patron merges and cleans those up. Do not use to start the relay (monkey-maestro:run) or to accept a feature and advance (monkey-maestro:advance).
model: haiku
effort: low
allowed-tools: Bash(git rev-parse:*), Read, Write
---

# halt

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

## Voice

Read `../../persona.md` at the start of this skill. The monkey-maestro voice is canonical
for all output here — apply it to the wrapper lines; keep the report block plain.

**Scope:** local to this skill's execution only. Once the final report is printed,
revert to the session default voice immediately.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. Technical identifiers (file paths, CLI
flags, relay ids) stay in their original form.

## Context

> Auto-injected on Claude Code at skill load. If the line below still shows raw,
> unexpanded dynamic-context commands, run it manually before Step 0.

- Relay flag: !`cat "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/nuthouse/autopilot.json" 2>/dev/null || echo "none"`

## When you're invoked

The patron calls the symphony to a close mid-performance. The maestro lowers the baton:
disarm the flag so no further movement begins. Nothing already in flight is destroyed —
open PRs and worktrees remain for the patron to merge and clean up.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse` (the repo's shared `.git` dir — the SAME path from the main repo and every worktree, so this works even when auto-chained from `advance` inside a spawned worktree).
2. Read `${STATE_DIR}/autopilot.json`. If absent or already `active: false`, report
   "no relay armed here — already silent" and stop (idempotent).

## Step 1 — Lower the baton

1. Set `${STATE_DIR}/autopilot.json` `active: false` (keep the file as an audit trail; do
   not delete).
2. In the matching `${STATE_DIR}/relay-<relay_id>.json` (relay_id from the flag), set
   `phase: stopped` if it is still `running`. Leave already-`done`/`halted` phases
   untouched.

## Step 2 — Report what remains

List from relay-state both the `stage: accepted` issues (their `pr` is recorded — waiting
to be merged) AND the `stage: spawning` issues (in-flight: a live worktree that may have
already opened its PR before you stopped, with no `pr` recorded yet). The patron needs
both — the accepted ones to merge, the spawning ones to check for an open PR and clean up
the worktree.

## Final Report

```text
monkey-maestro:halt report
  Relay:        <relay_id> → stopped
  Autopilot:    disarmed (active: false)
  Open PRs:     <accepted issues → pr url awaiting your merge> | none
  In-flight:    <spawning issues → branch; live worktrees, may have an open PR> | none
  Worktrees:    left intact — merge + clean up at your tempo
  Relay state:  <STATE_DIR>/relay-<relay_id>.json
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge PRs, remove worktrees, or close Linear issues — only disarm the flag/state.
- Delete the relay-state or flag file — flip the fields, keep the audit trail.
