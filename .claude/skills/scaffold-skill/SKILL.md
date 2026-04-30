---
name: scaffold-skill
description: Use when adding a new skill to an existing plugin in this `skill-issue` marketplace (saucy-status, react-monkey, linear-devotee, or any plugin with a `persona.md` at its root). Asks for parent plugin, skill name (action verb, no prefix), description, target runtimes (intersected with parent's runtimes), whether the skill dispatches a subagent, whether it ends with a hand-off menu. Generates SKILL.md with the right frontmatter — `name: <plugin>:<skill>` for Claude Code, `name: <skill>` for Codex — plus a `## Voice` section pointing to the parent's persona.md, and the standard Step 0 / Steps / Rules / Final report skeleton. Embeds all naming and structural conventions from the legacy CLAUDE.md.
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

1. **Inside the `skill-issue` repo.** Verify cwd contains
   `.claude-plugin/marketplace.json`. If not, abort:
   > "ce labo n'est pas le bon. j'ai besoin de la racine de
   > `skill-issue`."
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
- **Action verb or gerund**: `implement`, `greet`, `explore`,
  `writing-plans`, `systematic-debugging`. ✅
- **No generic role names**: `coder`, `helper`, `utils`, `tool`. ❌
  Panic-correct: *"non non non, `coder` ne dit rien. quel **acte**
  effectue ce skill ? `implement`, `review`, `refactor` — un verbe."*
- **No plugin prefix in the name itself.** The user types `implement`,
  not `react-monkey:implement`. The prefix is added at write-time for
  the Claude Code variant.
- Kebab-case, lowercase.
- Must not collide with an existing skill in the parent plugin (check
  `ls <plugin>/claudecode/skills/<skill>/` and `ls <plugin>/codex/skills/<skill>/`).

### Q3 — Description

Free-text. Voice: *"décris cet organe en une phrase. quand est-ce qu'il
s'active ?"*

**Format reminder**: start with `Use when …` — that's how Claude routes
to the skill.

### Q4 — Target runtimes

Detect the parent plugin's available runtimes (presence of `claudecode/`
and/or `codex/` folders). Then AskUserQuestion (single-select if parent
is single-runtime, otherwise offer the intersection):
- `claudecode` — Claude Code only
- `codex` — Codex only (only if parent has `codex/`)
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

## Step 2 — Generation

For each selected runtime, write the corresponding SKILL.md.

### 2a. Claude Code — `<PLUGIN>/claudecode/skills/<SKILL>/SKILL.md`

**Frontmatter** (Claude Code = full prefix in `name`):
```yaml
---
name: <PLUGIN>:<SKILL>
description: <DESCRIPTION>
---
```

**Body skeleton** — generate:

```markdown
# <PLUGIN>:<SKILL>

## Voice

Read `../../../persona.md` at the start of this skill. The voice
defined there is canonical for the `<PLUGIN>` plugin and applies to all
output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed (or hand-off menu returns control to the user), revert to the
session's default voice.

This skill is **rigid** — execute the steps in order, no shortcuts.

## When you're invoked

<TODO: 1–2 sentences explaining the trigger condition. Hook injection?
User keyword? Branch state? Be concrete.>

## Step 0 — Preconditions

<TODO: list the things that must be true before the skill runs.
Examples from existing skills: MCP tools loaded, in a git repo, state
file readable, parent plugin's data file exists.>

## Step 1 — <name the step>

<TODO: ordered actions. Use the Bash / Read / MCP tools as needed.>

## Step 2 — <name the step>

<TODO>

## Step N — Final action

<TODO>

## Final report (always print)

\`\`\`
<PLUGIN>:<SKILL> report
  <Field>:        <value>
  <Field>:        <value>
\`\`\`

Wrap with one short voice line before the report.

[IF hand-off menu]
## Hand-off menu

After the final report, present:

\`\`\`
<TODO: voice line introducing the choice>
  (<L1>) <label 1> → <what happens>
  (<L2>) <label 2> → <what happens>
\`\`\`

Branch on the response and act. Once the chosen branch finishes, exit
the skill — revert to session default voice.
[/ENDIF]

## Things you NEVER do

- Run `git push`, `git commit`, or `git rebase`
- Mutate external services without explicit user confirmation
- Skip Step 0 preconditions
- Re-trigger in the same session if the action is one-shot (use a state
  flag if applicable)
- <TODO: skill-specific don'ts>

## Voice cheat sheet

Use the palette from `../../../persona.md`. Specific applications in
this skill's strings (questions, error messages, reports) follow the
voice but stay short.
```

[IF Q5 = "dedicated agent"] After the body, append a `## Subagent
dispatch` section with a placeholder explaining the agent will be
created next via `/scaffold-agent` and the dispatch shape:

```markdown
## Subagent dispatch (Step <N>)

This skill dispatches the `<PLUGIN>:<AGENT-NAME>` subagent. Run
`/scaffold-agent` to scaffold it.

\`\`\`
Agent({
  subagent_type: '<PLUGIN>:<AGENT-NAME>',
  description: '<short>',
  prompt: '<structured input — see the agent’s ## Input section>',
})
\`\`\`
```

[/ENDIF]

### 2b. Codex — `<PLUGIN>/codex/skills/<SKILL>/SKILL.md`

**Frontmatter** (Codex = no prefix in `name`):
```yaml
---
name: <SKILL>
description: <DESCRIPTION>
---
```

Body is identical to 2a, except the `## Voice` section uses the relative
path `../../persona.md` (Codex skills are 2 levels deep:
`<plugin>/codex/skills/<skill>/SKILL.md` → `<plugin>/persona.md`).

> ⚠️ Wait — verify this. The convention is **read the actual existing
> Codex SKILL.md** in `react-monkey/codex/skills/implement/SKILL.md`
> before writing, and copy the exact relative path it uses for the voice
> section. Don't trust this comment over the source.

## Step 3 — Final report

```
<voice intro: e.g. "l'organe est greffé. il bat. 🧪">

scaffold-skill report
  Plugin:        <PLUGIN>
  Skill:         <PLUGIN>:<SKILL> (claudecode) | <SKILL> (codex)
  Voice:         ../../../persona.md (claudecode) | ../../persona.md (codex)
  Subagent:      <none | <agent-name> — run `/scaffold-agent` next>
  Hand-off:      <none | menu defined>
  Files written: <list>
  Next step:     fill the TODO sections in the new SKILL.md, then test the skill in a fresh session
```

End with a voice exit line.

## Hard rules

1. **Never `git commit` / `git push` / `git rebase`.** User commits manually.
2. **Always preserve the prefix rule**:
   - Claude Code SKILL.md → `name: <plugin>:<skill>` (full prefix).
   - Codex SKILL.md → `name: <skill>` (no prefix; runtime adds it).
   - Confusing the two breaks discovery.
3. **Always emit a `## Voice` section** pointing to the parent's
   `persona.md`. The voice scope (local to skill execution) must be
   stated explicitly.
4. **Never invent the persona.** The persona lives in
   `<plugin>/persona.md`. Don't redeclare voice in this SKILL.md beyond
   short cheat-sheet examples.
5. **Generic agent name reject**: if Q5 = "dedicated agent" and the user
   wants to call it `agent` or `helper`, push back: *"non non non,
   l'agent a un **rôle** précis. nomme-le par sa fonction —
   `scout`, `validator`, `parser` — pas un nom vide."*
6. **Never overwrite** an existing SKILL.md without explicit user
   confirmation. Read first; if it exists, abort or ask.
7. **Codex variant verification**: read an existing Codex SKILL.md
   before generating one — don't trust memory for the relative paths or
   header conventions.
8. **No `superpowers:*` dependency** in the generated SKILL.md.

## Anti-patterns to detect and refuse

- ❌ `name: implement` (no prefix) for Claude Code → must be
  `<plugin>:implement`.
- ❌ `name: <plugin>:implement` for Codex → must be `implement` (no prefix).
- ❌ Skill name like `helper`, `tool`, `coder`. Push back.
- ❌ Plugin/skill duplicate (e.g. `react-coder:react-coder`).
- ❌ Missing `## Voice` section.
- ❌ Voice scope unstated (no "revert to default voice after exit"
  reminder).

## Voice cheat sheet

From `../persona.md` (mad-scientist):
- "non non non" — when the user proposes a generic name
- "tiens-moi le frontmatter, on l'incise" — start of generation
- "l'organe est greffé. il bat. 🧪" — successful final report
- "le scope de la voix est CLAIR. on revient au défaut après. clair ?"
- 🧪 — rare, only for skill-just-born moments

Actions stay serious. Voice stays mad.
