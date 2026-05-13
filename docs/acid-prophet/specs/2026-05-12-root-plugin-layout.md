---
id: root-plugin-layout
status: accepted
linear-project: _none_
verified-by: bun test; bun run test:meta; bun run lint; bun run fmt:check
last-reviewed: 2026-05-12
---

# Root Plugin Layout

## Problem & Why

Nuthouse previously drifted between Claude Code and Codex layouts: some skills lived under `claudecode/skills/`, Codex skills lived at root `skills/`, and docs/scaffolds still referenced older runtime-specific trees. That made marketplace installs fragile and allowed stale skill references to survive after a plugin update.

The repository now follows the Superpowers-style model: the plugin directory is the install unit, and root `skills/` is the canonical skill source.

## Solution

Every cross-runtime plugin uses one root tree:

```text
<plugin>/
  .claude-plugin/plugin.json
  .codex-plugin/plugin.json
  README.md
  persona.md
  assets/
  shared/
  skills/
  agents/
  lib/
  tests/
  claudecode/
    hooks/
    lib/
    tests/
    data/
```

Required manifest rules:

- Claude Code manifests use `"skills": "./skills/"`.
- Claude Code manifests list agents as `"./agents/<agent>.md"`.
- Codex manifests use `"skills": "./skills/"`.
- Marketplace entries point to `<plugin>`, never `<plugin>/claudecode` or `<plugin>/codex`.

## Architecture

Root files are runtime-neutral unless their directory says otherwise.

| Path                                                       | Contract                                              |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `skills/<skill>/SKILL.md`                                  | Canonical skill body shared by runtimes               |
| `agents/<agent>.md`                                        | Canonical agent body exposed by Claude Code manifests |
| `shared/`                                                  | Cross-runtime contracts and notes                     |
| `lib/`, `tests/`                                           | Runtime-neutral helpers and tests                     |
| `claudecode/hooks/`                                        | Claude Code hook scripts only                         |
| `claudecode/lib/`, `claudecode/tests/`, `claudecode/data/` | Claude-only runtime support                           |

Skill frontmatter uses local names only:

```yaml
---
name: write-spec
description: Use when ...
---
```

The runtime exposes installed skills as `<plugin>:<skill>`. Do not write `name: <plugin>:<skill>` inside root skills.

Root skills read plugin persona with `../../persona.md`.

## Scaffolding Rules

- `scaffold-plugin` creates root `skills/` and root `agents/`, plus `claudecode/` only for Claude-specific hooks/data/lib/tests.
- `scaffold-skill` writes exactly one file: `<plugin>/skills/<skill>/SKILL.md`.
- `scaffold-agent` writes `<plugin>/agents/<agent>.md` and updates the Claude manifest.
- Audit tooling scans root `skills/` and `agents/`.
- New docs must not recommend `codex/skills`, `codex/agents`, `claudecode/skills`, or `claudecode/agents`.

## Error Handling

If an installed plugin references a missing skill, first inspect the marketplace cache path and compare it to the plugin manifest. The expected fix is to remove stale manifest/docs references or publish the plugin with the root `skills/` tree, not to recreate old runtime folders.

If a runtime needs a runtime-specific behavior difference, keep the skill body root-canonical and branch inside the workflow text. Do not fork the file into runtime-specific copies.

## Testing Approach

Required checks before commit:

```bash
bun test
bun run test:meta
bun run lint
bun run fmt:check
node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json', 'utf8'))"
```

Also run a targeted grep before layout changes land:

```bash
rg 'claudecode/skills|claudecode/agents|codex/skills|codex/agents' README.md CLAUDE.md docs _adr _templates .claude/skills */README.md
```

Historical specs may mention old paths only when clearly marked as superseded history.

## Non-goals

- No migration for `saucy-status`, which remains Claude Code-only and historically shaped.
- No duplicate runtime skill directories.
- No new package dependencies.
- No automatic rollback for already installed stale marketplace caches; users should update/reinstall the plugin cache after publishing.
