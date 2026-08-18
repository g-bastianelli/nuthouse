# ADR 0006 — Generate Codex custom agents from canonical Claude agents

- **Status**: Accepted
- **Date**: 2026-08-18
- **Scope**: All canonical `<plugin>/agents/*.md` definitions in this marketplace.

## Context

Claude Code discovers plugin agents from Markdown files with YAML frontmatter. Local Codex
clients discover custom agents from standalone TOML files in `.codex/agents/` or
`~/.codex/agents/`. Maintaining both formats by hand would duplicate long developer
instructions and let model, effort, permission, or output contracts drift.

Codex plugins package skills, hooks, MCP servers, apps, and assets, but do not currently
register custom-agent TOML. Nuthouse therefore needs project-scoped generated files for
repository development and an explicit personal installation step for using the same agents
with installed plugins in other repositories.

## Decision

Keep `<plugin>/agents/*.md` as the only hand-authored source. Generate
`.codex/agents/*.toml` with `scripts/sync-codex-agents.mjs` and optionally synchronize the
same generated files into `~/.codex/agents/` with `--install`.

Use these model tiers:

| Claude              | Codex           | Intended work                                   |
| ------------------- | --------------- | ----------------------------------------------- |
| `haiku`             | `gpt-5.6-luna`  | Fetch, parse, scout, deterministic execution    |
| `sonnet`            | `gpt-5.6-terra` | Audit, comparison, bounded reasoning            |
| `opus`              | `gpt-5.6-sol`   | Structural drafting and high-leverage decisions |
| omitted / `inherit` | omitted         | Inherit the parent/default selection            |

Preserve `effort` as `model_reasoning_effort`. Select the narrowest sandbox that still
supports the agent's real command effects:

| Capability                                       | Generated Codex policy                          |
| ------------------------------------------------ | ----------------------------------------------- |
| Read-only filesystem, web, or connector work     | `sandbox_mode = "read-only"`                    |
| Local verification or commit writes              | `sandbox_mode = "workspace-write"`              |
| PR creation or remote platform command workflows | `workspace-write` with outbound network enabled |

The explicit network policy is limited to `git-gremlin:pr-drafter` and
`stack-golem:platform-scout`; `moon-moth:verify-runner` and
`git-gremlin:commit-drafter` receive local workspace writes only. Parent runtime permission
overrides and approval gates still apply. Carry Claude tool allowlists, skill preloads, and
turn caps into the developer instructions because Codex custom-agent TOML does not provide
one-to-one fields for all of those Claude settings.

Treat `<plugin>:<agent>` as the runtime-neutral logical id used by shared skills. Generate a
Codex name as `<plugin_underscored>__<agent_underscored>` and record the logical id in the
custom-agent description. For every plugin whose skills reference a logical agent, generate
`<plugin>/shared/agent-runtime-map.md`; the skill reads that map before delegation and selects
the exact active-runtime name. This avoids duplicating aliases in skill bodies while keeping
dispatch deterministic. The map also requires an isolated task-local Codex spawn because a
typed custom agent cannot use a full-history fork. Require lowercase hyphen-separated source
names and reject every output-name collision before writing.

Mark generated files as owned by Nuthouse. Plan every destination and reject unmanaged or
modified-legacy conflicts before applying any writes. Write each TOML through an atomic
rename, remove only Nuthouse-owned or byte-identical legacy outputs, and preserve unrelated
personal agents. Provide a dry-run before personal installation.

## Consequences

- Agent behavior and logical dispatch stay authored once and are mechanically portable.
- `bun run test:meta` and CI fail when generated TOML is missing, stale, orphaned, or
  colliding.
- `bun run plan:codex-agents` previews project and personal changes;
  `bun run install:codex-agents` applies them only when conflict-free.
- Plugin installation alone does not mutate `~/.codex/agents/`; personal installation stays
  explicit.
- Claude-only presentation fields such as `color`, and exact tool allowlists, remain
  compatibility instructions rather than native Codex TOML fields.
