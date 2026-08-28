<!--
  PR title MUST be a Conventional Commit: <type>(<scope>): <subject>
  Scope is the plugin name (`feat(moon-moth): …`) or a repo-level area
  (`marketplace`, `scripts`, `release`, `ci`, `docs`). An optional trailing
  Linear key stays uppercase: [NOT-123].

  The repo is squash-only and the merge commit is built from this PR: title
  becomes the subject, body becomes the message. Keep the body worth reading
  in `git log` — trim the checklist and any empty section before merging.

  Base branch: `main` — this repo has no staging.
  After the squash-merge, run `/release` phase 2 on `main` (`bun run bump:shas`,
  see _adr/0002-marketplace-sha-pinning.md).
-->

## What & why

<!--
  What does this change and, more importantly, why.
  Replace the example below with the full Linear issue URL when one exists —
  it is what links the PR back to Linear. Remove the line otherwise.
-->

Linear: <!-- https://linear.app/notom/issue/NOT-123/issue-slug -->

## How to verify

<!-- The check that proves it works: a test, a command, repro steps. -->

## Checklist

- [ ] PR title is a valid Conventional Commit, scoped as above
- [ ] The **Pre-push verification** block in `CLAUDE.md` is green locally (that block is the canonical list — don't restate it here)
- [ ] Both marketplace registries updated for a `codex`/`both` plugin (`.claude-plugin/marketplace.json` **and** `.agents/plugins/marketplace.json`)
- [ ] Plugin `version` bumped in both manifests when shipping content — `/release` phase 1, see `_adr/0004-plugin-version-bump-on-release.md`
- [ ] Every plugin file is in English; the voice lives in `<plugin>/persona.md`
- [ ] Pre-commit hook was **not** bypassed with `--no-verify`
