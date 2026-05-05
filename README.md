<p align="center">
  <img src="./assets/banner.png" width="640" />
</p>

<h1 align="center">nuthouse</h1>

<p align="center">
  Cross-platform AI agent plugin marketplace — Claude Code + Codex
</p>

<p align="center">
  <a href="https://github.com/g-bastianelli/nuthouse/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/g-bastianelli/nuthouse?style=flat-square&color=fbbf24" /></a>
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-compatible-8B5CF6?style=flat-square" />
  <img alt="Codex" src="https://img.shields.io/badge/Codex-compatible-10B981?style=flat-square" />
  <img alt="License" src="https://img.shields.io/github/license/g-bastianelli/nuthouse?style=flat-square" />
  <img alt="bun" src="https://img.shields.io/badge/bun-1.3-f472b6?style=flat-square&logo=bun" />
</p>

---

Plugins, skills, and agents for Claude Code and Codex. Each plugin ships cross-runtime — install once, works everywhere.

## Plugins

| Plugin | What it does | Runtime |
|--------|-------------|---------|
| [saucy-status](./saucy-status) | Rotates suggestive messages in statusline + conversation while Claude thinks | Claude Code |
| [react-monkey](./react-monkey) | React implementation specialist — parallel exploration, strict component architecture | Claude Code + Codex |
| [linear-devotee](./linear-devotee) | Détecte ton issue Linear, prépare un brief SDD, et crée Projects / Milestones / Issues en cascade. Voix devotee / carnal worship | Claude Code + Codex |
| [acid-prophet](./acid-prophet) | Structured spec-writing — Q&A → spec → audit → optional Linear handoff. Includes the `scryer` audit agent that flags SDD violations, codebase contradictions, and ambiguity | Claude Code + Codex |
| [warden](./warden) | Centralized voice agent for nuthouse plugins — emits decorative persona lines; global on/off toggle silences all fun messages | Claude Code |

## Install

### Claude Code

Add this marketplace, then install any plugin:

```
/plugin marketplace add g-bastianelli/nuthouse
```

```
/plugin install react-monkey
/plugin install linear-devotee@nuthouse
/plugin install saucy-status@saucy-status
/plugin install acid-prophet@nuthouse
/plugin install warden@nuthouse
```

Restart Claude Code after installing.

### Codex CLI

```
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open the plugin browser (`/plugins`) and install from there.

Codex runtime folders are present for:

```
react-monkey
linear-devotee
acid-prophet
```

## Development

```bash
bun install
```

Pre-commit linting via [Biome](https://biomejs.dev/) runs automatically on `git commit`.
