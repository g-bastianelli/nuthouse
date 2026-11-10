---
name: scaffold-skill
description: Scaffold a focused plugin skill or repository workflow. Use when adding a skill; creates one canonical source from repository templates and validates progressive disclosure.
model: haiku
---

# scaffold-skill

Read `../persona.md`; it is canonical for this skill's user-facing output until the report. Match
the user's language and keep technical identifiers unchanged.

Create one canonical skill. Plugin skills live in `<plugin>/skills/`; repository workflows live
in `.agents/skills/`, with a matching `.claude/skills/` symlink.

## Workflow

1. Verify the repository root through both marketplace registries. Resolve the destination from
   the request: `plugin` or `repository`. For a plugin skill, discover parent plugins from root
   `persona.md` files and require the selected parent to have a matching runtime manifest.
2. Resolve only consequential inputs not already supplied:
   - parent plugin when applicable, and kebab-case action-oriented name without plugin prefix;
   - what the skill does and when it activates;
   - workflow or background contract;
   - supported runtime intersection with the parent; repository workflows target both runtimes;
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
   - choose instructions or executable resources according to the need for judgment,
     repeatability, and reuse; consider existing tools before introducing code.
7. Preserve root conventions: unprefixed frontmatter `name`, `genre: contract` for background
   contracts, and no runtime-specific copies. User-facing plugin skills read `../../persona.md`.
   Repository workflows read `../persona.md`; create `.claude/skills/<skill>` as a relative
   symlink to `../../.agents/skills/<skill>`, without editing either marketplace or a plugin
   manifest. Check both paths for collisions and verify the symlink resolves to the source.
8. Run `bun run check:skills`, `bun run test:meta`, and relevant plugin or repository-helper
   tests. Fix generated structural failures before reporting; disclose unavailable checks.

## Report

```text
scaffold-skill
  Scope:       plugin | repository
  Skill:       <plugin>:<skill> | <skill>
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
