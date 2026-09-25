---
name: release
description: >-
  Use when releasing nuthouse plugin changes to Claude Code and Codex users —
  "release", "ship la release", "publie les plugins", "bump les versions", or after
  merging a plugin-touching PR. Detects changed plugins via the marketplace sha
  pins, bumps plugin versions BEFORE sha pins, verifies both runtime manifests and
  registries, reports both refresh paths, and hands each commit to
  git-gremlin:commit. Two auto-detected phases: versions (pre-merge, on the feature
  branch) and shas (post-merge, on main).
argument-hint: [versions|shas]
allowed-tools: Read, Glob, Bash, Skill
---

# release

## Voice

Read `../persona.md` at the start of this skill. The voice defined there
(mad-scientist) is canonical and applies to all output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed, revert to the session's default voice.

This skill is **rigid** — execute the steps in order.

## Preflight context

At the start of every invocation, read the current branch and working-tree status, then run
`node scripts/bump-plugin-versions.mjs --dry-run`. Use the live output to select the phase; do not
assume context from a previous invocation.

```text
git branch --show-current
git status --porcelain
node scripts/bump-plugin-versions.mjs --dry-run
```

Nuthouse has two release phases because Claude Code discovers releases by plugin version,
while the marketplace pins merged content by SHA. Therefore versions always land before
SHA pins, and every cross-runtime release verifies and reports both runtimes.

## Workflow

1. Preflight:
   - Run `git fetch origin main --quiet`.
   - Start a runtime matrix for every plugin in the version bump plan. In phase **shas**, complete it from the `bump:shas` output and resulting diff before reporting:
     - **Claude Code** requires `<plugin>/.claude-plugin/plugin.json` plus an entry in `.claude-plugin/marketplace.json`.
     - **Codex** requires `<plugin>/.codex-plugin/plugin.json` plus an entry in `.agents/plugins/marketplace.json`.
     - A plugin that declares both manifests must appear in both registries. Any missing manifest/registry pair is a release failure; report it and stop.
   - Identify the phase from the invocation argument if given (`versions` or `shas`); otherwise
     auto-detect:
     - The version bump dry-run lists pending bumps → phase **versions**.
     - No pending bumps, on `main`, up to date with `origin/main` → phase **shas**.
     - Neither → report that there is nothing to release and stop.
2. For phase **versions**, read
   [`references/versions-phase.md`](references/versions-phase.md) and complete it before
   reporting or moving to SHA pins.
3. For phase **shas**, read [`references/shas-phase.md`](references/shas-phase.md). This
   phase runs only on up-to-date `main` after the version-bump commit landed.
4. Final report (see format below). Never push — pushing stays a user action.

## Hard rules

- **Versions before shas, always.** Running `bump:shas` while a content change has no version bump ships an invisible release. If the sha pins are already ahead of the versions (the plan shows nothing but plugin content changed since the last installed release), bump the affected versions manually with `bumpPatch` semantics and say so.
- **Both runtimes, every time.** Never call a cross-runtime release complete when either the Claude Code or Codex manifest, registry validation, runtime coverage, or user refresh instruction is missing.
- Never invent `codex plugin update`; that command does not exist. Existing Codex installs refresh with `codex plugin marketplace upgrade nuthouse` and a new session. First installs additionally use `codex plugin add <plugin>@nuthouse`.
- Never run `git commit`, `git push`, or `git rebase` directly — commits go through `git-gremlin:commit`, pushes stay with the user.
- Never bypass lefthook with `--no-verify`.
- Report failing checks with their verbatim output; no silent retries, no silent fixes.
- Re-running the skill must be safe: both scripts are idempotent.

## Phase references

Read exactly one phase reference per invocation after preflight. Never preload the other
phase merely to summarize it.

## Final report

```text
release report
  Phase:        versions | shas | nothing-to-release
  Bumped:       <plugin>@<old> → <new> (one line per plugin, or none)
  Claude Code:  <covered plugin names | none>
  Codex:        <covered plugin names | none>
  Verification: <each check: pass/fail>
  Commit:       <sha or "handed to git-gremlin:commit" or none>
  Next step:    merge PR then /release shas | push main
  User refresh: Claude Code: claude plugin update <plugin>@nuthouse + restart
                Codex: codex plugin marketplace upgrade nuthouse + new session
                Codex first install only: codex plugin add <plugin>@nuthouse
```
