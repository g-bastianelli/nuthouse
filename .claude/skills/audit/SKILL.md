---
name: audit
description: Scan all skills, agents, personas, and banner prompts in this nuthouse repo against the _templates/ source of truth. Reports missing ## Workflow / ## Never, old-format ## Voice / ## Language artifacts, missing agent tools allowlist, persona-coded non-voice agent names, invalid frontmatter, and BANNER_PROMPT.md convention drift. Run after any convention change to catch drift.
effort: high
---

# audit

## Voice

Read `../persona.md` at the start of this skill. That persona is
canonical for all output of this skill.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## What this skill does

Audits every plugin's SKILL.md, AGENT.md, persona.md, README banner reference,
`assets/banner.png`, and `assets/BANNER_PROMPT.md` against the `_templates/`
source of truth.
No auto-fix — reports deviations, the human decides what to do.

`react-monkey` is the existing visual reference banner. Audit it like every
other plugin; its image is the style target, not a rules exception.

## Step 1 — Preconditions

Verify `_templates/` exists and contains the required templates:

```bash
test -f _templates/skill/claudecode/SKILL.md && \
test -f _templates/agent/AGENT.md && \
test -f _templates/persona/persona.md && \
test -f _templates/plugin/BANNER_PROMPT.md && \
echo "templates ok" || echo "ERROR: _templates/ missing or incomplete"
```

If templates are missing, abort with: _"les formules manquent. `_templates/` est absent ou incomplet."_

## Step 2 — Load template requirements

Read the `<!-- template-meta -->` block from each template:

- `_templates/skill/claudecode/SKILL.md` → for all SKILL.md files
- `_templates/agent/AGENT.md` → for all AGENT.md files
- `_templates/persona/persona.md` → for all persona.md files
- `_templates/plugin/BANNER_PROMPT.md` → for all plugin banner prompts

Requirements extracted:

- **SKILL.md:** required_frontmatter `[name, description]`, required_sections `["## Workflow", "## Never"]`
- **AGENT.md:** required_frontmatter `[name, description]`, required_sections `[]`
- **persona.md:** required_frontmatter `[name, tagline]`, required_sections `["## Language", "## Hard rule"]`
- **BANNER_PROMPT.md:** required guidance: README banner, visible mascot/persona, existing nuthouse style, setting from persona world, functional props secondary, user-centered personas keep the user offscreen/implied/abstract, 3:1 target, no readable text unless exact English text is requested, final asset path `assets/banner.png`
- **Banner assets:** `<plugin>/assets/banner.png` must exist when the plugin README references it; no stale `banner.jpeg`, `banner-old.png`, `banner-love.png`, or other archive banner files should remain.

## Step 3 — Discover all artefacts

```bash
# Plugins
ls */persona.md 2>/dev/null | cut -d/ -f1

# Skills
ls */skills/*/SKILL.md 2>/dev/null

# Agents
ls */agents/*.md 2>/dev/null

# Personas
ls */persona.md 2>/dev/null

# Banner prompts
ls */assets/BANNER_PROMPT.md 2>/dev/null

# Banner assets
ls */assets/banner.png 2>/dev/null
ls */banner.jpeg */banner.jpg */assets/banner-old.* */assets/banner-love.* 2>/dev/null
```

## Step 4 — Check each file

For each file, check against the matching template's requirements.

**SKILL.md checks (in order):**

1. Frontmatter contains `name` field — ❌ CRITIQUE if missing
2. Frontmatter contains `description` field — ❌ CRITIQUE if missing
3. `## Workflow` section present — ❌ CRITIQUE if missing (new format)
4. `## Never` section present — ❌ CRITIQUE if missing (new format)
5. `## Voice` section present WITHOUT `## Workflow` — ⚠️ WARNING: old format, migrate to compact `## Workflow` + `## Never`
6. `## Language` section present WITHOUT `## Workflow` — ⚠️ WARNING: old format artifact, migrate to intro-line pattern

**AGENT.md checks:**

1. Frontmatter contains `name` field — ❌ CRITIQUE if missing
2. Frontmatter contains `description` field — ❌ CRITIQUE if missing
3. Frontmatter contains `tools:` block (non-empty list) — ❌ CRITIQUE if missing or empty (every agent must have an explicit allowlist)
4. Agent `name` matches a persona/role word (`seer`, `oracle`, `acolyte`, `spirit`, `muse`, `ghost`, `herald`, etc.) AND the agent body does NOT reference `shared/persona-line-contract.md` — ⚠️ WARNING: persona-coded name on a non-voice agent; rename to a functional role

**persona.md checks:**

1. Frontmatter contains `name` field — ❌ CRITIQUE if missing
2. Frontmatter contains `tagline` field — ⚠️ WARNING if missing
3. `## Language` section present — ❌ CRITIQUE if missing
4. `## Hard rule` section present — ❌ CRITIQUE if missing

**BANNER_PROMPT.md checks (per plugin):**

1. `<plugin>/assets/BANNER_PROMPT.md` exists — ⚠️ WARNING if missing
2. Contains guidance that the mascot/persona is visible — ❌ CRITIQUE if missing
3. Contains guidance to match the existing nuthouse banner style — ❌ CRITIQUE if missing
4. Contains guidance that the setting comes from the persona's world — ❌ CRITIQUE if missing
5. Contains guidance that task/domain props are secondary — ⚠️ WARNING if missing
6. Contains guidance for user-centered personas: user offscreen/implied/abstract, no competing deity/boss/mascot — ❌ CRITIQUE if missing
7. Contains the 3:1 README banner target — ❌ CRITIQUE if missing
8. Contains no-readable-text guidance unless exact English text is requested — ❌ CRITIQUE if missing
9. Contains final-path guidance for `assets/banner.png` — ⚠️ WARNING if missing

**Banner asset checks (per plugin):**

1. If README references `./assets/banner.png`, `<plugin>/assets/banner.png` exists — ❌ CRITIQUE if missing
2. If `<plugin>/assets/banner.png` exists, README references it — ⚠️ WARNING if missing
3. No stale root banner image such as `<plugin>/banner.jpeg` or `<plugin>/banner.jpg` — ⚠️ WARNING if present
4. No archive banner image such as `assets/banner-old.*` or `assets/banner-love.*` — ⚠️ WARNING if present

## Step 5 — Report

Output format:

```
## audit — nuthouse

### <plugin-name>
  ✅ skills/<skill>/SKILL.md
  ❌ skills/<skill>/SKILL.md — missing ## Language [CRITIQUE]
  ⚠️  persona.md — missing tagline in frontmatter [WARNING]
  ⚠️  assets/BANNER_PROMPT.md — absent [WARNING]
  ❌ assets/BANNER_PROMPT.md — missing persona-world setting rule [CRITIQUE]
  ❌ assets/banner.png — README references missing banner [CRITIQUE]
  ⚠️  banner.jpeg — stale banner image [WARNING]

### <plugin-name>
  ✅ agents/<agent>.md
  ✅ persona.md
  ✅ assets/BANNER_PROMPT.md
  ✅ assets/banner.png

---
<N> critiques · <N> warnings · <N> ok
```

If zero critiques and zero warnings: _"le labo est propre. toutes les créatures sont conformes. 🧪"_
