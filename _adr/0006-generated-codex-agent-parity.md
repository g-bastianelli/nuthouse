# ADR 0006 — Generate Codex custom agents from canonical Claude agents

- **Status**: Accepted
- **Date**: 2026-08-18
- **Scope**: All canonical `<plugin>/agents/*.md` definitions in this marketplace.

## Context

Claude Code discovers plugin agents from Markdown files with YAML frontmatter. Local Codex
clients discover custom agents from standalone TOML files in `.codex/agents/` or
`$CODEX_HOME/agents/` (default `~/.codex/agents/`). Maintaining both formats by hand would duplicate long developer
instructions and let model, effort, permission, or output contracts drift.

Codex plugins package skills, hooks, MCP servers, apps, and assets, but do not currently
register custom-agent TOML. Nuthouse therefore needs project-scoped generated files for
repository development and an explicit personal installation step for using the same agents
with installed plugins in other repositories.

## Decision

Keep `<plugin>/agents/*.md` as the only hand-authored source. Generate
`.codex/agents/*.toml` with `scripts/sync-codex-agents.mjs` and optionally synchronize the
same generated files into `$CODEX_HOME/agents/` with `--install`, defaulting to
`~/.codex/agents/` when that variable is unset.

Use these model tiers:

| Claude              | Codex           | Intended work                                   |
| ------------------- | --------------- | ----------------------------------------------- |
| `haiku`             | `gpt-5.6-luna`  | Fetch, parse, scout, deterministic execution    |
| `sonnet`            | `gpt-5.6-terra` | Audit, comparison, bounded reasoning            |
| `opus`              | `gpt-5.6-sol`   | Structural drafting and high-leverage decisions |
| omitted / `inherit` | omitted         | Inherit the parent/default selection            |

Preserve `effort` as `model_reasoning_effort`. Codex agents inherit the parent session's
sandbox and approval policy. Custom-agent TOML cannot override those settings, so the
generator emits no sandbox, network, or approval policy. Read-only instructions define
the agent's task boundary; they do not establish a separate filesystem sandbox. If a
required operation is unavailable under the parent's policy, report that limitation.
Carry Claude tool allowlists, skill preloads, and turn caps into developer instructions;
these remain behavioral contracts rather than native permission enforcement.

Verified against the [custom-agent schema](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agent-file-schema)
and [Codex 0.167.0 role application](https://github.com/openai/codex/blob/rust-v0.167.0/codex-rs/core/src/agent/role.rs).

Treat `<plugin>:<agent>` as the runtime-neutral logical id used by shared skills. Generate a
Codex name as `<plugin_underscored>__<agent_underscored>` and record the logical id in the
custom-agent description. For every plugin whose skills reference a logical agent, generate
`<plugin>/shared/agent-runtime-map.md`; the skill reads that map before delegation and selects
the exact active-runtime name. This avoids duplicating aliases in skill bodies while keeping
dispatch deterministic. The map also requires an isolated task-local Codex spawn because a
typed custom agent cannot use a full-history fork. Require lowercase hyphen-separated source
names and reject every output-name collision before writing.

Mark generated files as owned by Nuthouse. Plan every destination and reject unmanaged
conflicts before applying any writes. Write each TOML through an atomic rename, remove
only Nuthouse-owned outputs, and preserve unrelated personal agents. The dry-run lists
every target and reason before personal installation.

## Consequences

- Agent behavior and logical dispatch stay authored once and are mechanically portable.
- `bun run test:meta` and CI fail when generated TOML is missing, stale, orphaned, or
  colliding.
- `bun run plan:codex-agents` previews project and personal changes;
  `bun run install:codex-agents` applies them only when conflict-free.
- Plugin installation alone does not synchronize personal agents. After a plugin update,
  synchronize from the matching published revision, run `bun run check:installed-codex-agents`,
  and start a new session.
- Claude-only presentation fields such as `color`, and exact tool allowlists, remain
  compatibility instructions rather than native Codex TOML fields.
