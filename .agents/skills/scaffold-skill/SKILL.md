---
name: scaffold-skill
description: Scaffold a focused workflow or background-contract skill inside an existing nuthouse plugin. Use when adding a skill; derives the smallest useful entrypoint from repository templates and validates progressive disclosure.
model: haiku
---

# scaffold-skill

Read `../persona.md`; it is canonical for this skill's user-facing output until the report. Match
the user's language and keep technical identifiers unchanged.

Create one canonical `<plugin>/skills/<skill>/SKILL.md`; runtime manifests expose that same tree.

## Workflow

1. Verify the repository root through both marketplace registries. Discover parent plugins from
   root `persona.md` files and require the selected parent to have a matching runtime manifest.
2. Resolve only consequential inputs not already supplied:
   - parent plugin and kebab-case action-oriented skill name, without plugin prefix;
   - what the skill does and when it activates;
   - workflow or background contract;
   - supported runtime intersection with the parent;
   - required tools, arguments, subagent, mutation/approval boundary, and output;
   - optional model/effort override only when the default is demonstrably unsuitable.
3. Reject vague (`helper`, `utils`, `tool`) or persona-coded names. Refuse a collision unless the
   user explicitly changes this task from creation to updating the existing skill.
4. For advanced execution, artifact, auto-chain, or subagent choices, read
   [references/advanced-options.md](references/advanced-options.md). Do not load it for an
   ordinary inline skill.
5. Read the applicable source template immediately before writing:
   - workflow: `_templates/skill/codex/SKILL.md`;
   - background knowledge: `_templates/skill/contract/SKILL.md`.
6. Generate the smallest complete entrypoint:
   - keep the shared outcome, ordered decisions, authorization, stops, verification, and report
     in `SKILL.md`;
   - add `references/` only for genuinely conditional procedures, schemas, or extended examples;
   - route every reference with an explicit “read when” condition;
   - use a script when deterministic repeated logic is safer than prose.
7. Preserve root conventions: unprefixed frontmatter `name`, `../../persona.md` for user-facing
   skills, `genre: contract` for background contracts, and no runtime-specific copies.
8. Run `bun run check:skills`, `bun run test:meta`, and the narrow plugin tests. Fix generated
   structural failures before reporting; disclose unavailable checks.

## Report

```text
scaffold-skill
  Plugin:      <plugin>
  Skill:       <plugin>:<skill>
  Genre:       workflow | contract
  Runtime:     Claude Code | Codex | both
  Entrypoint:  <path and line count>
  References:  <conditional files or none>
  Scripts:     <files or none>
  Verification:<checks and results>
```

Offer evaluation with the available skill creator after generation; do not pretend scaffolding
proves routing or behavioral quality.

Never commit, push, rebase, overwrite an existing skill without explicit authorization, copy
persona prose into the skill, create external workflow dependencies, or add a reference solely
to reduce the entrypoint's line count.
