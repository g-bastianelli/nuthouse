---
name: audit
description: Scan all skills, agents, and personas in this nuthouse repo against the _templates/ source of truth. Reports missing ## Voice, ## Language, broken persona paths, and invalid frontmatter. Run after any convention change to catch drift.
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

Audits every plugin's SKILL.md, AGENT.md, and persona.md files against
the `_templates/` source of truth. No auto-fix — reports deviations, the
human decides what to do.

## Step 1 — Preconditions

Verify `_templates/` exists and contains the required templates:

```bash
test -f _templates/skill/claudecode/SKILL.md && \
test -f _templates/agent/AGENT.md && \
test -f _templates/persona/persona.md && \
echo "templates ok" || echo "ERROR: _templates/ missing or incomplete"
```

If templates are missing, abort with: *"les formules manquent. `_templates/` est absent ou incomplet."*

## Step 2 — Load template requirements

Read the `<!-- template-meta -->` block from each template:

- `_templates/skill/claudecode/SKILL.md` → for all SKILL.md files
- `_templates/agent/AGENT.md` → for all AGENT.md files
- `_templates/persona/persona.md` → for all persona.md files

Requirements extracted:
- **SKILL.md:** required_frontmatter `[name, description]`, required_sections `["## Voice", "## Language"]`
- **AGENT.md:** required_frontmatter `[name, description]`, required_sections `[]`
- **persona.md:** required_frontmatter `[name, tagline]`, required_sections `["## Language", "## Hard rule"]`

## Step 3 — Discover all artefacts

```bash
# Plugins
ls */persona.md 2>/dev/null | cut -d/ -f1

# Skills (Claude Code)
ls */claudecode/skills/*/SKILL.md 2>/dev/null

# Agents
ls */claudecode/agents/*.md 2>/dev/null

# Personas
ls */persona.md 2>/dev/null
```

## Step 4 — Check each file

For each file, check against the matching template's requirements.

**SKILL.md checks (in order):**
1. Frontmatter contains `name` field — ❌ CRITIQUE if missing
2. Frontmatter contains `description` field — ❌ CRITIQUE if missing
3. `## Voice` section present — ❌ CRITIQUE if missing
4. `## Voice` body contains a path ending in `persona.md` — ❌ CRITIQUE if missing
5. That `persona.md` path resolves to an existing file — ❌ CRITIQUE if broken
6. `## Voice` body contains `**Scope:**` line — ⚠️ WARNING if missing
7. `## Language` section present — ❌ CRITIQUE if missing

**AGENT.md checks:**
1. Frontmatter contains `name` field — ❌ CRITIQUE if missing
2. Frontmatter contains `description` field — ❌ CRITIQUE if missing

**persona.md checks:**
1. Frontmatter contains `name` field — ❌ CRITIQUE if missing
2. Frontmatter contains `tagline` field — ⚠️ WARNING if missing
3. `## Language` section present — ❌ CRITIQUE if missing
4. `## Hard rule` section present — ❌ CRITIQUE if missing

## Step 5 — Report

Output format:

```
## audit — nuthouse

### <plugin-name>
  ✅ claudecode/skills/<skill>/SKILL.md
  ❌ claudecode/skills/<skill>/SKILL.md — missing ## Language [CRITIQUE]
  ⚠️  persona.md — missing tagline in frontmatter [WARNING]

### <plugin-name>
  ✅ claudecode/agents/<agent>.md
  ✅ persona.md

---
<N> critiques · <N> warnings · <N> ok
```

If zero critiques and zero warnings: *"le labo est propre. toutes les créatures sont conformes. 🧪"*
