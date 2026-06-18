# monkey-maestro

![monkey-maestro](./assets/banner.png)

> screeching monkey maestro conducting the issue-symphony

A monkey in a tailcoat conducting your build pipeline. It takes your Linear backlog
and runs it as one unbroken symphony: each issue a movement, each worktree a section
of the pit, each green check a clean cadence. It greets the issue, plans it, lets the
implementation play, verifies the passage, opens the PR — then turns to you, the patron
in the box seat, for a single nod ("tested, it's good?") before cueing the next
movement. You merge the PRs yourself, at your own tempo. The baton never falls silent
until the queue is drained — or you call _baton down_.

Linear is the source of truth. The relay keeps only a repo-scoped control flag
(`autopilot.json`) for locking, budget, and audit breadcrumbs; it does not maintain a
local issue queue or stage file.

## Install

### Claude Code

```
/plugin install monkey-maestro@nuthouse
```

### Codex CLI

```
codex plugin install monkey-maestro@nuthouse
```

## Skills

| Skill                    | What it does                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `monkey-maestro:run`     | Kickoff — arm autopilot, ask Linear for the first startable issue, spawn its worktree                                                                           |
| `monkey-maestro:advance` | Blocking code review of the PR (git-gremlin) — fix & re-test until clean — then the acceptance gate ("tested, it's good?"), then spawn the next startable issue |
| `monkey-maestro:halt`    | Lower the baton — disarm autopilot so no further worktrees spawn                                                                                                |

## Agents

| Agent                        | Used by      | Role                                                        |
| ---------------------------- | ------------ | ----------------------------------------------------------- |
| `monkey-maestro:queue-scout` | run, advance | Read-only Linear scout: next startable issue + spawn params |

## License

MIT
