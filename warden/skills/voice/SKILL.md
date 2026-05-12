---
name: voice
description: Use when toggling nuthouse fun messages on or off globally — /warden:voice [on|off|status]. Controls the shared flag read by warden:voice agent before emitting any decorative persona line.
model: haiku
allowed-tools: Bash, Read
---

# warden:voice

Rigid toggle gate. Match the user's language; keep technical identifiers unchanged.

## Workflow

1. Preconditions:
   - Parse the argument from the invocation: `on`, `off`, `status`, or absent (treated as `status`).
   - Resolve the flag file absolute path: run `echo "$HOME/.claude/nuthouse/voice.state"` and capture the result.
2. If argument is `on` or `off`:
   - Run `mkdir -p "$HOME/.claude/nuthouse" && echo "<on_or_off>" > "$HOME/.claude/nuthouse/voice.state"`.
   - Read back the file to confirm the write succeeded.
3. If argument is `status` or absent:
   - Read `$HOME/.claude/nuthouse/voice.state`. If absent or unreadable, current state is `on` (default — no breaking change).
4. Report the current state.

## Final Report

```text
warden:voice report
  Status:     <on | off>
  Flag file:  <absolute path to voice.state>
  Effect:     <"fun messages enabled — warden:voice agent will emit persona lines" | "fun messages silenced — warden:voice agent returns empty lines">
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Dispatch the `warden:voice` agent from within this skill.
- Write to any path other than `$HOME/.claude/nuthouse/voice.state`.
- Modify plugin files, settings, or any project repo.
