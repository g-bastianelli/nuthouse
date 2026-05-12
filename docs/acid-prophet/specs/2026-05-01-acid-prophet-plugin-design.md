# acid-prophet — Design Spec

**Date** : 2026-05-01  
**Plugin** : `acid-prophet`  
**Tagline** : *the genius who trips until the spec writes itself*  
**Status** : approved

---

## Problem

`linear-devotee:create-project` jumps straight into Linear mutations with minimal upfront structure. There's no enforced spec phase, no structured Q&A, no milestone planning before the first API call. The result: Linear projects created from vague ideas, large monolithic issues, hard-to-parallelize dev work.

What's missing is a dedicated thinking phase — structured dialogue that extracts requirements, proposes approaches, and produces a validated spec before anything touches Linear.

---

## Solution

A new plugin `acid-prophet` with a single skill `trip`. It owns the thinking pipeline only:

```
Q&A cosmique → spec validé → handoff Linear (optionnel)
```

Persona: a halluciné genius who asks seemingly cosmic questions but extracts exactly what's needed, then outputs a surgically clean spec. Chaotic voice, disciplined output.

**Separation of concerns:**
- `acid-prophet` : thinking and spec writing — nothing else
- `linear-devotee` : SDD decomposition, milestones, issues, all Linear mutations (invoked at handoff)

---

## Architecture

### Plugin structure

```
acid-prophet/
├── persona.md                    # canonical voice (single source of truth)
├── README.md                     # banner + install instructions
├── claudecode/
│   └── skills/
│       └── trip/
│           └── SKILL.md          # the only skill
└── .claude-plugin/
    └── manifest.json             # plugin declaration
```

**No hooks** — SessionStart and UserPromptSubmit hooks are not used. `acid-prophet` is on-demand only.

**No dedicated subagent** in V1 — the skill runs inline. If codebase exploration becomes heavy, it dispatches via `Agent` tool inline, but no subagent is declared in the manifest.

### Spec output location (at runtime)

```
docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md
```

---

## Skill: `trip`

### Invocation

```
/acid-prophet:trip
```

### Checklist (strict order, hard gates enforced)

1. **Explorer le contexte** — git log, existing files, any prior specs in `docs/`
2. **Questions cosmiques** — one at a time, multiple-choice preferred, halluciné style
   - If scope is too large: flag immediately, propose decomposition into sub-projects
   - Each sub-project gets its own `trip` cycle
3. **Proposer 2-3 approches** — with trade-offs and recommendation
4. **Présenter le spec par sections** — approval after each section
5. **Écrire le spec** → `docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md` + git commit
6. **Auto-révision** — scan for placeholders, internal contradictions, scope creep, ambiguities — fix inline
7. **Gate utilisateur spec** — ask user to review the written spec before proceeding
8. **Handoff** — "on pousse dans Linear ?" → if yes: invoke `linear-devotee:create-project` passing the spec file path. If no: clean stop, spec remains in `docs/`.

**Hard gate:**
- No Linear invocation before spec is approved by the user

### Process detail

**Questions cosmiques:** The persona asks questions that feel philosophical but extract concrete requirements. "Mais *pourquoi* cet écran existe ?" is not navel-gazing — it's requirements elicitation. The voice is halluciné, the intent is surgical.

**Spec sections:** Scaled to complexity. A simple feature: a few sentences per section. A platform rewrite: up to 200-300 words per section. Sections covered: architecture, components, data flow, error handling, testing approach.

**Handoff to linear-devotee:** The spec file path is passed to `linear-devotee:create-project` in file mode. The oracle (linear-devotee's subagent) reads the spec and handles SDD decomposition, milestone planning, and issue creation. `acid-prophet` does not decompose issues, does not call Linear MCP tools — ever.

---

## Persona (`acid-prophet/persona.md`)

**Name** : acid-prophet  
**Tagline** : *the genius who trips until the spec writes itself*  
**Emoji** : 🔮

Voice: fragmented poetic insight + brutal precision. Questions seem cosmic, outputs are surgical. The chaos is the style, not the deliverable.

**Vocabulary cues:**

*Opening:*
- "🔮 prophecy: awake. où est l'idée."
- "les fréquences s'alignent. parle-moi."

*Discovery / questions:*
- "attends. *pourquoi* cet écran existe ?"
- "🔮 pattern détecté — mais qui est l'utilisateur *vraiment* ?"
- "le vrai problème est… plus profond. creusons."

*Insights:*
- "PROPHECY — ces deux features sont la même feature."
- "🔮 ça se découpe. naturellement. je le vois."

*Handoff:*
- "le trip est fini. le spec existe. on pousse dans Linear ?"
- "prophecy complete. architecture locked. 🔮"

**Hard rule:** halluciné voice, surgical work. No fake cosmic side-effects. No joke commits. No "lol whoops". The banner is the energy, not the deliverable.

---

## Non-goals (V1)

- No visual companion (browser mockups) — text-only Q&A
- No hooks (SessionStart / UserPromptSubmit)
- No dedicated subagent declared in manifest
- No direct Linear MCP calls — always delegated to `linear-devotee`
- No support for non-Claude Code runtimes (Codex, Copilot) in V1

---

## Constraints

- ESM `.mjs` for any hooks/scripts (none in V1, but future additions must follow this)
- No npm/bun deps — node builtins only
- Pre-commit: `lefthook` + `bunx biome check .` — never bypass with `--no-verify`
- Plugin name, persona voice, and skill name must be consistent across all files

---

## Testing

- No Node helpers in V1 → no `bun test` suite needed at scaffold time
- If future hooks or scripts are added: tests go in `acid-prophet/claudecode/tests/`
- Manual verification: invoke `/acid-prophet:trip`, run through a full cycle, verify spec output format and SDD decomposition quality

---

## Open questions

None — all fields resolved during brainstorming session.
