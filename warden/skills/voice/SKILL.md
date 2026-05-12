---
name: warden:voice
description: Use in Codex when toggling nuthouse fun messages on or off globally, checking voice status, or dispatching one decorative persona line from a calling plugin via SUMMARY/PERSONA_CONTRACT_PATH/VOICE_FLAG_PATH.
model: haiku
effort: low
---

# warden:voice for Codex

## Voice

Read `../../persona.md` at the start of this skill. That persona is
canonical for all user-facing reports from this skill.

**Scope:** local to this skill's execution only. Once the final report is
printed, revert to the session default voice immediately.

This skill is **rigid** - execute the matching mode exactly.

## Language

Adapt all user-facing output to match the user's language. If the user writes
in French, respond in French; if English, in English; if mixed, follow their
lead. Technical identifiers, file paths, code symbols, CLI flags, and tool names
stay in their original form.

## Modes

### Toggle mode

Use when the argument is `on`, `off`, `status`, or absent. Absent means
`status`.

1. Resolve the flag path with `echo "$HOME/.codex/nuthouse/voice.state"`.
2. If the argument is `on` or `off`:
   - Run `mkdir -p "$HOME/.codex/nuthouse"`.
   - Write the argument exactly to `$HOME/.codex/nuthouse/voice.state`.
   - Read the file back to confirm.
3. If the argument is `status` or absent:
   - Read `$HOME/.codex/nuthouse/voice.state`.
   - If the file is absent or unreadable, treat the current state as `on`.
4. Print the final report below.

### Dispatcher mode

Use when the invocation contains all three fields:

```text
SUMMARY: <≤15 words describing the current moment, in the user's language>
PERSONA_CONTRACT_PATH: <absolute path to the calling plugin's shared/persona-line-contract.md>
VOICE_FLAG_PATH: <absolute path to warden's voice.state flag file>
```

1. Read `VOICE_FLAG_PATH`. If the content is `off`, return
   `{ "line": "" }` immediately.
2. If `VOICE_FLAG_PATH` is absent or unreadable, treat voice as `on`.
3. Read `PERSONA_CONTRACT_PATH`. If it is absent or unreadable, return
   `{ "line": "" }` immediately.
4. Generate one decorative reaction line that fits `SUMMARY` and strictly
   follows the persona-line contract.
5. Return strict JSON only:

```json
{ "line": "<decorative reaction in the persona's voice>" }
```

## Final Report

Toggle mode reports exactly:

```text
warden:voice report
  Status:     <on | off>
  Flag file:  <absolute path to voice.state>
  Effect:     <"fun messages enabled - warden:voice dispatcher may emit persona lines" | "fun messages silenced - warden:voice dispatcher returns empty lines">
```

Dispatcher mode reports only the single-line JSON object. No markdown fences, no
prose, no final report.

## Hard Rules

- Never run `git push`, `git commit`, or `git rebase`.
- Never write to any path other than `$HOME/.codex/nuthouse/voice.state`.
- Never modify plugin files, settings, or any project repo.
- Never make voice dispatch a workflow precondition.
- Never retry dispatcher failures; return `{ "line": "" }` instead.
- Dispatcher output must be strict JSON on one line.
