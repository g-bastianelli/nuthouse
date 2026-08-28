---
name: mode
description: Use when setting, inspecting, or resetting the current Git worktree's nuthouse workflow profile with `warden:mode quick|standard|strict|status|reset`.
argument-hint: "[quick|standard|strict|status|reset]"
model: haiku
allowed-tools: Bash(node:*), Bash(git rev-parse:*), Read
---

# mode

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Keep configuration work literal and precise; apply the persona only to short user-facing transitions.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

This skill is **rigid** — execute steps in order.

## Language

Match the user's language. Keep profiles, file paths, JSON fields, CLI flags, and diagnostic codes unchanged.

## When you're invoked

Use this skill for an explicit `warden:mode` invocation or a request to set, inspect, or clear the workflow profile for the current Git worktree. It manages only the temporary worktree preference; it does not route tasks or own domain workflow artifacts.

## Workflow

1. Preconditions:
   - Parse exactly one action from `$ARGUMENTS`: `quick`, `standard`, `strict`, `status`, or `reset`. Empty input means `status`. Reject every other value without writing state.
   - Verify the current directory is inside a Git worktree with `git rev-parse --show-toplevel`.
   - Resolve `PLUGIN_ROOT`. Prefer `${CLAUDE_PLUGIN_ROOT}` when set; otherwise infer it as two directories above this skill folder from the installed skill path or current repository layout.
   - Require `<PLUGIN_ROOT>/scripts/mode.mjs`. Do not fall back to repository-only `_shared` files.

2. Execute the kernel client:
   - Run `node <PLUGIN_ROOT>/scripts/mode.mjs <action>` from the user's current worktree and capture stdout, stderr, and the exit status.
   - The script owns configuration loading, validation, precedence, worktree identity, expiry, writes, and reset. Never reproduce those rules in the skill.
   - Parse stdout as the script's JSON result even when the process exits non-zero. If stdout is not valid JSON, report stderr verbatim and stop.

3. Handle blocked resolution:
   - When `blocked` is `true`, select the blocking error from `diagnostics` and report its `source`, exact `field`, `code`, and `message`.
   - Do not retry, write an override, offer `force quick`, or reinterpret the invalid configuration.

4. Report the result:
   - For `quick`, `standard`, or `strict`, state the current-worktree override path and expiry, then include the resolved mode status.
   - For `reset`, state whether the current-worktree override was removed, then include the resolved mode status. Validate repository configuration first; a blocker leaves the override unchanged.
   - For `status`, make no preference mutation and include every field below.

## Final Report

```text
warden:mode report
  Action:                <quick | standard | strict | status | reset>
  Requested profile:     <quick | standard | strict>
  Effective profile:     <quick | standard | strict>
  Configuration sources: <ordered source trace>
  Escalations:           <list | none>
  Enabled capabilities:  <list | none>
  Diagnostics:           <list | none>
  Override:              <path and expiry | removed | none>
  Blocked:               <source + exact field + code + message | no>
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Import or execute repository-only `_shared/workflow` files at runtime.
- Write personal configuration, repository configuration, voice state, another worktree's override, or domain artifacts.
- Delete any path other than the current worktree override returned by the kernel client.
- Compute risk floors, immutable gates, escalations, or capabilities inside this skill.
- Offer or implement a `force quick` bypass.
