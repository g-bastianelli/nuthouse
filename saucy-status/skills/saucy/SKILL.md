---
name: saucy
description: Control saucy-status mode. Use when user types /saucy [on|off|gooning|status|install|uninstall]. No arg → toggle off↔saucy.
argument-hint: [on|off|gooning|status|install|uninstall]
model: haiku
disable-model-invocation: true
---

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

Read `../../persona.md` at skill start — the saucy voice is canonical. Mechanical work (flag toggle, state file write) stays serious — only the strings are saucy.

## Workflow

1. Preconditions:
   - Verify `CLAUDE_PLUGIN_DATA` is available. If not, abort: "CLAUDE_PLUGIN_DATA is required — cannot write state."
   - Resolve `CLAUDE_PLUGIN_ROOT`. If the `${CLAUDE_PLUGIN_ROOT}` placeholder below renders literally, compute it as 2 levels above this skill's base directory (`BASE_DIR/../..`).

2. Parse arg — the raw invocation argument is `$ARGUMENTS` (empty means no arg):

   | Arg             | Action                                                          |
   | --------------- | --------------------------------------------------------------- |
   | `on` or `saucy` | write `saucy`                                                   |
   | `off`           | write `off`                                                     |
   | `gooning`       | write `gooning`                                                 |
   | `status`        | report current mode, no write                                   |
   | `install`       | write `statusLine` to `~/.claude/settings.json`                 |
   | `uninstall`     | remove `statusLine` from `~/.claude/settings.json`, remove flag |
   | (none)          | toggle: `off` → `saucy`, else → `off`                           |

3. Run the state script via Bash, passing the user's argument (or nothing for toggle):

   ```bash
   CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA}" \
     node "${CLAUDE_PLUGIN_ROOT}/scripts/state.mjs" ARG
   ```

   Replace `ARG` with the parsed argument; omit it entirely when there is no arg. The script owns all state logic: flag read/write under `${CLAUDE_PLUGIN_DATA}/.state`, the off↔saucy toggle, and `statusLine` install/uninstall in `~/.claude/settings.json`. It prints the resulting state on stdout and exits non-zero on an unknown arg — surface its stderr verbatim if it fails.

4. Report the resulting state:
   - `saucy` → "saucy mode activated 🌶️ — suggestive messages enabled"
   - `off` → "saucy-status off — back to normal"
   - `gooning` → "GOONING mode 🫠 — Claude lost in your embeddings"
   - `status` → "current mode: <mode>"
   - `install` → "saucy-status installed — restart Claude Code to apply"
   - `uninstall` → "saucy-status uninstalled — restart Claude Code to apply"

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Write state if `CLAUDE_PLUGIN_DATA` is unavailable — abort instead.
- Treat `CLAUDE_PLUGIN_ROOT` as writable — it's read-only package data.
- Mutate `~/.claude/settings.json` for any arg other than `install` or `uninstall`.
- Reimplement the state logic inline — always go through `scripts/state.mjs`.
