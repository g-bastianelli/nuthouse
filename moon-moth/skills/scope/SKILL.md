---
name: scope
description: Inspect branch and working-tree changes in a configured moon monorepo and report the affected projects. Use for cross-project work or before broad checks; do not invoke merely because a task starts.
allowed-tools: Bash(moon query:*), Bash(moon --version), Bash(git status:*), Read
---

# scope

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope
ends at the final report.

## Outcome

Return a concise, read-only view of the affected projects. Run the moon query directly: do
not delegate, persist a scope map, create a ledger, or present a handoff menu.

## Workflow

1. Walk upward from the current directory to the nearest real workspace config. It is a
   `workspace.{json,jsonc,hcl,pkl,toml,yml,yaml}` file under `.moon/` or `.config/moon/`.
   A bare `.moon/` directory is not a workspace. If none exists, say the skill does not
   apply and stop.
2. Run `moon --version` from that root. If it fails, report that moon is unavailable and
   stop.
3. Run `git status --porcelain`, then pipe the branch comparison into the project query:

   ```sh
   moon query changed-files | moon query projects --affected --downstream deep
   ```

   When the worktree is dirty, additionally run the same pipeline with
   `moon query changed-files --local` and union the two project sets. For explicit revisions,
   use `--base <base> --head <head>` on the first query. Parse the JSON rather than scraping
   formatted output or guessing metadata.

4. Report the affected project ids, available verification tasks, and downstream dependents.
   If the combined set is empty, say so and stop; an empty diff is not a reason to invent
   planned scope.

Stay read-only. Never scan unrelated projects once moon provides an affected set, and never
run commit, push, or rebase commands.
