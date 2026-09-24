# Audit review criteria

Use these checks after the mechanical gates. A criterion applies only to its artifact type.

## Skills

- Frontmatter names what the skill does and when it should activate. The root `name` has no
  plugin prefix.
- A workflow keeps its shared outcome, ordered decisions, authorization boundaries, stopping
  conditions, verification, and report shape in `SKILL.md`.
- A background contract declares `genre: contract`, contains no fake ordered workflow, and keeps
  only rules that change implementation decisions.
- Conditional procedures, provider-specific commands, large schemas, and extended examples live
  in directly routed `references/` files. Every route says when to read the file.
- A reference is not required merely to make a short skill look modular. Conversely, repeatedly
  loaded material belongs in `SKILL.md`, not behind an unconditional reference.
- Examples demonstrate output or implementation choices; they do not replace safety, permission,
  or correctness invariants.
- Mechanically enforceable repository rules point to a real command. Do not duplicate the
  checker's implementation in prose.
- User-facing skills read `../../persona.md`. Background contracts remain neutral.
- No runtime-specific duplicate skill tree exists under `claudecode/skills/` or `codex/skills/`.

## Agents

- Frontmatter has `name`, a routing-quality `description`, and a non-empty explicit `tools`
  allowlist.
- Names describe a functional role rather than plugin lore. Agent output stays neutral; the
  calling skill owns persona voice.
- Input and output contracts are explicit. Missing evidence remains `_unclear_`; a read-only
  agent has no write tools or mutation instructions.
- Shared cross-cutting contracts use `${CLAUDE_PLUGIN_ROOT}/shared/<name>.md`.

## Personas

- Frontmatter has `name` and `tagline`; the body defines `## Language` and `## Hard rule`.
- Voice affects wording only. It never changes permissions, verification, or failure behavior.

## Manifests and banners

- Claude and Codex manifests have matching versions when both exist, and both registries expose
  every cross-runtime plugin.
- A README reference to `./assets/banner.png` resolves to a real file and every banner asset is
  referenced by its README.
- `assets/BANNER_PROMPT.md` keeps the visible persona primary, derives the setting from its world,
  keeps functional props secondary, targets roughly 3:1, forbids accidental readable text, and
  writes the final asset to `assets/banner.png`.
- User-centered personas keep the user offscreen, implied, or abstract; they do not invent a
  competing deity, boss, or mascot.
- Stale root or archive banners are warnings.
