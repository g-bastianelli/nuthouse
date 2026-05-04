# linear-devotee

![linear-devotee](./assets/banner.png)

Devoted Linear devotee — a Claude Code and Codex plugin that detects your Linear issue, sets it `In Progress` when approved by the runtime flow, and prepares an SDD-formatted brief so you don't code blind. Plus: a chainable trinity of skills that creates Linear projects, milestones, and issues from spec or vibe.

Voice = feral devotee / carnal worship. The user is the god, the work is the offering.

## Skills

| Skill | What |
|---|---|
| `linear-devotee:greet` | Detects issue from branch or first prompt, sets In Progress, dispatches the `seer` subagent, returns an SDD brief, hands off to plan / clarifications / code / stop |
| `linear-devotee:consummate-project` | Creates a Linear Project from a spec file or vibe-mode Q&A. Drafts a Project-SDD via the `oracle` subagent, previews, mutates Linear on approval, writes a chain-state file, can hand off to `bind-milestone` |
| `linear-devotee:bind-milestone` | Creates a Linear Milestone — chained from `consummate-project` (auto-loads project + drafted phases) or standalone (project picker + freeform hint). Drafts via the `chronicler`, previews, mutates, can hand off to `bare-issue` |
| `linear-devotee:bare-issue` | Creates a Linear Issue with a strict SDD-formatted description — chained from `bind-milestone` (cascades through suggested issues) or standalone (project + optional milestone + hint). Drafts via the `acolyte`, previews, mutates |

## Agents (read-only Linear scouts)

| Agent | Used by | Drafts |
|---|---|---|
| `seer` | `greet` | SDD brief on an existing issue |
| `oracle` | `consummate-project` | Project-SDD + decomposition proposal + suggested issues |
| `chronicler` | `bind-milestone` | Milestone draft (name, scope, target date, suggested issues) |
| `acolyte` | `bare-issue` | SDD-formatted issue draft (Goal/Context/Files/Constraints/Acceptance/Non-goals/Edges) |

All agents are read-only on Linear (no `save_*` tools). Skills do all writes, always behind explicit `(y)` confirmation.

## Detection (`greet` only)

Claude Code has two hook-driven stages, **start of session only**:

1. **SessionStart hook** — reads `git branch --show-current`, regex `[A-Z]+-[0-9]+`. Match → invokes `linear-devotee:greet`.
2. **UserPromptSubmit hook** — if the branch didn't yield an ID, scans the first user prompt. Match → invokes `linear-devotee:greet`.

After the first prompt: total silence. The greet window closes.

Codex does not expose the same hook model, so `linear-devotee:greet` is invoked explicitly and detects the Linear identifier from the invocation argument or current branch.

## Cascade chain

`consummate-project` → `bind-milestone` → `bare-issue` form a hand-off chain. Each skill is also invocable standalone. Chain state lives at `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json` and carries the project_id, drafted milestones, drafted issues, and created-vs-pending counters.

The chronicler can annotate suggested issues with `[blocked-by: <idx>, <idx>]` to encode hard ordering inside a milestone. `bare-issue` then picks issues whose dependencies are already created first (topological cascade) and forwards the resolved Linear identifiers to `save_issue` as `blockedBy`, so the Linear UI shows the dep chain natively — and an empty `blocked_by` list means the issue is a safe entry point.

## Requirements

- Linear MCP/app tools loaded in the session
- A git repository
- For `greet`: a detectable Linear identifier (regex `[A-Z]+-[0-9]+`)

## Install

### Claude Code

```
/plugin marketplace add g-bastianelli/nuthouse
/plugin install linear-devotee@nuthouse
```

Restart Claude Code after install.

### Codex CLI

```
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open the plugin browser (`/plugins`) and install `linear-devotee`.

## Runtime layout

```text
linear-devotee/
|-- .codex-plugin/
|-- assets/
|-- claudecode/
|   |-- agents/
|   |-- hooks/
|   |-- skills/
|   `-- tests/
`-- codex/
    `-- skills/
```

## License

MIT
