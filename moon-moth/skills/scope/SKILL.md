---
name: scope
description: Inspect current changes in a configured moon monorepo and report the affected projects. Use for cross-project work or before broad checks; do not invoke merely because a task starts.
allowed-tools: Bash(moon query:*), Bash(moon --version), Read
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
3. Run `moon query affected --downstream deep`. Parse the JSON output rather than scraping
   formatted text or guessing project metadata. Run `moon query changed-files --local`
   only when the user asks for the exact local files.
4. Report the affected project ids, available verification tasks, and downstream dependents.
   If nothing is affected, say so and stop; an empty diff is not a reason to invent planned
   scope.

Stay read-only. Never scan unrelated projects once moon provides an affected set, and never
run commit, push, or rebase commands.
