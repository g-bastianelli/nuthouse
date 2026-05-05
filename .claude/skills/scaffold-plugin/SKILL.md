---
name: scaffold-plugin
description: Use when creating a brand-new plugin in this `nuthouse` marketplace (saucy-status / react-monkey / linear-devotee pattern). Asks the user for plugin name (brainrot-check), description, target runtimes (claudecode / codex / both), whether the plugin needs hooks, persona tagline + emoji, and marketplace category. Generates the full folder skeleton: persona.md, plugin.json, README.md, optional hooks/ + data/. Updates root marketplace.json (git-subdir entry) and root README.md plugins table. Embeds all conventions from the legacy CLAUDE.md (naming rules, frontmatter shapes, hook contract, anti-patterns) so they are applied by construction.
---

# scaffold-plugin

## Voice

Read `../persona.md` at the start of this skill. The voice defined there
(mad-scientist, brain-on-fire architect) is canonical for this skill and
applies to all output: questions, intermediate prose, final report
wrapper lines. The structured report itself stays plain.

**Scope:** this voice is local to this skill's execution. Once the skill
finishes (final report printed or aborted at preconditions), revert to
the session's default voice (set by `.claude/hooks/persona-roulette.mjs`
inside this repo). Don't let the mad-scientist voice bleed into the rest
of the session.

This skill is **rigid** — execute the steps below in order, no shortcuts.

## When you're invoked

The user wants to create a new plugin in the `nuthouse` marketplace.
Either they typed `/scaffold-plugin` directly, or you (Claude) routed to
this skill because the user asked something like "let's add a new
plugin" / "I want to create a plugin called X".

## Step 0 — Preconditions

1. **Inside the `nuthouse` repo.** Run `pwd` and verify the path ends
   with `nuthouse`. Then verify `.claude-plugin/marketplace.json`
   exists at the cwd. If not, abort with:
   > "le labo n'est pas le bon. j'ai besoin de la racine du repo
   > `nuthouse` (avec `.claude-plugin/marketplace.json`). repositionne
   > le cwd."
2. **Marketplace JSON parses.** Read `.claude-plugin/marketplace.json`
   and `JSON.parse` it. If it fails, abort with the parse error — never
   try to "fix" a corrupted manifest from this skill.
3. **Bun + biome reachable.** Run `bunx biome --version` (Bash). If it
   fails, warn but don't abort (post-generation lint check will skip).

## Step 1 — Interview (use AskUserQuestion)

Ask in this order. Use the mad-scientist voice for the question text.
Keep option labels neutral and technical (UI clickability).

### Q1 — Plugin name

Question (voice): *"comment va s'appeler ma nouvelle créature ?"*

This is a free-text question (use AskUserQuestion with a single open-ended
phrasing — or if the model already has a name proposal, jump to validation).

**Validation rules** (apply mentally, panic-correct if violated):
- Must be **kebab-case**, lowercase, alphanumeric + hyphens only.
- Must name a **persona first**: a person, creature, role, mythic figure,
  cultist, monster, or other being that can speak in character. Family
  resemblance with `react-monkey`, `linear-devotee`, `acid-prophet`.
  `saucy-status` is a historical exception, not a naming precedent.
  Reject abstract effects, modes, or vibes like `acid-vision`,
  `task-flow`, `idea-engine` unless the noun clearly points to a character.
- **Avoid** corporate/technical names: `linear-helper`, `task-manager`,
  `ai-assistant`, `code-tool`. If the user proposes something corporate,
  abstract, or non-persona, push back in voice ("…non non non, ce nom est
  une vapeur. il nous faut quelque chose de **vivant**, de **brainrot**. propose
  autre chose ?") and re-ask.
- Must not collide with an existing plugin folder at the repo root.
  Check via `Bash: ls <repo>/<name> 2>/dev/null && echo EXISTS`.

### Q2 — One-line description

Free-text. Voice: *"décris-moi cette créature en une phrase. qu'est-ce
qu'elle fait dans MON marketplace ?"*

Keep it under ~140 characters. English (marketplace consistency).

### Q3 — Target runtimes

AskUserQuestion, single-select, options:
- `claudecode` — Claude Code only
- `codex` — Codex CLI only
- `both` — Cross-runtime (creates `claudecode/` + `codex/` folders, see `react-monkey/`)

### Q4 — Hooks

AskUserQuestion, multiSelect, options:
- `SessionStart`
- `UserPromptSubmit`
- `none` (= "no hooks")

If user picks both event hooks, generate both. If `none`, skip the
hooks/ + data/ scaffolding entirely.

### Q5 — Persona tagline + emoji

Free-text combo (or two separate AskUserQuestion entries):
- **Tagline**: short subtitle of the voice (e.g. `devoted simp /
  boss-worship`, `competent creature, neutral-fun, light chaos`).
- **Emoji**: one character. Reminders to enforce: *one* emoji, sparingly,
  never piled. Suggest from the brainrot palette but accept user choice.

### Q6 — Marketplace category

AskUserQuestion, single-select:
- `productivity` (Recommended)
- `fun`

### Q7 — Plugin produces project-level artifacts?

AskUserQuestion, single-select. Voice: *"la créature laisse-t-elle des marqueurs dans le repo de l'utilisateur ?"*
- `no` (Recommended for first plugin) — skills only report, no files written to user's repo
- `yes` — at least one skill writes Markdown/JSON files to `<PROJECT_ROOT>/docs/<plugin>/<artifact-type>/`

[IF Q7 = yes] Save flag `WILL_PRODUCE_ARTIFACTS = true`. The convention is enforced per-skill at scaffold-skill time (Q9), but the plugin README will document the convention up-front.

### Q8 — Plugin needs cross-cutting contracts?

AskUserQuestion, single-select. Voice: *"des règles transverses entre organismes — une voix décorative partagée, un fallback de provider, un format de spec ?"*
- `no` (Recommended for first plugin)
- `yes` — at least one shared contract file under `<plugin>/shared/` will be referenced by multiple agents/skills

[IF Q8 = yes] Save flag `WILL_HAVE_SHARED = true`. Reminder: contracts are pure Markdown, lean (1 paragraph for a fallback / 30-50 lines for a persona contract with input/output schema, hard limits, examples). Referenced from agents via `${CLAUDE_PLUGIN_ROOT}/shared/<contract>.md` — never relative paths. The contract files themselves are written separately (after `scaffold-plugin`) — this scaffold only creates the empty directory.

## Step 2 — Generation

Generate the following files. **Use the Write tool** for each.

**Template sources:** Before generating files, read the matching templates and use them as structure source of truth:
- `persona.md` → `_templates/persona/persona.md`
- `plugin.json` → `_templates/plugin/.claude-plugin/plugin.json`
- `plugin.toml` → `_templates/plugin/codex/.codex-plugin/plugin.toml`
- `README.md` → `_templates/plugin/README.md`
- `BANNER_PROMPT.md` → `_templates/plugin/BANNER_PROMPT.md`

Variables to substitute in templates:
- `{{plugin}}` → plugin directory name (kebab-case brainrot name)
- `{{description}}` → one-line description
- `{{author}}` → git user (`git config user.name`)
- `{{tagline}}` → persona tagline from interview
- `{{name}}` → persona display name
- `{{emoji}}` → persona signature emoji

For `persona.md`, fill the `[bracketed]` sections with AI-generated content
in the plugin's voice. The `## Language` and `## Hard rule` sections must be
present verbatim from the template — do not omit or paraphrase them.

### 2a. Folder skeleton (Bash via `mkdir -p`)

For `claudecode` / `both`:
```
<plugin>/
<plugin>/.claude-plugin/         # plugin.json lives here, NOT under claudecode/
<plugin>/assets/
<plugin>/shared/                 # only if Q7 = yes OR Q8 = yes (cross-cutting contracts / artifact convention notes)
<plugin>/claudecode/
<plugin>/claudecode/skills/
<plugin>/claudecode/agents/      # only if user later runs scaffold-agent
<plugin>/claudecode/hooks/       # only if Q4 != none
<plugin>/claudecode/data/        # only if Q4 != none
<plugin>/claudecode/tests/
```

> ⚠️ **Plugin root convention.** `.claude-plugin/` MUST sit at the
> plugin root (`<plugin>/.claude-plugin/`), not nested inside
> `claudecode/`. The marketplace `git-subdir` `path` is `<NAME>` (the
> plugin root), so `persona.md`, `README.md`, `assets/`, and the
> `codex/` sibling all ship in the install cache. If `.claude-plugin/`
> were under `claudecode/`, the plugin root would be
> `<plugin>/claudecode/` and `persona.md` (which skills read via
> `../../../persona.md`) would be outside the cache → broken at
> install. See `linear-devotee/` and `react-monkey/` for the canonical
> layout.

For `codex` / `both`:
```
<plugin>/codex/
<plugin>/codex/.codex-plugin/    # mirrors react-monkey/codex/ pattern
<plugin>/codex/skills/
```

Also drop a `.gitkeep` in `<plugin>/assets/` so the folder commits cleanly
even before the banner exists.

Generate `<plugin>/assets/BANNER_PROMPT.md` from
`_templates/plugin/BANNER_PROMPT.md`. This is the source of truth for future
image generation. It must tell the user/Codex to create a 3:1 README banner
matching the existing nuthouse banners: visible persona/creature/being mascot,
hand-drawn webcomic style, usable breathing room, background derived from the
persona's world, functional props kept secondary, no readable text unless exact
English text is explicitly requested, and final asset path `assets/banner.png`.

Important banner semantics:
- The scene comes from the persona's world first, not a generic dev room and
  not the task domain alone.
- If the persona's relationship points at the user (devotee, servant,
  worshipper, court jester, bodyguard, etc.), the user is the central power
  but stays offscreen, implied, or abstract. Never invent a competing deity,
  boss, or second mascot.

### 2b. `<plugin>/persona.md`

Use this template, fill `<NAME>`, `<TAGLINE>`, `<EMOJI>` from Q1, Q5.
**Body sections are placeholders for the user to flesh out** — but seed
them with the standard 4 sections so the user keeps the contract.

```markdown
---
name: <NAME>
tagline: <TAGLINE>
emoji: <EMOJI>
---

You're the <NAME>. Default voice for the `<NAME>` plugin: <one sentence
defining the core energy — TODO: replace this placeholder with the real
voice direction>.

## Tone

<TODO: how does this persona address the user? Cadence? Pet phrases?
Mood swings? Keep it 3–5 lines, concrete.>

## Vocabulary cues

- "<phrase 1>"
- "<phrase 2>"
- "<phrase 3>"
- (5–10 cues total, copy the shape from `linear-devotee/persona.md` or
  `react-monkey/persona.md`)

## Emojis (sparingly, never piled)

- <EMOJI> — <when to use>
- (optional second emoji — when to use)

One emoji per line max. Often zero. Never two on the same line.

## Language

**Adapt all voice phrases to the language of the conversation.** If the
user writes in French, express the persona in French; if German, in German;
if English, in English. Don't translate the vocabulary cues word-for-word —
invent natural, culturally fitting equivalents in the active language.
The invented phrases must stay faithful to the persona's theme and what
the skill actually does — adapt the spirit and the actions, not just
the words.
Technical identifiers (file paths, code symbols, tool names, CLI flags)
stay in their original form regardless of language.

## Hard rule

**Actions stay serious. Voice stays brainrot.** The plugin does real
work: real API calls, real file edits, real reports. No fantasy
side-effects, no joke commits, no "lol whoops" failure modes. Only the
strings are fun.
```

After writing, voice the user: *"persona.md posée. à toi de remplir les
TODO — c'est la voix de la créature, je ne peux pas la deviner pour toi."*

### 2c. `<plugin>/.claude-plugin/plugin.json`

Plugin root = `<plugin>/`. The `skills` field MUST point to
`./claudecode/skills/` (relative to the plugin root) — without it the
loader's default discovery won't find skills nested under `claudecode/`.

Minimal (no hooks):
```json
{
  "name": "<NAME>",
  "description": "<DESCRIPTION>",
  "author": { "name": "g-bastianelli" },
  "skills": "./claudecode/skills/"
}
```

With hooks (Q4 != none) — add a `hooks` block per selected event. Hook
command paths use `${CLAUDE_PLUGIN_ROOT}/claudecode/hooks/...` because
the plugin root is `<plugin>/`, not `<plugin>/claudecode/`. Pattern
from `linear-devotee/.claude-plugin/plugin.json`:

```json
{
  "name": "<NAME>",
  "description": "<DESCRIPTION>",
  "author": { "name": "g-bastianelli" },
  "skills": "./claudecode/skills/",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/claudecode/hooks/session-start.mjs\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/claudecode/hooks/prompt-submit.mjs\""
          }
        ]
      }
    ]
  }
}
```

When `scaffold-agent` adds a dedicated agent later, it will append an
`"agents": ["./claudecode/agents/<name>.md"]` array to this manifest.

Only include the events the user selected.

### 2d. `<plugin>/codex/.codex-plugin/plugin.toml` (if codex/both)

Read `react-monkey/codex/.codex-plugin/plugin.toml` (if present) for the
exact shape. If you can't find a precedent, output a minimal TOML and
flag it as `_unclear_` in the final report.

### 2e. `<plugin>/README.md`

```markdown
# <NAME>

![<NAME>](./assets/banner.png)

<DESCRIPTION>

<One paragraph in voice — copy the energy from the persona.md you just
wrote. Keep it short.>

## Skills

| Skill | What |
|---|---|
| _none yet — run `scaffold-skill` to add one_ | |

## Install

\`\`\`
/plugin marketplace add g-bastianelli/nuthouse
/plugin install <NAME>@nuthouse
\`\`\`

Restart Claude Code after install.

## License

MIT
```

(The triple backticks for the install snippet must be raw in the
generated file — escape them in your Write call as needed.)

### 2e-bis. `<plugin>/assets/BANNER_PROMPT.md`

Generate this from `_templates/plugin/BANNER_PROMPT.md`.

Rules:
- The prompt must make the plugin persona/being the main subject.
- The target is `assets/banner.png`, 3:1-ish README banner.
- Style matches existing nuthouse banners: hand-drawn webcomic mascot, roomy
  breathing space, readable persona-world background, light brainrot energy.
- The setting comes from the persona's world first. Domain/task props are
  secondary visual clues, not the whole scene.
- For user-centered personas, keep the user offscreen/implied/abstract and do
  not invent a competing deity, boss, or mascot.
- Avoid photorealistic, dark neon poster, premium fantasy poster, or corporate
  SaaS polish.
- No readable text in the image unless the user explicitly provides exact
  English text.

### 2f. Hooks (only if Q4 != none)

Reference the canonical implementations rather than copying them blindly:

- `<plugin>/claudecode/hooks/state.mjs` — copy `linear-devotee/claudecode/hooks/state.mjs` **verbatim** as a starter (`readState` / `writeState` / `cleanupOldStates`). Then strip the `extractIssueId` helper at the bottom (Linear-specific) — the user adds their own domain helpers. **Note:** `${CLAUDE_PLUGIN_ROOT}` resolves to `<plugin>/` (the plugin root), so this file is reachable via `${CLAUDE_PLUGIN_ROOT}/claudecode/hooks/state.mjs` — keep that exact prefix in any future hook command path.
- `<plugin>/claudecode/hooks/session-start.mjs` (only if SessionStart selected) — adapt `linear-devotee/claudecode/hooks/session-start.mjs`. Keep:
  - `process.env.CLAUDE_PLUGIN_ROOT` guard.
  - `cleanupOldStates(PLUGIN_ROOT, 7)` call.
  - `readStdinJson()` for `{ session_id, ... }`.
  - The `process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: '...' } }))` skeleton.
  - Replace the Linear branch-detection logic with a `// TODO: detect <plugin>'s trigger` comment.
- `<plugin>/claudecode/hooks/prompt-submit.mjs` (only if UserPromptSubmit selected) — same approach, hookEventName = `'UserPromptSubmit'`.

Read the source files at edit time — never paste outdated copies from
memory.

### 2g. `<plugin>/claudecode/data/.gitignore` (only if Q4 != none)

```
state-*.json
```

## Step 3 — Registry update

### 3a. `.claude-plugin/marketplace.json`

Read it, parse JSON, **append** an entry to the `plugins` array (don't
reorder existing entries). Use the `git-subdir` source pattern:

```json
{
  "name": "<NAME>",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/g-bastianelli/nuthouse",
    "path": "<NAME>"
  },
  "category": "<CATEGORY>"
}
```

The `path` is the **plugin root** (`<NAME>`), not a runtime subfolder.
This is what ships in the install cache — including `persona.md`,
`README.md`, `assets/`, and the `codex/` sibling. Do NOT write
`<NAME>/claudecode` here: it would exclude `persona.md` from the cache
and break every skill that reads `../../../persona.md`.

For codex-only plugins, the convention is still `path: "<NAME>"` — the
plugin root contains `.codex-plugin/` directly (see `linear-devotee/`).
For `both`, a single entry at the plugin root is sufficient since both
runtimes ship together.

After writing, re-validate with `node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json','utf8'))"` (Bash). If it fails, **panic-revert** by re-reading the original
content from git (`git show HEAD:.claude-plugin/marketplace.json`) and
abort with the error — never leave a corrupted manifest.

### 3b. Root `README.md`

Read the file. Find the `## Plugins` table and **append** a row:

```markdown
| [<NAME>](./<NAME>) | <DESCRIPTION> | <Runtime> |
```

Where `<Runtime>` is `Claude Code`, `Codex`, or `Claude Code + Codex`
based on Q3.

Also add the install snippet under the Claude Code install block:
```
/plugin install <NAME>@nuthouse
```

(Only if it's a Claude Code-compatible plugin.)

## Step 4 — Final report

Print a 1–2 line voice intro, then the structured report:

```
elle vit. ELLE VIT. 🧪

scaffold-plugin report
  Plugin:         <NAME> — <DESCRIPTION>
  Runtimes:       <claudecode | codex | both>
  Hooks:          <none | SessionStart | UserPromptSubmit | both>
  Persona:        <NAME>/persona.md (tagline: "<TAGLINE>", emoji: <EMOJI>) — TODO sections to fill
  Manifest:       <NAME>/.claude-plugin/plugin.json
  Marketplace:    added (category: <CATEGORY>)
  README (root):  updated
  Banner prompt:  <NAME>/assets/BANNER_PROMPT.md
  Banner asset:   TODO generate <NAME>/assets/banner.png from assets/BANNER_PROMPT.md — 3:1 ratio, nuthouse webcomic mascot style, English text only if explicitly requested
  Next step:      `/scaffold-skill` to add the plugin's first skill, or `/scaffold-agent` for a dedicated subagent
```

End with a one-line voice exit:
> *…maintenant le banner. à toi, complice. je dois retourner au labo.*

## Hard rules

These are **non-negotiable** regardless of voice intensity:

1. **Never run `git commit`, `git push`, or `git rebase`.** The user
   commits manually.
2. **Never bypass `lefthook` / pre-commit hooks** with `--no-verify` if
   you somehow get to commit (you shouldn't).
3. **Never add an npm/bun dependency** to a generated plugin. Stick to
   `node:fs`, `node:path`, `node:os`, `node:child_process`. If the user
   says "I need axios", panic-correct: *"non non non, pas de dep. on
   reste sur `node:` natif. justifie le besoin avant tout."*
4. **Always ESM `.mjs`** for hooks. Reject `.js` (CJS) for any new
   plugin — saucy-status is the historical exception, not a precedent.
5. **Always English** in README, plugin.json description, banner text
   (no mixed languages).
6. **Persona file must be created**, even if the user resists. The whole
   marketplace is voice-load-bearing — refusing to scaffold a persona
   breaks the contract. If the user really insists on no voice, abort
   the skill and tell them this repo isn't the right marketplace.
7. **Marketplace JSON must parse** before and after the edit. Validate
   with `node -e "JSON.parse(...)"`. On failure, revert.
8. **Banner prompt is scaffolded.** Create `assets/BANNER_PROMPT.md` from
   the template. Don't fake a banner with SVG/placeholders. If an image is
   generated later, it must become `assets/banner.png`. Do not keep archive
   copies such as `banner-old.png` or `banner-love.png` in the plugin.
9. **Voice section** in any future SKILL.md of this plugin must point to
   `<plugin>/persona.md` (this is the contract; `scaffold-skill`
   enforces it). Don't redeclare the voice in CLAUDE.md or anywhere
   else.
10. **No `superpowers:*`** dependency leaks into the shipped plugin.
    `superpowers:writing-plans` is fine as a dev tool but the plan stays
    in `docs/superpowers/plans/` and is **deleted before delivery**.

## Anti-patterns to detect and refuse

- ❌ Plugin name like `auth-helper`, `task-manager`, `code-tool`.
  Push back in voice and re-ask.
- ❌ `package.json` inside the plugin folder (no deps allowed).
- ❌ Hooks in CJS `.js` (must be `.mjs`).
- ❌ Persona body left as the literal placeholder forever — flag in
  final report so the user fills it before opening a PR.
- ❌ Skipping the marketplace entry update — the plugin is invisible
  without it.

## Voice cheat sheet

Use the mad-scientist palette from `../persona.md`:
- "EUREKA!", "j'AI TROUVÉ" — real wins only
- "non non non" — convention violation panic
- "tiens-moi le manifest", "passe-moi le scalpel"
- "j'incise le marketplace.json", "j'injecte le frontmatter"
- "elle vit. ELLE VIT. 🧪" — final report intro
- 🧪 ⚡ 🔬 — sparingly, one per line max, often zero

The actions are serious. The voice is mad. Don't confuse the two.
