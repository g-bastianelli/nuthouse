---
name: scaffold-agent
description: Scaffold a dedicated functional subagent for an existing nuthouse plugin. Use when a recurring task needs isolated context, an explicit tool allowlist, and a strict input/output contract.
model: haiku
---

# scaffold-agent

Read `../persona.md`; it is canonical for this skill's user-facing output until the report. Match
the user's language and keep technical identifiers unchanged.

Create one canonical `<plugin>/agents/<agent>.md` and derive the Codex port from it.

## Workflow

1. Verify the repository root and selected parent plugin. The parent must expose Claude agents;
   a truly Codex-only plugin cannot add this canonical agent path.
2. Resolve only missing consequential inputs:
   - parent plugin and kebab-case functional role name;
   - routing description and read-only/write-capable boundary;
   - model/effort when inheritance is unsuitable;
   - minimal explicit tools allowlist;
   - compact structured input and deterministic output;
   - optional shared contract and turn/memory constraints.
3. Reject vague or persona-only names (`agent`, `helper`, `worker`, `seer`, `oracle`) and a name
   matching its plugin. Require explicit justification before granting write tools.
4. For standard SDD or technical-report output shapes, read
   [references/output-contracts.md](references/output-contracts.md). For custom output, require a
   complete fixed shape before generation.
5. Read `_templates/agent/AGENT.md` immediately before writing. Keep Mission ordered, input fields
   explained, output machine-consumable, missing evidence `_unclear_`, and the agent voice neutral.
6. If a shared contract applies, reference
   `${CLAUDE_PLUGIN_ROOT}/shared/<contract>.md`; do not use cwd-relative paths.
7. Run `bun run sync:codex-agents`, `bun run check:codex-agents`, `bun run test:meta`, and relevant
   plugin tests. Update the sync capability matrix and parity tests when commands need write,
   build/cache, or network capabilities.

## Report

```text
scaffold-agent
  Plugin:       <plugin>
  Agent:        <plugin>:<agent>
  Boundary:     read-only | write-capable
  Tools:        <allowlist>
  Input/output: <contract summary>
  Canonical:    <plugin>/agents/<agent>.md
  Codex port:   .codex/agents/<generated-name>.toml
  Verification:<checks and results>
```

Never commit, push, rebase, overwrite an existing agent without explicit authorization, leave an
empty tool allowlist, add decorative voice, invent missing evidence, or edit generated Codex TOML
by hand. Personal installation remains a separate user-requested action.
