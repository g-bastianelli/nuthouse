<p align="center">
  <img src="./assets/banner.png" width="640" />
</p>

<h1 align="center">skill-issue</h1>

<p align="center">
  Cross-platform AI agent plugin marketplace — Claude Code + Codex
</p>

<p align="center">
  <a href="https://github.com/g-bastianelli/skill-issue/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/g-bastianelli/skill-issue?style=flat-square&color=fbbf24" /></a>
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-compatible-8B5CF6?style=flat-square" />
  <img alt="Codex" src="https://img.shields.io/badge/Codex-compatible-10B981?style=flat-square" />
  <img alt="License" src="https://img.shields.io/github/license/g-bastianelli/skill-issue?style=flat-square" />
  <img alt="bun" src="https://img.shields.io/badge/bun-1.3-f472b6?style=flat-square&logo=bun" />
</p>

---

Plugins, skills, and agents for Claude Code and Codex. Each plugin ships cross-runtime — install once, works everywhere.

## Plugins

| Plugin | What it does | Runtime |
|--------|-------------|---------|
| [saucy-status](./saucy-status) | Rotates suggestive messages in statusline + conversation while Claude thinks | Claude Code |
| [react-monkey](./react-monkey) | React implementation specialist — parallel exploration, strict component architecture | Claude Code + Codex |
| [linear-simp](./linear-simp) | Détecte ton issue Linear au début de session, set In Progress, prépare un brief SDD, voix simp brainrot | Claude Code |

## Install

### Claude Code

Add this marketplace, then install any plugin:

```
/plugin marketplace add g-bastianelli/skill-issue
```

```
/plugin install react-monkey
/plugin install linear-simp@skill-issue
/plugin install saucy-status@saucy-status
```

Restart Claude Code after installing.

### Codex CLI

```
codex plugin marketplace add g-bastianelli/skill-issue
```

Then open the plugin browser (`/plugins`) and install from there.

## Development

```bash
bun install
```

Pre-commit linting via [Biome](https://biomejs.dev/) runs automatically on `git commit`.
