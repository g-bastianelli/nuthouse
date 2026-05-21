# ADR 0002 — Pin `sha` on every `git-subdir` marketplace entry

- **Status**: Accepted
- **Date**: 2026-05-21
- **Scope**: `.claude-plugin/marketplace.json` and the bump tooling in `scripts/`.

## Context

The nuthouse marketplace declares 5 of its 6 plugins via `source: git-subdir` (only `saucy-status` is local with `./saucy-status`). For each `git-subdir` install, Claude Code caches the plugin under `~/.claude/plugins/cache/nuthouse/<plugin>/<commitSha12>-<contentHash8>/`. The `<contentHash8>` is recomputed at each session start by re-cloning the subdir sparsely (`--filter=tree:0`).

When **any** commit touches a subdir, the `<contentHash8>` changes. Claude Code then marks the previously installed version stale, deletes the entry from `~/.claude/plugins/installed_plugins.json`, and attempts a fresh install. If that install is interrupted (network blip, concurrent session, partial clone failure — orphaned `temp_subdir_*.clone` directories have been observed), the registry stays empty while `settings.json:enabledPlugins` still has `"X@nuthouse": true`. The `/plugins` UI then surfaces `Plugin "X" not cached at (not recorded)` for every affected plugin, even though the binary cache exists on disk.

The trigger event was commit `e8a4b72` (root-runtime layout refactor) which moved every plugin's files in bulk. All five `git-subdir` plugins invalidated at once. From that point on, the registry has been unstable on every plugin-touching commit.

The Claude Code marketplace schema documents a `sha` field on `git-subdir` sources (https://code.claude.com/docs/en/plugin-marketplaces — "Plugin sources" table): `git-subdir` supports `url`, `path`, `ref?`, `sha?`. Pinning `sha` to a specific 40-char hex commit freezes the resolved version until an explicit bump.

## Decision

Every `git-subdir` entry in `.claude-plugin/marketplace.json` carries an explicit `sha` field set to the last commit on `origin/main` that touched the plugin's subdir.

A script `scripts/bump-marketplace-shas.mjs`, exposed as `bun run bump:shas`, recomputes all five shas in one pass and patches the manifest in place. It is **idempotent** — no diff is produced if every sha already matches `git log -1 --format=%H origin/main -- <plugin>/`. The reference can be overridden via `BUMP_REF` (e.g. `BUMP_REF=HEAD bun run bump:shas` for a local check).

### Rejected alternatives

- **`ref: "main"` (branch tracking)** — does not fix the problem. The `<contentHash8>` would still be recomputed on every session start since the resolved commit changes whenever main moves.
- **`ref: <tag>` (tag-based pinning)** — equivalent to `sha` in effect but requires tagging every release. Higher maintenance burden than a one-line script bump.
- **Full automation via GitHub Actions** — possible (workflow that recomputes shas on every push to main and commits the result with `[skip ci]`). Postponed: opt-in if the manual bump cadence becomes painful.
- **Drop `git-subdir` entirely (one repo per plugin)** — would eliminate the contentHash mechanic but kill the monorepo (shared lint, fmt, lefthook, runtime bundle). Not worth it for this scale.

## Maintenance workflow

After any merge to `main` that touches one or more plugin subdirs:

```bash
git checkout main && git pull
bun run bump:shas              # patches marketplace.json if needed
git commit -am "chore(marketplace): bump shas after <change>"
git push                       # or open a PR per the standard workflow
```

If nothing changed (the touched commit was outside any plugin subdir — for example a tooling or root-doc change), the script exits silently with no diff.

## Consequences

- **Pro**: Plugin caches stop self-invalidating. The install registry stays consistent across sessions.
- **Pro**: Every plugin install resolves a known-good commit. Reproducible across machines.
- **Pro**: The bump script keeps maintenance to one command — no manual sha lookup.
- **Con**: One additional commit per release that touches a plugin. Acceptable at the current cadence.
- **Con**: Users on a stale clone of the marketplace see stale plugins until they `/plugin marketplace update nuthouse`. This was already true before — pinning does not make it worse.
