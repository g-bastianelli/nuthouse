# nuthouse

Personal Claude Code (sometimes Codex) plugin marketplace. Four plugins right now: `saucy-status`, `react-monkey`, `linear-devotee`, `acid-prophet`.

> **Pour créer un nouveau plugin / skill / agent**, invoque les skills locaux :
> `/scaffold-plugin`, `/scaffold-skill`, `/scaffold-agent`. Ils embarquent
> toutes les conventions techniques (frontmatter, structure de dossiers,
> manifest, hooks, format SDD, naming rules, anti-patterns) et génèrent
> les fichiers au bon endroit. Ce CLAUDE.md ne les redocumente plus —
> les skills sont la source de vérité pour le scaffolding.

---

## Vibe (don't skip this)

This marketplace is unapologetically **brainrot-coded**. **Brainrot forever.** Each plugin has its own dumb personality and answers in character — that's the product, not a quirk. The plugin names, personas, and user-facing voices are load-bearing.

New plugins follow this energy:

- **Plugin name** = a persona first: a person, creature, role, mythic figure, cultist, monster, or other being that can speak in character. `react-monkey` is a chaotic creature, `linear-devotee` is a feral worshipper, `acid-prophet` is a tripping spec oracle. `saucy-status` is a historical exception. New names must not be abstract effects, modes, or vibes (`acid-vision`, `task-flow`, `idea-engine`) unless the noun clearly points to a character. **Avoid** corporate/technical names (`linear-helper`, `task-manager`, `ai-assistant`).
- **Persona voice** = each plugin has its own dumb personality and *speaks like it*. Voice shows up everywhere user-facing: skill outputs, hook messages, reports, error states, hand-off menus. The agent stays in character throughout the skill — not just a clever opener that fades into neutral prose. **The canonical voice of each plugin lives in `<plugin>/persona.md`** (frontmatter `name`/`tagline`/`emoji` + body prose). That file is the single source of truth, referenced by every skill of the plugin via a `## Voice` section that points to it. **This CLAUDE.md does not define voices** — it only references them. Read the persona file to know how a plugin sounds.
  - `saucy-status` → see `saucy-status/persona.md`
  - `react-monkey` → see `react-monkey/persona.md`
  - `linear-devotee` → see `linear-devotee/persona.md`
  - `acid-prophet` → see `acid-prophet/persona.md`
  - Future plugins → invent the persona at brainstorm time, **write it down in `<plugin>/persona.md`**, and apply it consistently across the plugin's skills. Do not redeclare the voice in this CLAUDE.md.
- **Reports follow the voice**. The structure stays plain, the surrounding 1-2 lines are brainrot. Same skill, same voice end-to-end.
- **Voice cadence matters**. Claude Code skills with `shared/persona-line-contract.md` should try `warden:voice` at every user-visible workflow transition: skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Do not call it for internal shell commands, hidden subagent steps, or inside serious artifacts. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Missing `warden` is never a precondition failure and should never be mentioned to the user during the workflow.
- **Hard rule**: actions stay serious, voice stays brainrot. No fantasy side-effects, no joke commits, no "lol whoops" failure modes. Only the *strings* are fun.
- **Use emojis sparingly**. 🥺 / 👑 / 😔 / 🔥 land. Anything more is over-emoji and feels AI-slop.

When building a new skill, write the prompts/outputs in the plugin's voice from the start — don't bolt it on later.

### Persona Roulette (local to this repo)

When you open Claude Code in this repo, a `SessionStart` hook (`.claude/hooks/persona-roulette.mjs`, declared in `.claude/settings.json`) randomly picks one of the `<plugin>/persona.md` files and injects its body as the **default voice for the session** via `additionalContext`. It's only active inside this repo — installed plugins still behave normally everywhere else.

Rules:
- The roulette **never modifies** any skill, agent, or plugin file. It only injects a session-level default voice.
- Skills with a `## Voice` section override the roulette **inside their scope** — they read their own `<plugin>/persona.md` and apply that voice. The roulette voice is the default for *everything else* in the session (general chat, reports outside skills, error responses).
- Disable for one session: `SKILL_ISSUE_PERSONA=off claude`.
- Add a new persona to the pool: drop a `persona.md` at the root of any plugin with the standard frontmatter (`name`, `tagline`, optional `emoji`) and a body. The hook auto-discovers via `<repoRoot>/*/persona.md` glob. (The local scaffold skills' shared persona at `.claude/skills/persona.md` is **not** in the pool — it's scoped to those skills only.)
- Tests: `cd .claude/hooks/tests && bunx bun test` (the `.claude` hidden dir is skipped by bun's default scan, so either `cd` in or pass an absolute path).

---

## Stack & tooling

- **Runtime hooks/scripts**: Node.js, **ESM** (`import` / `export`). **`.mjs`** extension is mandatory for hooks and tests (zero ambiguity for Node, no `package.json` needed in the plugin, plugin is self-contained regardless of install context). `saucy-status` stays on CJS for historical reasons. Every new plugin ships ESM `.mjs`. Reference: `linear-devotee/claudecode/hooks/*.mjs`.
- **Package manager**: `bun@1.3.x` (declared in root `package.json`).
- **Tests**: `bun test` (built-in, no dep added). Tests live in `<plugin>/<runtime>/tests/`.
- **Lint/format**: `biome` (config in `biome.json`). Formatter off, linter on. Local rule: `noUnusedVariables` is on → use `catch {}` (not `catch (e)`) when the binding is unused. Biome will auto-organize imports — let it.
- **Pre-commit**: `lefthook` runs `bunx biome check .`. **Never bypass** with `--no-verify`.
- **No npm/bun deps added** in plugins. Stick to `node:fs`, `node:path`, `node:os`, `node:child_process`. If a plugin really needs a dep, raise it first.

---

## Pre-push verification

```bash
bunx bun test <plugin>/                    # all plugin tests pass
(cd .claude/hooks/tests && bunx bun test)  # persona-roulette tests pass
bun run test:meta                          # frontmatter model/effort values valid
bunx biome check .                          # lint clean
node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json', 'utf8'))"  # marketplace JSON valid
grep -rn "writing-plans" <plugin>/   # no external workflow artifacts leak
```

---

## Anti-patterns to avoid

Global guidance — applies everywhere, not just at scaffold time:

- ❌ Pollute main context with MCP fetches / massive reads → **always dispatch to a subagent**
- ❌ STAR format for briefs targeting an agent → **SDD**
- ❌ Linear (or any external service) mutations without user confirmation, unless explicitly authorized and documented
- ❌ `git push`, `git commit`, `git rebase` silently executed by a skill → **never**
- ❌ External workflow/tool dependencies in the shipped plugin → **dev artifacts only, deleted before push**
- ❌ Adding an npm/bun dep "just for this plugin" → **discuss first**
- ❌ Bypassing pre-commit hook with `--no-verify` → **never**
- ❌ Corporate/neutral plugin names → **the brainrot is the brand**
- ❌ Banner or README in mixed languages → **English everywhere**
- ❌ Any plugin file content (SKILL.md, persona.md, README.md, plugin.json) in any language other than English → **all plugin files are English, always. The voice adapts at runtime via the Language section in persona.md — the file itself is always English.**
- ❌ Redeclaring a plugin's voice in this CLAUDE.md → **the voice lives in `<plugin>/persona.md` exclusively**
- ❌ Creating skill/agent files manually without `/scaffold-skill`/`/scaffold-agent` → misses `plugin.json` `"skills"` field and template checks that the scaffold enforces by construction

---

## Existing plugins — quick recap

| Plugin | What | Hooks | Skills | Agents | Persona |
|---|---|---|---|---|---|
| `saucy-status` | Saucy/gooning loading messages in statusline | SessionStart, UserPromptSubmit | — | — | `saucy-status/persona.md` |
| `react-monkey` | React implementation specialist with parallel exploration | — | `implement` | `explorer` | `react-monkey/persona.md` |
| `linear-devotee` | Linear issue detection at session start + cascading Project/Milestone/Issue creation, all SDD-formatted | SessionStart, UserPromptSubmit | `greet`, `consummate-project`, `bind-milestone`, `bare-issue` | `seer`, `oracle`, `chronicler`, `acolyte` | `linear-devotee/persona.md` |
| `acid-prophet` | Structured spec-writing + audit + drift detection. Q&A → spec → `scryer` audit → optional handoff to `linear-devotee`. PR-time drift check via `frequency-drift` | — | `trip`, `frequency-drift`, `scry` | `scryer` | `acid-prophet/persona.md` |
| `warden` | Centralized voice agent — emits decorative persona lines for any plugin via `warden:voice`; `/warden:voice [on\|off\|status]` toggles fun messages globally | — | `voice` | `voice` | `warden/persona.md` |

Repo-level: `.claude/hooks/persona-roulette.mjs` picks a random `persona.md` at SessionStart for the current session's default voice (see "Persona Roulette" section above). Local scaffold skills live at `.claude/skills/{scaffold-plugin,scaffold-skill,scaffold-agent}/SKILL.md` with shared `mad-scientist` voice at `.claude/skills/persona.md`.

---

## Dev workflow recap

1. **Brainstorming** — naming (see Vibe), persona, scope.
2. **SPEC** (optional) — colocate at `<plugin>/SPEC.md` if useful as a reference doc.
3. **PLAN** — keep plans lightweight and local to the plugin work (`<plugin>/SPEC.md`, issue notes, or a temporary branch note). No external workflow artifacts or tool-specific dependencies must leak into the shipped plugin.
4. **Scaffold** — `/scaffold-plugin`, then `/scaffold-skill`, then `/scaffold-agent` as needed. The skills enforce the conventions by construction.
5. **TDD** for any Node helper or non-trivial logic (`bun test`).
6. **Subagent-driven dev** — dispatch a fresh subagent for each heavy task, keep the main context for coordination only.
7. **Frequent commits**: one commit per logical step (`feat(<plugin>): scaffold...`, etc.). Co-author tag is not required.
8. **Squash-merge** on `main` via GitHub PR (user workflow — no direct merge).
