---
name: init
description: Use to wire a moon TypeScript monorepo for a moon-aware agentic dev loop — generates path-scoped `.claude/rules/`, a moon-command allowlist and plan-default in settings, a cache Read-deny, and a short moon-loop section in the repo's agent contract (AGENTS.md/CLAUDE.md). Idempotent and confirmation-gated; merges into existing config instead of clobbering. Run once per repo to make Claude Code + Codex fast and precise in that monorepo.
effort: high
---

# init

## Voice

Read `../../persona.md` at the start of this skill. The moon-moth voice is
canonical for wrapper lines; previews and reports stay plain.

**Scope:** local to this skill's execution only; revert to the session default
voice after the final report.

This skill is **rigid** — execute steps in order. Writing into the user's repo
is a mutation: it happens **only after the user approves the preview**.

## Language

Adapt chat output to the user's language. Generated files, code, and config keys
stay English / original form.

## When you're invoked

A moon monorepo should be made "moon-aware" for agents: scope-first exploration,
plan-by-default, a moon-command allowlist (fewer permission prompts), and a short
loop contract that tells any agent (Claude Code or Codex) to use the moon-moth
loop. Run once per repo; safe to re-run (idempotent merge).

## Step 0 — Preconditions

1. Find the moon workspace root (`.moon/` up-tree). Abort if absent: this skill
   only wires moon repos.
2. Capture `PROJECT_ROOT` = moon root (= git root in a standard moon repo).
3. Detect what already exists so the merge is non-destructive:
   - `${PROJECT_ROOT}/.claude/settings.json`
   - `${PROJECT_ROOT}/.claude/rules/`
   - `${PROJECT_ROOT}/AGENTS.md` and/or `${PROJECT_ROOT}/CLAUDE.md`
   - Read the repo's existing agent contract so the generated content matches its
     conventions (do not duplicate rules already stated there).

## Step 1 — Build the wiring plan (preview, no writes yet)

Compose the set of changes, each shown as a unified-diff-style preview. Components:

1. **`.claude/settings.json` (merge):**
   - `permissions.defaultMode: "plan"` — explore-before-edit by default.
   - `permissions.allow`: append `"Bash(moon run:*)"`, `"Bash(moon query:*)"`,
     `"Bash(moon ci:*)"`, `"Bash(moon check:*)"` — moon is the task runner, these
     are safe and high-frequency.
   - `permissions.deny`: append `"Read(./.moon/cache/**)"`, `"Read(**/dist/**)"`,
     `"Read(**/node_modules/**)"` — keep generated/build output out of context.
   - Preserve every existing key; only add what's missing.

2. **`.claude/rules/moon-loop.md`** — a path-scoped rule (frontmatter
   `paths: ["**/*.ts", "**/*.tsx"]`) that loads only when touching TS, stating the
   moon-moth loop: scope (`moon-moth:scope`) → implement (TDD) → verify
   (`moon-moth:verify`, affected tasks), and "never run `bun run`/`bunx`/raw tools
   — always `moon run`". Keep it short; do not restate the repo's full contract.

3. **Agent contract nudge** — if the repo uses `AGENTS.md` as its canonical
   contract, append a short "## Moon-aware dev loop" section (≤10 lines) pointing
   at the moon-moth skills and the affected-first discipline. If the repo only has
   `CLAUDE.md`, add it there. Skip if an equivalent section already exists.

4. **(optional) Stop-hook reminder** — offer, but default OFF, a lightweight
   `.claude/hooks/moon-verify-reminder.mjs` (Stop hook) that, when the working
   tree has changes in affected projects, prints a one-line reminder to run
   `moon-moth:verify`. It never runs tasks itself (no slow/expensive auto-runs).
   Only write it if the user opts in.

## Step 2 — Approval gate

Present the full preview and ask: _"j'écris ce câblage ? (y / décris quoi
retirer / stop)"_. Do not write anything until the user approves. This is the
single mutation gate.

## Step 3 — Apply (merge, idempotent)

On approval, write/merge each approved component. For `settings.json`, parse the
existing JSON, merge arrays without duplicating entries, and re-validate it
parses before finishing. Never clobber an existing key's value.

## Step 4 — Final report

```text
moon-moth:init report
  Repo:        ${PROJECT_ROOT}
  settings:    <created | merged> — defaultMode=plan, moon allowlist (+N), deny (+M)
  rules:       .claude/rules/moon-loop.md <created | skipped (exists)>
  contract:    <AGENTS.md | CLAUDE.md> moon-loop section <added | already present>
  stop-hook:   <installed | skipped>
  Next:        run moon-moth:scope on your first task in this repo
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Write any file before the Step 2 approval gate.
- Clobber an existing `settings.json` key or an existing rule — merge only.
- Duplicate rules the repo's contract already states.
- Install a hook that runs heavy tasks automatically (reminders only, opt-in).
- Mutate external services without explicit user confirmation.
