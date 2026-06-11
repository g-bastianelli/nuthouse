---
name: affected-scope
description: The scope map JSON contract moon-moth skills and agents exchange — schema and field rules for the affected project set (ids, layers, stacks, tasks, downstream blast radius) computed from `moon query`. Background knowledge contract, preloaded into moon-moth agents; not a user-facing workflow.
user-invocable: false
---

# moon-moth — affected scope contract

The **scope map** is the structured artifact the `affected-scout` agent returns
and the `scope` / `implement` / `verify` skills consume. It is the moon-moth's
field of light: the exact set of projects the moth will land on, and nothing
else. Everything outside it is "the dark" — deliberately not scanned.

Skills and agents MUST exchange this shape (JSON). Marker `_dark_` means "no
affected projects found — the working tree is clean or untracked".

## Schema

```json
{
  "moonRoot": "/abs/path/to/workspace",
  "base": "working-tree | default-branch | <sha>..<sha>",
  "changedFiles": ["apps/atlas/api/src/foo.ts", "libs/types/src/bar.ts"],
  "affected": [
    {
      "id": "atlas-api",
      "source": "apps/atlas/api",
      "layer": "application",
      "stack": "backend",
      "tags": ["buildable-image"],
      "tasks": ["typecheck", "lint", "test"],
      "reason": "changed | upstream-of-changed | downstream-of-changed"
    }
  ],
  "downstream": ["atlas-app"],
  "summary": "2 changed files → 1 changed project, 1 downstream dependent"
}
```

## Field rules

- `affected[].id` / `source` / `layer` / `stack` / `tags` / `tasks` come
  straight from `moon query affected` / `moon query projects` JSON — never
  invented.
- `affected[].reason` distinguishes a directly-changed project from one pulled
  in by `--upstream`/`--downstream`. The scout records why each project is in
  scope so the implementer/verifier can reason about blast radius.
- `tasks` lists only tasks the project actually defines (from the query),
  filtered to the verification-relevant ones (`typecheck`, `lint`, `test`,
  `build`) unless the caller asks for more.
- An empty `affected` array → set `summary` to `_dark_` and let the caller
  decide (usually: nothing to do, hand back).

## Usage

- `scope` builds and (optionally) persists the map to
  `<PROJECT_ROOT>/docs/moon-moth/scope/<timestamp>.json`, and passes it inline
  when handing off to implementation.
- `implement` reads the map to bound which packages it may edit.
- `verify` reads `affected[].tasks` to know exactly which `moon run` targets to
  execute — it never runs repo-wide `:test` when a scoped set exists.
