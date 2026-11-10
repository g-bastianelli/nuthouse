<p align="center">
  <img src="./assets/banner.png" width="640" />
</p>

<h1 align="center">nuthouse</h1>

<p align="center">Claude Code + Codex plugins with one shared root layout.</p>

<p align="center">
  <a href="https://github.com/g-bastianelli/nuthouse/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/g-bastianelli/nuthouse?style=flat-square&color=fbbf24" /></a>
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-compatible-8B5CF6?style=flat-square" />
  <img alt="Codex" src="https://img.shields.io/badge/Codex-compatible-10B981?style=flat-square" />
  <img alt="License" src="https://img.shields.io/github/license/g-bastianelli/nuthouse?style=flat-square" />
  <img alt="bun" src="https://img.shields.io/badge/bun-1.3-f472b6?style=flat-square&logo=bun" />
</p>

## Plugins

| Plugin                             | Runtime             | Purpose                                                                                |
| ---------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| [subroutine](./subroutine)         | Claude Code + Codex | Ambient TS discipline knowledge skills that activate on matching files                 |
| [linear-devotee](./linear-devotee) | Claude Code + Codex | Linear intake, planning, creation, and resumable issue delivery through verified merge |
| [acid-prophet](./acid-prophet)     | Claude Code + Codex | Spec writing, spec audit, and PR/spec drift checks                                     |
| [git-gremlin](./git-gremlin)       | Claude Code + Codex | Commit, PR, native review, comment resolution, CI and protected merge                  |
| [lore-hound](./lore-hound)         | Claude Code + Codex | Source-hunting research harness: fan-out search → fetch → verify → cite                |
| [stack-golem](./stack-golem)       | Claude Code + Codex | Notom-stack ops & debug — Scaleway, observability, local dev                           |
| [moon-moth](./moon-moth)           | Claude Code + Codex | Small Moon helper that reports and verifies affected projects                          |
| [monkey-maestro](./monkey-maestro) | Claude Code + Codex | Supervise Linear delivery in isolated Superset issue workspaces with scoped recovery   |

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install <plugin>@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
codex plugin add <plugin>@nuthouse
```

You can also choose plugins from `/plugins`.

Plugins with dedicated agents need one additional Codex setup step. From a checkout of
Nuthouse matching the installed release, preview and synchronize the generated agents:

```bash
bun run plan:codex-agents
bun run install:codex-agents
bun run check:installed-codex-agents
```

The plan lists every write and removal. Installation preserves unrelated personal agents
and refuses unmanaged conflicts. It targets `$CODEX_HOME/agents`, or `~/.codex/agents`
when `CODEX_HOME` is unset; use the same environment as your Codex session.

After a published update, run `codex plugin marketplace upgrade nuthouse`, refresh the
agents from that published revision with the same three commands, and start a new session.
Marketplace upgrades alone do not synchronize personal agents.

## Layout

Cross-runtime plugins use one canonical root tree:

```text
<plugin>/
  .claude-plugin/plugin.json      # skills: ./skills/, agents: ./agents/*.md
  .codex-plugin/plugin.json       # skills: ./skills/
  assets/
  persona.md
  shared/
  skills/
  agents/
  lib/
  tests/
  claudecode/                     # Claude-only hooks/lib/tests/data
```

Skills and agents live at the plugin root. Do not create duplicate runtime copies under `codex/` or `claudecode/skills/`.

## Development

```bash
bun install
bun test
bun run test:meta
bun run check:workflow
bun run check:skills
bun run check:codex-agents
bun run check:runtime
bun run check:duplication
bun run lint
bun run fmt:check
```

See the **Plugin Structure** section of [CLAUDE.md](./CLAUDE.md) for the current structure contract.
