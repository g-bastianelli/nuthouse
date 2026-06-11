---
name: moon-commands
description: Canonical `moon` CLI invocations for scoping and running tasks in a moon monorepo — the single source of truth every moon-moth skill and agent uses for `moon query` and `moon run`. Background knowledge contract, preloaded into moon-moth agents; not a user-facing workflow.
user-invocable: false
---

# moon-moth — canonical moon commands

Single source of truth for the `moon` invocations every moon-moth skill and
agent uses. Reference this contract instead of re-deriving commands. All
commands run from the moon workspace root (the dir containing `.moon/`).

> Verified against **moon 2.2.4**. `moon query <sub>` emits **JSON on stdout
> natively** — there is no `--json` flag. CLI flags are kebab-case
> (`--default-branch`, not `--defaultBranch`).

## Detecting scope (what changed, what's affected)

| Goal                                       | Command                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Files changed in the working tree          | `moon query changed-files --local`                                 |
| Files changed vs the default branch        | `moon query changed-files --default-branch`                        |
| Files changed between two revisions        | `moon query changed-files --base <sha> --head <sha>`               |
| Affected projects + tasks (working tree)   | `moon query affected`                                              |
| Affected incl. downstream dependents       | `moon query affected --downstream deep`                            |
| Affected incl. upstream dependencies first | `moon query affected --upstream deep`                              |
| Affected projects only, via project graph  | `moon query projects --affected`                                   |
| Enumerate projects by metadata             | `moon query projects --layer <layer> --stack <stack> --tags <tag>` |
| One project's id/source/deps               | `moon query projects --id <id>`                                    |

`--upstream` (alias `--dependencies`) = the project's own deps; `--downstream`
(alias `--dependents`) = projects that depend on it. Each takes `none` / `direct`
/ `deep` (default `none`). The `[BY]` positional on `moon query affected` accepts
explicit conditions; omit it to track affected from VCS-changed files.

**Scoping rule of thumb:** to know _what to re-verify_ after a change, use
`--downstream deep` (everything that could break). To know _what must build
first_, use `--upstream deep`.

## Running tasks (scoped, never repo-wide unless asked)

| Goal                                | Command                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| One task on one project             | `moon run <project>:<task>`                                              |
| One task across affected projects   | `moon run :<task> --affected`                                            |
| Affected + their dependents         | `moon run :<task> --affected --downstream deep`                          |
| Affected via graph relations        | `moon run :<task> --affected --include-relations`                        |
| By tag                              | `moon run '#<tag>:<task>'`                                               |
| By query filter                     | `moon run :<task> --query="projectLayer=library && language=typescript"` |
| Force, bypass cache                 | `moon run <project>:<task> --force`                                      |
| CI-style affected check (base/head) | `moon ci :lint :typecheck :test --base <sha> --head <sha>`               |

## Notes

- moon caches by task `inputs`/`outputs` hashing — a re-run of an unchanged task
  is a cache hit. Trust the cache; don't `--force` a full rebuild without reason.
- `moon ci` auto-detects affected, respects `runInCI`, and writes
  `.moon/cache/ciReport.json`.
- Never substitute `bun run`, `bunx`, or per-package npm scripts for a moon task
  — moon injects the project's `node_modules/.bin` into PATH and handles deps.
- `moon query` JSON is the contract surface for agents. Parse stdout as JSON;
  do not scrape human-formatted task output.
