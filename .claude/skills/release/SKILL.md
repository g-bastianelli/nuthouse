---
name: release
description: Use when releasing nuthouse plugin changes to installed users — "release", "ship la release", "publie les plugins", "bump les versions", or after merging a plugin-touching PR. Detects changed plugins via the marketplace sha pins, bumps plugin versions BEFORE sha pins (a content change without a version bump is invisible to existing installs — the plugin cache is keyed by version), runs the pre-push verification, and hands each commit to git-gremlin:commit. Two auto-detected phases: versions (pre-merge, on the feature branch) and shas (post-merge, on main).
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

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`
- Working tree: !`git status --porcelain | head -20`
- Version bump plan: !`node scripts/bump-plugin-versions.mjs --dry-run 2>&1 | head -15`

## Why this skill exists

Claude Code keys the plugin cache by **version** (`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`) and `claude plugin update` compares **versions**, not sha pins. A content change shipped with only a sha bump is therefore invisible to every existing install — update no-ops, and even a marketplace reinstall reuses the stale version-keyed cache directory. See `_adr/0004-plugin-version-bump-on-release.md`. The cure is an iron ordering rule: **versions first, shas last.**

## Workflow

1. Preflight:
   - Run `git fetch origin main --quiet`.
   - Identify the phase from `$ARGUMENTS` if given (`versions` or `shas`); otherwise auto-detect:
     - The `Version bump plan` line in `## Context` lists pending bumps → phase **versions**.
     - No pending bumps, on `main`, up to date with `origin/main` → phase **shas**.
     - Neither → report that there is nothing to release and stop.
2. Phase **versions** (feature branch or main, before sha bump):
   - Show the dry-run plan from `## Context` to the user and ask for approval (this is the only gate — one question).
   - On approval, run `bun run bump:versions` (no `--dry-run`).
   - Run the verification battery and show evidence, not assertion:
     - `bunx bun test <plugin>/` for every bumped plugin that has tests
     - `bun run test:meta`
     - `bun test scripts/tests/`
     - `bun run lint` and `bun run fmt:check`
     - parse both registries: `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`
   - Any failure → report verbatim output, fix nothing silently, stop and ask.
   - Hand off the version-bump commit to the `git-gremlin:commit` skill (it owns the mutation gate). Suggested message shape: `chore(release): bump <plugin>[, <plugin>…] to propagate <change>`.
   - Tell the user the next move: merge to `main` (squash PR per repo workflow), then re-invoke `/release shas`.
3. Phase **shas** (on up-to-date `main`, after the version-bump commit landed):
   - Run `bun run bump:shas`.
   - No diff → everything already pinned; skip to the final report.
   - Diff → hand the commit to `git-gremlin:commit` (message shape: `chore(marketplace): bump shas after <change>`).
4. Final report (see format below). Never push — pushing stays a user action.

## Hard rules

- **Versions before shas, always.** Running `bump:shas` while a content change has no version bump ships an invisible release. If the sha pins are already ahead of the versions (the plan shows nothing but plugin content changed since the last installed release), bump the affected versions manually with `bumpPatch` semantics and say so.
- Never run `git commit`, `git push`, or `git rebase` directly — commits go through `git-gremlin:commit`, pushes stay with the user.
- Never bypass lefthook with `--no-verify`.
- Report failing checks with their verbatim output; no silent retries, no silent fixes.
- Re-running the skill must be safe: both scripts are idempotent.

## Final report

```text
release report
  Phase:        versions | shas | nothing-to-release
  Bumped:       <plugin>@<old> → <new> (one line per plugin, or none)
  Verification: <each check: pass/fail>
  Commit:       <sha or "handed to git-gremlin:commit" or none>
  Next step:    merge PR then /release shas | push main | users: claude plugin update <plugin>@nuthouse + restart
```
