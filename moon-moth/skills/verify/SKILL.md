---
name: verify
description: Run moon typecheck, lint, and test tasks for affected projects after edits. Use only in a configured moon workspace; report fresh command evidence without adding review or handoff ceremony.
allowed-tools: Bash, Read
---

# verify

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope
ends at the final report.

## Outcome

Verify the current change through moon's affected graph and report the real result. Execute
the checks directly: do not delegate, run an additional code-review pass, write a ledger, or
present commit/PR menus.

## Workflow

1. Walk upward to the nearest real workspace config. It is a
   `workspace.{json,jsonc,hcl,pkl,toml,yml,yaml}` file under `.moon/` or `.config/moon/`.
   A bare `.moon/` directory is not a workspace. If none exists, say the skill does not
   apply and stop; repository-native verification belongs to the repository's normal
   workflow.
2. Run `moon --version`, then `moon query affected --downstream deep` from the workspace
   root. If moon is unavailable or no project is affected, report that no verification ran;
   do not claim success.
3. From the query JSON, collect every affected project id, including downstream projects,
   and the `typecheck`, `lint`, and `test` tasks each project actually defines. If task
   metadata is absent, resolve it with `moon query projects --id <project>`. Unless the user
   requested narrower checks, run the applicable targets explicitly for every project, for
   example:

   ```sh
   moon run app-a:typecheck app-a:lint app-a:test app-b:typecheck app-b:test
   ```

   Never rely on `:<task> --affected --downstream deep` to cover downstream projects: moon
   may omit their tasks unless task dependencies connect them. Trust moon's cache. Do not
   replace moon tasks with raw package-manager, compiler, linter, or test-runner commands.

4. Report the exact targets and a per-project pass/fail summary. Name affected projects with
   no applicable task. Include the relevant failing output verbatim. Verification succeeds
   only when every applicable target ran after the last edit and exited successfully;
   otherwise state what remains unverified.

Verification is read-only apart from build and test outputs created by moon. Never edit
source files, commit, push, or rebase from this skill.
