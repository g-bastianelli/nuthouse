# 0003 — Dual-runtime stays; Claude Code-first with graceful Codex degradation

## Status

Accepted (2026-06-11)

## Context

A repo-wide audit recommended dropping Codex support entirely, claiming Codex
lacked hooks, subagents, and persistent state. Verification against the
official Codex documentation (CLI 0.139.x, June 2026) refuted the core claims:

- Codex ships a **hooks framework enabled by default** (SessionStart,
  UserPromptSubmit, PreToolUse, PostToolUse, PermissionRequest,
  SubagentStart/Stop, PreCompact/PostCompact, Stop). Plugins can bundle hooks
  via `hooks/hooks.json`, gated by a one-time user trust review (`/hooks`).
- **Subagents are on by default** — custom agents are TOML files
  (`.codex/agents/`), depth-limited and explicitly user-invoked.
- **Persistent memories exist** (`~/.codex/memories/`), and plugin hooks get a
  writable `PLUGIN_DATA` dir. Codex sets `CLAUDE_PLUGIN_ROOT` /
  `CLAUDE_PLUGIN_DATA` aliases specifically for Claude Code plugin
  compatibility.

What genuinely does not port from Claude Code skills: `` !`command` ``
dynamic context injection (open feature request openai/codex#22738),
`context: fork`, and `allowed-tools` frontmatter (both silently ignored), and
agents-as-markdown (Codex agents are TOML).

## Decision

Keep dual-runtime support. Author every skill **Claude Code-first** and adopt
the native 2026 feature surface, with these degradation conventions:

- **Dynamic injection** lives in a `## Context` block that always carries the
  caveat line "If the lines below still show raw, unexpanded dynamic-context
  commands, run them manually before step 1" — on Codex the commands read as
  instructions instead of pre-resolved values. Never write the literal
  bang-backtick pattern in prose: the preprocessor executes any such pattern
  preceded by whitespace, and a failing command aborts the whole skill load.
- **`allowed-tools` / `context: fork` / `agent:`** are additive no-ops on
  Codex (unknown frontmatter is ignored; forked skills run inline there).
  Never make workflow correctness depend on them.
- **State paths** use `${CLAUDE_PLUGIN_DATA}` / `${CLAUDE_PLUGIN_ROOT}`
  everywhere — Codex resolves the same variables via its compatibility
  aliases, so no `${PLUGIN_ROOT:-...}` shims are needed in new code.
- **Hooks** are declared once, in `<plugin>/hooks/hooks.json` (discovered by
  both runtimes); never duplicated inline in `.claude-plugin/plugin.json`
  (double-firing — guarded by `.claude/tests/hooks-dedup.test.mjs`).

## Consequences

- Both registries (`.claude-plugin/marketplace.json` and
  `.agents/plugins/marketplace.json`) and both per-plugin manifests remain
  mandatory for `codex`/`both` plugins, as documented in CLAUDE.md.
- Skills may freely use injection, forks, and allowlists as long as the
  degradation conventions above hold; Codex users get the same workflows with
  more manual steps, not broken ones.
- Any future "drop a runtime" proposal must cite the official docs of the
  runtime, not inference from repo state — the refuted audit is the cautionary
  tale.
