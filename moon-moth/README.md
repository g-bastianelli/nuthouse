# moon-moth

![moon-moth](./assets/banner.png)

> Moth drawn only to what you touched — flits the affected graph, never the whole repo

A small affected-work helper for monorepos built on [moon](https://moonrepo.dev). It reports
affected projects and runs their `:typecheck`, `:lint`, and `:test` tasks. Moon remains the
source of truth; the plugin adds no workflow state or orchestration.

## Skills

| Skill    | What it does                                                        |
| -------- | ------------------------------------------------------------------- |
| `scope`  | Reports affected projects directly from `moon query`                |
| `verify` | Runs affected `:typecheck`, `:lint`, and `:test` tasks through moon |

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
