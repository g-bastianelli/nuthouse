---
name: halt
description: Use when the user wants to stop the autopilot relay — "arrête l'autopilote", "baton down", "stop the relay", "autopilote off", "coupe le relais". Disarms the repo-scoped autopilot control flag so no further worktrees spawn. It does not maintain or edit a local issue queue; Linear and GitHub remain the authority.
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
open PRs, worktrees, and Linear issues remain for the patron to merge, inspect, or clean
up at their own tempo.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse` (the repo's shared `.git` dir — the same path from the main repo and every worktree).
2. Read `${STATE_DIR}/autopilot.json`. If absent or already `active: false`, report
   "no relay armed here — already silent" and stop (idempotent).

## Step 1 — Lower the baton

Set `${STATE_DIR}/autopilot.json` `active: false` and `last_halt_reason: stopped_by_user`
(keep the file as an audit/control trail; do not delete it). Do not read or write any
`relay-<relay_id>.json` file; local relay-state is obsolete.

## Step 2 — Report what remains

Report only what the control flag actually knows: relay id, last accepted issue/PR,
budget counter, and flag path. Do not claim a full list of in-flight issues from local
state. Tell the patron that remaining truth lives in Linear/GitHub:

- Linear issues with status `In Progress` / `In Review` show work currently underway.
- GitHub open PRs show work awaiting merge.
- Local worktrees remain intact; this skill never deletes them.

## Final Report

```text
monkey-maestro:halt report
  Relay:        <relay_id> → stopped
  Autopilot:    disarmed (active: false)
  Last issue:   <last_issue | _none_>
  Last PR:      <last_pr | _none_>
  Budget:       <accepted_count>/<max_issues>
  Authority:    inspect Linear + GitHub for live work; no local relay-state queue
  Worktrees:    left intact — merge + clean up at your tempo
  Control flag: <STATE_DIR>/autopilot.json
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge PRs, remove worktrees, or close Linear issues — only disarm the flag.
- Delete the control flag file — flip fields, keep the audit trail.
- Read or write `relay-<relay_id>.json` as queue state.
