# ADR 0004 — Bump plugin versions on every content release

- **Status**: Accepted
- **Date**: 2026-06-11
- **Scope**: `<plugin>/.claude-plugin/plugin.json`, `<plugin>/.codex-plugin/plugin.json`, `scripts/bump-plugin-versions.mjs`, the `/release` local skill.

## Context

ADR 0002 pinned a `sha` on every `git-subdir` marketplace entry to stop the
plugin cache from self-invalidating. The pin froze _which_ commit installs
resolve — but it left the question of _when existing installs receive an
update_ unanswered, and the answer turned out to be: never, unless the plugin
`version` changes.

Observed on 2026-06-11 while shipping the dynamic-context caveat fix
(`7815c55`):

- `claude plugin update <plugin>@nuthouse` compares the **`version`** field in
  `plugin.json`, not the pinned sha. Same version → "already at the latest
  version", even though the pin had moved to a newer commit.
- The cache is keyed by version: `~/.claude/plugins/cache/nuthouse/<plugin>/<version>/`.
  Removing and re-adding the whole marketplace **reused the stale version-keyed
  cache directory** instead of re-cloning the pinned sha — the broken content
  came back even though the marketplace clone and its pins were current.

In short: the sha pin decides _what_ gets installed on a cache miss; the
version decides _whether_ the updater (or a reinstall) ever produces a cache
miss. A content change shipped with only a sha bump is an invisible release.

## Decision

Every release that changes plugin content bumps the plugin's **patch version**
in both manifests (`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`,
kept identical), **before** the sha pins are bumped.

Tooling:

- `scripts/bump-plugin-versions.mjs` (`bun run bump:versions`, `--dry-run`
  supported) detects changed plugins by comparing each subdir's last-touching
  commit (plus working-tree dirt) against its marketplace `sha` pin, and bumps
  the patch version unless the version already moved since the pin. Idempotent.
  Tested in `scripts/tests/` (`bun run test:scripts`).
- The local `/release` skill orchestrates the ordering: phase `versions`
  (bump + verification battery + commit via `git-gremlin:commit`) on the
  feature branch, then phase `shas` (`bun run bump:shas` + commit) on `main`
  after the merge.

The detection window is the sha pin itself — which is exactly why the ordering
rule is iron: once `bump:shas` runs, `bump:versions` sees "unchanged" and the
release window is gone. Versions first, shas last.

### Rejected alternatives

- **Bump versions automatically inside `bump:shas`** — the two run at
  different times (pre-merge vs post-merge) and against different refs; fusing
  them recreates the ordering bug it should prevent.
- **Key releases on versions only, drop sha pins** — reintroduces the ADR 0002
  cache self-invalidation on every commit touching a subdir.
- **CI enforcement (fail the PR when a subdir changes without a version
  bump)** — good follow-up, postponed until the manual `/release` cadence
  proves insufficient.

## Consequences

- **Pro**: `claude plugin update` actually delivers releases to existing
  installs; no more marketplace remove/re-add voodoo.
- **Pro**: the version-keyed cache directory changes on every release, so a
  fresh clone of the pinned sha is guaranteed.
- **Con**: one more mechanical step per release — mitigated by `/release`
  doing the whole dance.
- **Note**: users still need `claude plugin update` (or a session restart
  after the marketplace refresh) to pick a release up; that part is unchanged.
