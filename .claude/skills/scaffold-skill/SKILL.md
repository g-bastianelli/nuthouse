---
name: scaffold-skill
description: Use when adding a new skill to an existing plugin in this `nuthouse` marketplace (saucy-status, react-monkey, linear-devotee, or any plugin with a `persona.md` at its root). Asks for parent plugin, skill name (action verb, no prefix), description, target runtimes (intersected with parent's runtimes), whether the skill dispatches a subagent, whether it ends with a hand-off menu. Generates one canonical root `skills/<skill>/SKILL.md` with unprefixed frontmatter `name: <skill>`, plus a `## Voice` section pointing to the parent's persona.md, and the standard workflow/final-report/rules skeleton. Embeds all naming and structural conventions from the legacy CLAUDE.md.
model: haiku
---

# scaffold-skill

## Voice

Read `../persona.md` at the start of this skill. The voice defined there
(mad-scientist) is canonical and applies to all output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed, revert to the session's default voice.

This skill is **rigid** — execute the steps in order.

## When you're invoked

The user wants to add a new skill to an existing plugin. Either via
`/scaffold-skill` directly, or via "let's add a skill to react-monkey
called X".

## Step 0 — Preconditions

1. **Inside the `nuthouse` repo.** Verify cwd contains
   `.claude-plugin/marketplace.json`. If not, abort:
   > "ce labo n'est pas le bon. j'ai besoin de la racine de
   > `nuthouse`."
2. **Discover existing plugins.** Glob `<repo>/*/persona.md` (Bash:
   `ls */persona.md 2>/dev/null`). The list of folders is the candidate
   parent-plugin set. If empty, abort with: *"aucun plugin n'existe
   encore. fais d'abord `scaffold-plugin`."*

## Step 1 — Interview

### Q1 — Parent plugin

AskUserQuestion, single-select. Options = the plugins discovered at
Step 0. Voice: *"dans quelle créature on greffe ce nouvel organe ?"*

### Q2 — Skill name (no prefix)

Free-text. Voice: *"comment s'appelle l'organe ?"*

**Validation rules**:
- **Action verb or gerund that describes the function**: `implement`, `plan`, `write-spec`, `audit-spec`, `check-drift`, `create-issue`. ✅
- **No generic role names**: `coder`, `helper`, `utils`, `tool`. ❌
- **No persona-coded names**: `trip`, `scry`, `prophecy`, `vision`, `revelation`. ❌ The skill name must be self-explanatory without knowing the plugin's persona vocabulary. Panic-correct: *"non non non, `trip` ne dit rien à quelqu'un qui voit le skill pour la première fois. quel **acte** ? `write-spec`, `audit`, `check-drift` — un verbe fonctionnel."*
- **No plugin prefix in the name itself.** The user types `write-spec`, not `acid-prophet:write-spec`. The runtime exposes the installed skill as `<plugin>:<skill>`.
- Kebab-case, lowercase.
- Must not collide with an existing skill in the parent plugin (check `ls <plugin>/skills/<skill>/`).

### Q3 — Description

Free-text. Voice: *"décris cet organe en une phrase. quand est-ce qu'il
s'active ?"*

**Format reminder**: start with `Use when …` — that's how Claude routes
to the skill.

### Q4 — Target runtimes

Detect the parent plugin's available runtimes (presence of `claudecode/`
and/or root `.codex-plugin/` manifest). Then AskUserQuestion (single-select if parent
is single-runtime, otherwise offer the intersection):
- `claudecode` — Claude Code only
- `codex` — Codex only (only if parent has `.codex-plugin/`)
- `both` — Both (only if parent has both)

### Q5 — Subagent dispatch?

AskUserQuestion, single-select:
- `no` (Recommended for first skill)
- `yes — dedicated agent`: the skill calls `Agent(subagent_type: '<plugin>:<agent>')`. We seed a placeholder reference in the SKILL.md and remind the user to run `/scaffold-agent` afterwards.
- `yes — generic general-purpose agent`: one-shot dispatch with prompt embedded inline (only for very contextual cases — anti-pattern flagged in CLAUDE.md when it's reused).

### Q6 — Hand-off menu at the end?

AskUserQuestion, single-select:
- `no` — skill exits after final report (Recommended)
- `yes` — present a menu like `linear-devotee:greet` does (`(p)`, `(q)`,
  `(c)`, `(s)`). If yes, ask follow-up: comma-separated `letter:label`
  list (e.g. `p:plan, q:questions, c:code now, s:stop`).

### Q7 — Model

AskUserQuestion, single-select. Voice: *"quel modèle pour ce skill ?"*
- `inherit` (Recommended — orchestration normale, suit le modèle de session, omet `model:` du frontmatter)
- `haiku` (toggle, dispatch trivial, parsing direct — pas de décisions complexes)
- `sonnet` (audit / drafting structuré — raisonnement modéré, ratio coût/qualité)
- `opus` (création SDD libre, spec stratégique, planning critique — top-tier reasoning, low-volume)

[IF Q7 = haiku] Emit a voice warning: *"haiku sur un skill ? ok si c'est vraiment léger — pas de décisions, pas de mutations complexes. sinon remonte sur sonnet/inherit."*

[IF Q7 = opus] Emit a voice warning: *"opus = cher. justifié pour création de spec / projet / décisions structurantes. sinon inherit suffit."*

### Q8 — Effort

AskUserQuestion, single-select. Voice: *"quel budget de reasoning ?"*
- `high` (Recommended for orchestration — multi-step, approval gates, mutations)
- `low` (fetch simple, rapport direct, aucune décision — ignoré silencieusement sur haiku)
- `xhigh` (raisonnement profond, planning critique, plan d'architecture)
- `max` (création SDD / décisions structurantes — risque d'overthink, low-volume only)
- `inherit` (laisser le runtime décider — omet `effort:` du frontmatter)

[IF Q8 = max] Emit a voice warning: *"max = budget de pensée illimité. la doc Claude prévient : peut overthink. teste avant de généraliser."*

[IF Q7 = haiku AND Q8 ≠ inherit AND Q8 ≠ low] Emit: *"effort sur haiku = ignoré silencieusement. force `inherit` ou `low` pour rester clean."*

### Q9 — Project-level artifact?

AskUserQuestion, single-select. Voice: *"l'organe écrit-il quelque chose dans le repo de l'utilisateur ?"*
- `no` (Recommended for skills that only report) — skip Q10
- `yes — single-file artifact` — skill writes one Markdown/JSON file per invocation

[IF Q9 = yes] Follow-up free-text: *"slug du dossier — kebab-case, ex. `plan`, `spec`, `brief`, `doc` :"* → save as `ARTIFACT_TYPE`. The artifact will live at `${PROJECT_ROOT}/docs/<PLUGIN>/<ARTIFACT_TYPE>/<identifier>.md`. Plugin install storage (`${CLAUDE_PLUGIN_ROOT}/data/`) is for ephemeral state only, NEVER for user-facing artifacts.

### Q10 — AI-agent plan format inside the artifact?

[Only ask if Q9 = yes] AskUserQuestion, single-select. Voice: *"l'artifact est un plan d'implémentation pour un agent IA qui va l'exécuter ?"*
- `no` (Recommended) — free-form artifact shape
- `yes` — embed the research-backed 6-section template (Context / Files / Steps `- [ ]` / Verify / Risks / Out of scope) inside the artifact body

### Q11 — Auto-chain to a downstream skill?

AskUserQuestion, single-select. Voice: *"l'organe transmet directement à un autre, sans demander confirmation ?"*
- `no` (Recommended)
- `yes — print invocation, continue immediately`: only valid if the downstream skill has its own validation gate (e.g. `Validate this plan? (y / edit / stop)`). The user gates only there.

[IF Q11 = yes] Follow-up free-text: *"nom du skill aval (ex. `<PLUGIN>:plan`) :"* → save as `DOWNSTREAM_SKILL`.

### Q12 — Plugin uses warden:voice for decorative persona lines?

Auto-detect first: check whether `<PLUGIN>/shared/persona-line-contract.md` exists. If it does, the plugin is warden-voice-ready — propose `yes` automatically.

Otherwise AskUserQuestion, single-select. Voice: *"le plugin a-t-il un `shared/persona-line-contract.md` pour les lignes décoratives ?"*
- `no` (Recommended for first skills) — skill stays neutral, no persona dispatch
- `yes` — the skill dispatches `warden:voice` at visible transitions using the plugin's persona-line contract

[IF Q12 = yes] The skill itself stays voice-neutral; it only dispatches `warden:voice` at visible transitions. The PERSONA_CONTRACT_PATH always points to `${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`. The skill never carries persona content beyond this dispatch. If `warden` is not installed, the dispatch fails silently — this is expected behavior.

## Step 2 — Generation

Write one canonical root SKILL.md. Runtime selection controls which manifest exposes it; it does not create duplicate skill files.

**Template source:** Before generating any SKILL.md, read the root skill template:
- Root skill runtime → `_templates/skill/codex/SKILL.md`

This is the source of truth for file structure. Substitute these variables from interview answers:
- `{{plugin}}` → parent plugin name
- `{{skill}}` → skill name (action verb)
- `{{description}}` → one-line description from interview
- `{{persona_path}}` → relative path from skill dir to plugin's persona.md
  (`../../persona.md` for `<plugin>/skills/<skill>/SKILL.md`)

Use the template as the structural baseline: substitute `{{variables}}` and fill
`[bracketed]` creative sections with AI-generated content appropriate to the
plugin's voice. The sections defined below extend the template with plugin-specific
conventions — do not omit them.

### 2a. Root skill — `<PLUGIN>/skills/<SKILL>/SKILL.md`

**Frontmatter** (root canonical skill = no prefix in `name`):
```yaml
---
name: <SKILL>
description: <DESCRIPTION>
model: <Q7-value>    # [IF Q7 ∈ {haiku, sonnet, opus}, else omit this line]
effort: <Q8-value>    # [IF Q8 ∈ {low, high, xhigh, max}, else omit this line]
---
```

**Body skeleton** — generate:

```markdown
# <SKILL>

Rigid [gate type]. Match the user's language; keep technical identifiers unchanged.

[IF Q12 = yes — warden voice]
> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.
[/ENDIF]

## Workflow

1. Preconditions:
   - <TODO: list what must be true before this skill runs. Examples: MCP tools loaded, git repo verified, state file readable.>
2. <Step name>:
   - <TODO: ordered actions. Use Bash / Read / MCP tools as needed. Keep bullets tight.>
3. <Step name>:
   - <TODO>
N. <Final action — handoff, report, or stop>:
   - <TODO>

[IF hand-off menu]
Present numbered options after the final action:
\`\`\`
<voice intro line>
  (<L1>) <label 1> → <what happens>
  (<L2>) <label 2> → <what happens>
  (s) stop → <exit message>
\`\`\`
Branch on response. Exit skill when chosen branch finishes.
[/ENDIF]

## Final Report

\`\`\`text
<PLUGIN>:<SKILL> report
  <Field>:        <value>
  <Field>:        <value>
\`\`\`

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Mutate external services without explicit user confirmation.
- Skip the preconditions step.
- <TODO: skill-specific don'ts>
```

[IF Q5 = "dedicated agent"] After the body, append a `## Subagent
dispatch` section with a placeholder explaining the agent will be
created next via `/scaffold-agent` and the dispatch shape:

```markdown
## Subagent dispatch (Step <N>)

This skill dispatches the `<PLUGIN>:<AGENT-NAME>` subagent. Run
`/scaffold-agent` to scaffold it under `<PLUGIN>/agents/`.

\`\`\`
Agent({
  subagent_type: '<PLUGIN>:<AGENT-NAME>',
  description: '<short>',
  prompt: '<structured input — see the agent’s ## Input section>',
})
\`\`\`
```

[/ENDIF]

### 2a-bis. Conditional snippets to inject

After substituting variables and filling `[bracketed]` sections in the generated SKILL.md, inject the following snippets **only when the corresponding interview answer enables them**. These snippets are kept here (not in the template file) so the template stays lean and unconditional.

**[IF Q12 = yes — warden voice]** — insert as the callout block before `## Workflow`:

```markdown
> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.
```

**[IF Q9 = yes — project-level artifact]** — append to `## Step 0 — Preconditions`:

```markdown
2. Capture `PROJECT_ROOT = $(git rev-parse --show-toplevel)`. Abort if not in a git repo.
3. Ensure `${PROJECT_ROOT}/docs/<PLUGIN>/<ARTIFACT_TYPE>/`.
```

And inside `## Step 1 — [First step name]` (or whichever step writes the artifact), document:

```markdown
Write the artifact at `${PROJECT_ROOT}/docs/<PLUGIN>/<ARTIFACT_TYPE>/<identifier>.md`.
```

And in the `## Final report` section, ensure the report carries the absolute path on its own line:

```markdown
  <ARTIFACT_TYPE> artifact:   ${PROJECT_ROOT}/docs/<PLUGIN>/<ARTIFACT_TYPE>/<identifier>.md
```

(Cmd-clickable in modern terminals — no Markdown link syntax needed.)

**[IF Q10 = yes — AI-agent plan format]** — embed inside the artifact write step:

```markdown
The artifact body uses the AI-agent-optimized 6-section template:

\`\`\`markdown
---
issue: <id>
spec: <spec-path | _none_>
status: draft
plan-version: 1
validated-at: _none_
spec-synced-at: _none_
---

# Plan — <title> (<id>)

## Context

## Files

## Steps

## Verify

## Risks

## Out of scope
\`\`\`

Section semantics:
- **Context** — 1–3 sentences linking the issue + source spec.
- **Files** — bulleted paths + one-line role each.
- **Steps** — atomic `- [ ]` checkboxes; each step is one edit + an inline verify command when possible.
- **Verify** — project-level commands (test / lint / typecheck) run after all Steps.
- **Risks** — uncertainty surfaced for the auditor.
- **Out of scope** — negative oracle preventing implementing-agent drift.
```

**[IF Q11 = yes — auto-chain]** — in the skill's handoff step:

```markdown
Auto-chain to `<DOWNSTREAM_SKILL>`. Print `<DOWNSTREAM_SKILL> <args>` and continue immediately — do not ask the user for confirmation. The user's only validation point is the downstream skill's own `Validate? (y / edit / stop)` gate. On error paths, stop instead of chaining and report the reason.
```

Use `${CLAUDE_PLUGIN_ROOT}` for Claude Code-visible voice dispatch, as existing root nuthouse skills do. Artifact paths use `${PROJECT_ROOT}/docs/<PLUGIN>/<ARTIFACT_TYPE>/` — same convention for all runtimes.

Before writing, read an existing root skill such as `react-monkey/skills/implement/SKILL.md` and copy the relative persona path convention (`../../persona.md`).

## Step 3 — Final report

```
<voice intro: e.g. "l'organe est greffé. il bat. 🧪">

scaffold-skill report
  Plugin:        <PLUGIN>
  Skill:         <PLUGIN>:<SKILL> exposed, `name: <SKILL>` in frontmatter
  Voice:         ../../persona.md
  Model:         <haiku | sonnet | opus | inherit>
  Effort:        <low | medium | high | xhigh | max | inherit>
  Subagent:      <none | <agent-name> — run `/scaffold-agent` next>
  Hand-off:      <none | menu defined>
  Files written: <list>
  Next step:     fill the TODO sections in the new SKILL.md, then test the skill in a fresh session
```

End with a voice exit line.

## Hard rules

1. **Never `git commit` / `git push` / `git rebase`.** User commits manually.
2. **Always preserve the root naming rule**: SKILL.md frontmatter uses `name: <skill>` with no plugin prefix. The runtime exposes it as `<plugin>:<skill>`.
3. **Skill body uses the root nuthouse format**: `## Voice`, `## Language`, workflow steps, final report, and hard rules, matching existing root skills such as `react-monkey/skills/implement/SKILL.md`. If Q12 = yes, inject only the one-liner voice-dispatch callout above `## Voice`.
4. **Never invent the persona.** The persona lives in `<plugin>/persona.md`. The skill does not declare or redeclare voice inline.
5. **Generic agent name reject**: if Q5 = "dedicated agent" and the user
   wants to call it `agent` or `helper`, push back: *"non non non,
   l'agent a un **rôle** précis. nomme-le par sa fonction —
   `scout`, `validator`, `parser` — pas un nom vide."*
6. **Voice agent name is the one exception**: the plugin's voice-line agent (the one that emits persona lines via `persona-line-contract.md`) MAY have a persona-coded name (`devotee`, `prophet`, etc.). All other dedicated subagents MUST have functional names only.
7. **Never overwrite** an existing SKILL.md without explicit user
   confirmation. Read first; if it exists, abort or ask.
8. **Root skill verification**: read an existing root SKILL.md
   before generating one — don't trust memory for the relative paths or
   header conventions.
9. **No external workflow/tool dependency** in the generated SKILL.md.

## Anti-patterns to detect and refuse

- ❌ `name: <plugin>:implement` in any root skill → must be `implement` (no prefix).
- ❌ Duplicate runtime variants under `claudecode/skills` or `codex/skills` → root `skills/` is canonical.
- ❌ Skill name like `helper`, `tool`, `coder`. Push back.
- ❌ Plugin/skill duplicate (e.g. `react-coder:react-coder`).
- ❌ Persona content copied into the skill body → read `../../persona.md` instead.
- ❌ Runtime-specific skill file copies → one root SKILL.md only.
- ❌ Persona/role name on a non-voice subagent (e.g. `oracle`, `seer`, `spirit`) → must be functional.

## Voice cheat sheet

From `../persona.md` (mad-scientist):
- "non non non" — when the user proposes a generic name
- "tiens-moi le frontmatter, on l'incise" — start of generation
- "l'organe est greffé. il bat. 🧪" — successful final report
- "le scope de la voix est CLAIR. on revient au défaut après. clair ?"
- 🧪 — rare, only for skill-just-born moments

Actions stay serious. Voice stays mad.
