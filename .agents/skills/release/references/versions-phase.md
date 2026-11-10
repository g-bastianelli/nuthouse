# Versions phase

Read this on the feature branch or `main` before SHA pins are updated.

1. Show the complete dry-run release set and planned version writes. Reuse explicit release
   authorization for this scope; ask only if the proposed release includes unapproved changes.
2. Run `bun run bump:versions` without `--dry-run` for pending bumps. Already-bumped and new
   plugins remain in the verification set; no second bump is needed after an interrupted run.
3. Run and report fresh evidence:
   - `bunx bun test <plugin>/` for every plugin in the release set with tests;
   - `bun run test:meta`;
   - `bun test scripts/tests/`;
   - `bun run check:skills`;
   - `bun run check:workflow` for manifest version parity;
   - `bun run check:codex-agents` for generated agents and runtime maps;
   - `bun run lint` and `bun run fmt:check`;
   - parse `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`;
   - for each Codex plugin in the runtime matrix, verify its registry entry and require its
     `.codex-plugin/plugin.json` version to equal the planned release version.
4. On any failure, show the verbatim error, make no silent repair, and stop.
5. Hand outstanding release changes to `git-gremlin:commit`; skip an empty commit when the bump
   already landed on this branch. Suggested message:
   `chore(release): bump <plugin>[, <plugin>…] to propagate <change>`.
6. Tell the user to merge to `main`, then invoke `/release shas`.
