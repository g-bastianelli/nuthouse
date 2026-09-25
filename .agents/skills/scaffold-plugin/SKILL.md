---
name: scaffold-plugin
description: Scaffold a new nuthouse plugin for Claude Code, Codex, or both. Use for a new plugin; creates canonical manifests, persona, assets, registries, and optional runtime hooks from repository templates.
model: haiku
---

# scaffold-plugin

Read `../persona.md`; it is canonical for this skill's user-facing output until the report. Match
the user's language and keep technical identifiers unchanged.

Create a persona-led plugin at one root. Runtime-specific code may branch; skills and agents do not.

## Workflow

1. Verify both marketplace registries parse, the target folder is absent, and the repository
   templates exist. Discover current conventions from files, not memory.
2. Resolve only missing consequential inputs: persona-style kebab-case name, English one-line
   description, Claude/Codex/both, optional hooks, tagline and one emoji, marketplace category,
   and whether project artifacts or shared contracts are expected.
3. Reject corporate/abstract names and collisions. A nuthouse plugin must have a persona; if the
   user rejects that contract, stop instead of generating an incompatible plugin.
4. Read the persona, Claude manifest, Codex manifest, README, and banner prompt templates
   immediately before generation. Substitute their variables and fill only their explicit
   placeholders; do not restate the templates inside this skill.
5. Create the canonical root layout:
   - `persona.md`, `assets/BANNER_PROMPT.md`, `assets/`, and `skills/`;
   - `.claude-plugin/plugin.json` plus `claudecode/` only for Claude support;
   - `.codex-plugin/plugin.json` plus runtime-neutral `lib/` or `tests/` only when needed;
   - `shared/` only when a concrete artifact or cross-cutting contract needs it.
6. When hooks are selected, read [references/hooks.md](references/hooks.md) before creating them.
   Do not load that reference for a plugin without hooks.
7. Append, without reordering:
   - Claude registry: git-subdir path `<plugin>`, lowercase category, SHA managed by release;
   - Codex registry when supported: path `./<plugin>`, TitleCase category, availability policy,
     and no SHA field.
     Reparse each changed registry immediately. Restore its exact pre-edit content and stop if an
     edit does not parse.
8. Append the plugin to the root README table and the Claude install block when applicable.
9. Run `bun run check:workflow`, `bun run check:skills`, `bun run test:meta`, lint, formatting,
   and the narrow generated tests. Report unavailable tooling instead of claiming success.

## Report

```text
scaffold-plugin
  Plugin:       <name and description>
  Runtimes:     Claude Code | Codex | both
  Hooks:        <events or none>
  Persona:      <path>
  Registries:   <updated paths>
  Banner:       <prompt path>; asset pending at assets/banner.png
  Verification:<checks and results>
  Next:         scaffold the first focused skill or agent
```

Never commit, push, rebase, bypass hooks, add plugin-local package dependencies, generate CJS
hooks, duplicate runtime skill trees, omit the persona/banner prompt, or leave a registry corrupt.
