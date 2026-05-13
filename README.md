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

| Plugin                             | Runtime             | Purpose                                                                   |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| [react-monkey](./react-monkey)     | Claude Code + Codex | React implementation discipline with codebase exploration before edits    |
| [linear-devotee](./linear-devotee) | Claude Code + Codex | Linear issue intake, planning, and gated project/milestone/issue creation |
| [acid-prophet](./acid-prophet)     | Claude Code + Codex | Spec writing, spec audit, and PR/spec drift checks                        |
| [warden](./warden)                 | Claude Code + Codex | Shared persona-line dispatcher and global voice toggle                    |
| [git-gremlin](./git-gremlin)       | Claude Code + Codex | Commit and PR drafting with explicit confirmation gates                   |
| [saucy-status](./saucy-status)     | Claude Code         | Statusline and prompt-time fun messages                                   |

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install <plugin>@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install the plugin you want.

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
bun run lint
bun run fmt:check
```

See [the root layout spec](./docs/acid-prophet/specs/2026-05-12-root-plugin-layout.md) for the current structure contract.
