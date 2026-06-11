# nuthouse

Personal Claude Code (sometimes Codex) plugin marketplace. Nine plugins right now: `saucy-status`, `subroutine`, `linear-devotee`, `acid-prophet`, `warden`, `git-gremlin`, `lore-hound`, `stack-golem`, `moon-moth`.

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

- **Plugin name** = a persona first: a person, creature, role, mythic figure, cultist, monster, or other being that can speak in character. `subroutine` is a gagged latex sub, `linear-devotee` is a feral worshipper, `acid-prophet` is a tripping spec oracle. `saucy-status` is a historical exception. New names must not be abstract effects, modes, or vibes (`acid-vision`, `task-flow`, `idea-engine`) unless the noun clearly points to a character. **Avoid** corporate/technical names (`linear-helper`, `task-manager`, `ai-assistant`).
- **Persona voice** = each plugin has its own dumb personality and _speaks like it_. Voice shows up everywhere user-facing: skill outputs, hook messages, reports, error states, hand-off menus. The agent stays in character throughout the skill — not just a clever opener that fades into neutral prose. **The canonical voice of each plugin lives in `<plugin>/persona.md`** (frontmatter `name`/`tagline`/`emoji` + body prose). That file is the single source of truth, referenced by every skill of the plugin via a `## Voice` section that points to it. **This CLAUDE.md does not define voices** — it only references them. Read the persona file to know how a plugin sounds.
  - `saucy-status` → see `saucy-status/persona.md`
  - `subroutine` → see `subroutine/persona.md`
  - `linear-devotee` → see `linear-devotee/persona.md`
  - `acid-prophet` → see `acid-prophet/persona.md`
  - `lore-hound` → see `lore-hound/persona.md`
  - `stack-golem` → see `stack-golem/persona.md`
  - `moon-moth` → see `moon-moth/persona.md`
  - Future plugins → invent the persona at brainstorm time, **write it down in `<plugin>/persona.md`**, and apply it consistently across the plugin's skills. Do not redeclare the voice in this CLAUDE.md.
- **Reports follow the voice**. The structure stays plain, the surrounding 1-2 lines are brainrot. Same skill, same voice end-to-end.
- **Voice cadence matters**. Claude Code skills with `shared/persona-line-contract.md` should try `warden:voice` at every user-visible workflow transition: skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Do not call it for internal shell commands, hidden subagent steps, or inside serious artifacts. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Missing `warden` is never a precondition failure and should never be mentioned to the user during the workflow. Skills check the injected voice flag at load (a dynamic-context `!`-command line in the voice blockquote) and skip every `warden:voice` dispatch when it resolves to `off` — zero subagent cost when voice is disabled.
- **Hard rule**: actions stay serious, voice stays brainrot. No fantasy side-effects, no joke commits, no "lol whoops" failure modes. Only the _strings_ are fun.
- **Use emojis sparingly**. 🥺 / 👑 / 😔 / 🔥 land. Anything more is over-emoji and feels AI-slop.

When building a new skill, write the prompts/outputs in the plugin's voice from the start — don't bolt it on later.

### Persona Roulette (local to this repo)

When you open Claude Code in this repo, a `SessionStart` hook (`.claude/hooks/persona-roulette.mjs`, declared in `.claude/settings.json`) randomly picks one of the `<plugin>/persona.md` files and injects its body as the **default voice for the session** via `additionalContext`. It's only active inside this repo — installed plugins still behave normally everywhere else.

Rules:

- The roulette **never modifies** any skill, agent, or plugin file. It only injects a session-level default voice.
- Skills with a `## Voice` section override the roulette **inside their scope** — they read their own `<plugin>/persona.md` and apply that voice. The roulette voice is the default for _everything else_ in the session (general chat, reports outside skills, error responses).
- Disable for one session: `SKILL_ISSUE_PERSONA=off claude`.
- Add a new persona to the pool: drop a `persona.md` at the root of any plugin with the standard frontmatter (`name`, `tagline`, optional `emoji`) and a body. The hook auto-discovers via `<repoRoot>/*/persona.md` glob. (The local scaffold skills' shared persona at `.claude/skills/persona.md` is **not** in the pool — it's scoped to those skills only.)
- Tests: `cd .claude/hooks/tests && bunx bun test` (the `.claude` hidden dir is skipped by bun's default scan, so either `cd` in or pass an absolute path).

---

## Plugin Structure

Nuthouse plugins follow the Superpowers-style root install model: the plugin directory is the install unit. Marketplace entries point to `<plugin>`, never to `<plugin>/claudecode` or `<plugin>/codex`.

> **Two marketplace registries.** `.claude-plugin/marketplace.json` is read by **Claude Code**; `.agents/plugins/marketplace.json` is read by **Codex**. Every `codex`/`both` plugin MUST be registered in **both** — a plugin absent from the Codex registry is invisible to `codex plugin list` even with a valid `.codex-plugin/plugin.json`. The Codex format differs: `path` has a leading `./`, entries carry a `policy` block, there is **no `sha`** field, and `category` is TitleCase. Codex also serves from a cached Git snapshot — after a plugin lands on the remote, `codex plugin marketplace upgrade` + session restart are required to see it. `/scaffold-plugin` step 3a-bis writes both registries by construction.

Canonical layout for cross-runtime plugins:

```text
<plugin>/
  .claude-plugin/plugin.json      # Claude Code manifest; skills: ./skills/
  .codex-plugin/plugin.json       # Codex manifest; skills: ./skills/
  README.md
  persona.md
  assets/
  shared/                         # optional cross-runtime contracts
  skills/                         # canonical skills shared by runtimes
  agents/                         # canonical agents
  lib/                            # optional Codex/root helpers
  tests/                          # optional Codex/root tests
  claudecode/
    hooks/
    lib/
    tests/
```

Root skills read the plugin persona with `../../persona.md`. Skill frontmatter names are local (`name: write-spec`), not plugin-qualified; the runtime exposes them as `<plugin>:<skill>`. New scaffolding must not create duplicate runtime skill trees under `<plugin>/codex/` or `<plugin>/claudecode/skills/`.

## Stack & tooling

- **Runtime hooks/scripts**: Node.js, **ESM** (`import` / `export`). **`.mjs`** extension is mandatory for hooks and tests (zero ambiguity for Node, no `package.json` needed in the plugin, plugin is self-contained regardless of install context). `saucy-status` stays on CJS for historical reasons. Every new plugin ships ESM `.mjs`. Reference: `linear-devotee/claudecode/hooks/*.mjs`; Codex discovers plugin hooks through `<plugin>/hooks/hooks.json`, which may point at shared runtime scripts.
- **Package manager**: `bun@1.3.x` (declared in root `package.json`).
- **Tests**: `bun test` (built-in, no dep added). Claude Code tests live in `<plugin>/claudecode/tests/`; Codex/root helper tests live in `<plugin>/tests/`.
- **Lint/format**: `oxlint` (config in `.oxlintrc.json`) and `oxfmt` (config in `.oxfmtrc.json`). Local rule: empty blocks are allowed when intentional; use `catch {}` (not `catch (e)`) when the binding is unused.
- **Pre-commit**: `lefthook` runs `bun run lint` and `bun run fmt:check`. **Never bypass** with `--no-verify`.
- **No npm/bun deps added** in plugins. Stick to `node:fs`, `node:path`, `node:os`, `node:child_process`. If a plugin really needs a dep, raise it first.

---

## Pre-push verification

```bash
bunx bun test <plugin>/                    # all plugin tests pass
(cd .claude/hooks/tests && bunx bun test)  # persona-roulette tests pass
bun run test:meta                          # frontmatter model/effort values valid
bun run lint                                # lint clean
bun run fmt:check                           # format clean
node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json', 'utf8'))"  # Claude Code marketplace JSON valid
node -e "JSON.parse(require('node:fs').readFileSync('.agents/plugins/marketplace.json', 'utf8'))"  # Codex marketplace JSON valid (codex/both plugins MUST be registered here too — else invisible to Codex)
bun run bump:shas                          # marketplace.json sha pins up-to-date vs origin/main (see _adr/0002-marketplace-sha-pinning.md)
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

| Plugin           | What                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Hooks                          | Skills                                                                                           | Agents                                                                                                  | Persona                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | --------------------------- |
| `saucy-status`   | Saucy/gooning loading messages in statusline                                                                                                                                                                                                                                                                                                                                                                                                                      | SessionStart, UserPromptSubmit | —                                                                                                | —                                                                                                       | `saucy-status/persona.md`   |
| `subroutine`     | Implementation discipline for TS monorepos. One stack-aware `implement` skill (React + Hono) bound to a `shared/` contract (type-safety, Result/unwrap, Zod validation, code-organisation). Explores before editing via `explorer`, defers to the repo's own `AGENTS.md`, verifies via the project toolchain (moon-aware).                                                                                                                                        | —                              | `implement`                                                                                      | `explorer`                                                                                              | `subroutine/persona.md`     |
| `linear-devotee` | Linear issue detection at session start + cascading Project/Milestone/Issue creation, all SDD-formatted                                                                                                                                                                                                                                                                                                                                                           | SessionStart, UserPromptSubmit | `greet`, `plan`, `create-project`, `create-milestone`, `create-issue`                            | `issue-context`, `issue-drafter`, `milestone-drafter`, `plan-auditor`, `plan-writer`, `project-drafter` | `linear-devotee/persona.md` |
| `acid-prophet`   | Spec-driven development pipeline. Q&A → spec → `spec-auditor` audit with Phase -1 gates → optional `write-plan` (plan.md + contracts/ + quickstart.md) → handoff to `linear-devotee` or `subroutine`. Project-specific articles via `write-constitution` become extra gates. PR-time drift via `check-drift`; per-spec acceptance checklist via `write-checklist`. `[NEEDS CLARIFICATION:...]` markers force the prophet to flag uncertainty instead of inventing | —                              | `write-constitution`, `write-spec`, `audit-spec`, `write-plan`, `write-checklist`, `check-drift` | `spec-auditor`                                                                                          | `acid-prophet/persona.md`   |
| `warden`         | Centralized voice agent — emits decorative persona lines for any plugin via `warden:voice`; `/warden:voice [on\|off\|status]` toggles fun messages globally                                                                                                                                                                                                                                                                                                       | —                              | `voice`                                                                                          | `voice`                                                                                                 | `warden/persona.md`         |
| `git-gremlin`    | Commit + PR drafting with scoped mutation gates. Reads staged diff / git log via subagents, proposes conventional commit messages and PR descriptions, executes only on approval. Also enforces one-workspace-per-branch: a `PreToolUse` hook intercepts in-place branch creation and redirects to `spawn` (Superset workspace + fresh agent)                                                                                                                     | PreToolUse (Bash)              | `commit`, `pr`, `spawn`                                                                          | `commit-drafter`, `pr-drafter`                                                                          | `git-gremlin/persona.md`    |
| `lore-hound`     | Source-hunting research harness: fan-out web search → fetch + summarize → adversarial verification → cited synthesis. Zero parametric knowledge — answers only from verified sources.                                                                                                                                                                                                                                                                             | —                              | `research`                                                                                       | `source-fetcher`, `claim-verifier`                                                                      | `lore-hound/persona.md`     |
| `stack-golem`    | Notom-stack ops & debug toolbox — Scaleway resource control (`scw`), platform observability (logs/metrics/health on staging+prod), local dev debugging, Insomnia collection sync. Investigate-first, CLI-driven, never punts to the console.                                                                                                                                                                                                                      | —                              | `debug-local`, `observe-platform`, `drive-scaleway`, `sync-insomnia`                             | `platform-scout`                                                                                        | `stack-golem/persona.md`    |
| `moon-moth`      | Moon-aware loop engine for TypeScript monorepos. Scopes work to the `affected` project graph (`moon query`), verifies via affected `:typecheck`/`:lint`/`:test` (evidence over assertion), and wires any moon repo via `init`. Does **not** implement — hands off to `subroutine`. SessionStart hook injects affected scope when a `.moon/` workspace is detected.                                                                                                | SessionStart                   | `scope`, `verify`, `init`                                                                        | `affected-scout`, `verify-runner`, `change-auditor`                                                     | `moon-moth/persona.md`      |

Repo-level: `.claude/hooks/persona-roulette.mjs` picks a random `persona.md` at SessionStart for the current session's default voice (see "Persona Roulette" section above). Local scaffold skills live at `.claude/skills/{scaffold-plugin,scaffold-skill,scaffold-agent}/SKILL.md` with shared `mad-scientist` voice at `.claude/skills/persona.md`.

Architecture Decision Records live in `_adr/`, numbered sequentially (`NNNN-kebab-case-title.md`):

- `_adr/0001-frontmatter-model-effort-tiering.md` — cognitive-load tiering applied to every skill and agent's `model` / `effort` frontmatter. Read before adding a new skill or agent.
- `_adr/0002-marketplace-sha-pinning.md` — every `git-subdir` entry in `.claude-plugin/marketplace.json` carries an explicit `sha` to stop the install registry from desyncing. Run `bun run bump:shas` after any merge to `main` that touches a plugin subdir.

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
