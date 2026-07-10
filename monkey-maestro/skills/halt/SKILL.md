---
name: halt
description: Use when the user wants to stop an autopilot relay — "arrête l'autopilote", "baton down", "stop the relay", "autopilote off", "coupe le relais". Disarms one Linear project's control flag so no further worktrees spawn. With several projects armed in one repo, infer the current branch's project or require an explicit issue/project; `--all` is the explicit all-projects escape hatch. `--legacy` disarms the old pre-project-scoping relay once during migration. It does not maintain or edit a local issue queue; Linear and GitHub remain the authority.
model: haiku
effort: low
argument-hint: "[issue-id|project-id|--all|--legacy]"
allowed-tools: Bash(git rev-parse:*), Bash(git branch --show-current), Bash(cat:*), Bash(rmdir:*), Read, Glob, Write, mcp__claude_ai_Linear__get_issue
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

## When you're invoked

The patron calls the symphony to a close mid-performance. The maestro lowers the baton:
disarm only the selected project's flag so no further movement begins for that project.
Nothing already in flight is destroyed — open PRs, worktrees, and Linear issues remain
for the patron to merge, inspect, or clean up at their own tempo.

## Step 0 — Preconditions

1. Verify this is a git repo. Capture `COMMON_DIR = $(git rev-parse --path-format=absolute --git-common-dir)`, `STATE_ROOT = ${COMMON_DIR}/nuthouse/relays`, and `LEGACY_FLAG = ${COMMON_DIR}/nuthouse/autopilot.json`.
2. `--legacy` is terminal and may not be combined with an issue, project id, or `--all`:
   - If `LEGACY_FLAG` is active and unexpired, set it `active: false` with
     `last_halt_reason: stopped_by_user`, report the legacy relay stopped, and stop.
   - Otherwise, report "no legacy relay armed — already silent" and stop. Never continue
     into project target resolution after `--legacy`.
3. Migration only for `--all`: if `LEGACY_FLAG` is active and unexpired, include it in the
   explicit all-relays operation. Do not use a legacy flag to select or stop a
   project-scoped relay.
4. Resolve a target project in this order:
   - An explicit issue id: fetch it from Linear and use its project id.
   - An explicit project id: use it only after validating the matching flag embeds the same id.
   - The current branch's Linear issue id: fetch it from Linear and use its project id.
   - `--all`: enumerate active `${STATE_ROOT}/*/autopilot.json` flags.
5. With no target and exactly one active project flag, use that one. With no target and
   multiple active project flags, stop and ask for an issue/project id or `--all`; never
   choose one arbitrarily.
6. For one target, set `PROJECT_STATE_DIR = ${STATE_ROOT}/<linear_project_id>`,
   `RELAY_FLAG = ${PROJECT_STATE_DIR}/autopilot.json`, and `LOCK_DIR = ${PROJECT_STATE_DIR}/lock`.
   If `RELAY_FLAG` is absent or already `active: false`, report "no relay armed for this
   project — already silent" and stop (idempotent).

## Step 1 — Lower the baton

For one target, set only `RELAY_FLAG` `active: false` and
`last_halt_reason: stopped_by_user`, then remove only that empty `LOCK_DIR` (keep the
flag as an audit/control trail; do not delete it). With explicit `--all`, do the same for
each active project flag and its sibling lock. Do not read or write any
`relay-<relay_id>.json` file; local relay-state is obsolete.

## Step 2 — Report what remains

Report only what the selected control flag(s) actually know: project id, relay id, last
accepted issue/PR, and flag path. Do not claim a full list of in-flight issues from local
state. Tell the patron that remaining truth lives in Linear/GitHub:

- Linear issues with status `In Progress` / `In Review` show work currently underway.
- GitHub open PRs show work awaiting merge.
- Local worktrees remain intact; this skill never deletes them.

## Final Report

```text
monkey-maestro:halt report
  Project:      <linear project id | all active projects>
  Relay:        <relay_id> → stopped
  Autopilot:    disarmed (active: false)
  Last issue:   <last_issue | _none_>
  Last PR:      <last_pr | _none_>
  Authority:    inspect Linear + GitHub for live work; no local relay-state queue
  Worktrees:    left intact — merge + clean up at your tempo
  Control flag: <RELAY_FLAG>
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Merge PRs, remove worktrees, or close Linear issues — only disarm the flag.
- Delete the control flag file — flip fields, keep the audit trail.
- Disarm a different project merely because it shares this Git repository.
- Read or write `relay-<relay_id>.json` as queue state.
