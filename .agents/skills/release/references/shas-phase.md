# SHA-pin phase

Read this only on up-to-date `main` after the version-bump commit has landed.

1. Run `bun run bump:shas`. It updates Claude Code SHA pins only; the Codex registry has
   no `sha` field.
2. Reparse `.agents/plugins/marketplace.json` and verify every released Codex plugin in the
   runtime matrix still uses its expected `./<plugin>` path.
3. If there is no diff, the pins are current; continue to the final report.
4. If there is a diff, hand the commit to `git-gremlin:commit` with message shape
   `chore(marketplace): bump shas after <change>`.
