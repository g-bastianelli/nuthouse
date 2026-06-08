# moon-moth

![moon-moth](./assets/banner.png)

> Moth drawn only to what you touched — flits the affected graph, never the whole repo

A moon-aware agentic dev loop for TypeScript monorepos built on [moon](https://moonrepo.dev).
The moon-moth never flaps blindly through a sprawling repo: it follows the lamp — the diff —
traces the dust of the dependency graph out to exactly the `affected` projects, lands there,
and checks its wings (`:typecheck` / `:lint` / `:test`) before ever calling a flight clean.
Slow is wrong, blind is wrong. It goes where the change glows, and nowhere else.

## Skills

| Skill    | What it does                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------- |
| `scope`  | Builds a context map of the **affected** projects from `moon query` (changed-files + affected graph)      |
| `verify` | Runs affected `:typecheck` / `:lint` / `:test`, evidence over assertion, loops back on a torn wing        |
| `init`   | Wires a moon monorepo for moon-aware agents: path-scoped rules, verify hook, plan-default, moon allowlist |

## Agents

| Agent            | Used by  | Role                                                                      |
| ---------------- | -------- | ------------------------------------------------------------------------- |
| `affected-scout` | `scope`  | Runs `moon query` and returns the scoped affected-projects map (Haiku)    |
| `verify-runner`  | `verify` | Executes affected moon tasks and reports structured pass/fail per project |
| `change-auditor` | `verify` | Adversarially reviews the diff against the affected scope before handoff  |

## Install

### Claude Code

```
/plugin marketplace add g-bastianelli/nuthouse
/plugin install moon-moth@nuthouse
```

Restart Claude Code after install.

### Codex CLI

```
codex plugin marketplace upgrade
codex plugin add moon-moth@nuthouse
```

Restart the Codex session after install.

## License

MIT
