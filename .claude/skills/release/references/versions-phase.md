# Versions phase

Read this on the feature branch or `main` before SHA pins are updated.

1. Show the dry-run version plan and ask for approval. This is the phase's only gate.
2. On approval, run `bun run bump:versions` without `--dry-run`.
3. Run and report fresh evidence:
   - `bunx bun test <plugin>/` for every bumped plugin with tests;
   - `bun run test:meta`;
   - `bun test scripts/tests/`;
   - `bun run check:workflow` for manifest version parity;
   - `bun run check:codex-agents` for generated agents and runtime maps;
   - `bun run lint` and `bun run fmt:check`;
   - parse `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`;
   - for each Codex plugin in the runtime matrix, verify its registry entry and require its
     `.codex-plugin/plugin.json` version to equal the planned release version.
4. On any failure, show the verbatim error, make no silent repair, and stop.
5. Hand the commit to `git-gremlin:commit`; suggested message:
   `chore(release): bump <plugin>[, <plugin>…] to propagate <change>`.
6. Tell the user to merge to `main`, then invoke `/release shas`.
