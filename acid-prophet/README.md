# acid-prophet

![acid-prophet](./assets/banner.png)

Structured spec-writing skill for Claude Code and Codex. Asks one question at a time, proposes approaches, validates a written spec, then optionally hands off to linear-devotee for Linear project creation.

Tripping spec prophet. You bring the raw idea; it asks the sharp questions, writes the spec, and keeps Linear mutations behind an explicit approval gate.

## Skills

| Skill | What |
|---|---|
| `acid-prophet:trip` | Structured discovery flow that turns a new project or feature idea into a reviewed written spec |
| `acid-prophet:frequency-drift` | On a feature branch, compares the diff against the linked Linear project's SDD Acceptance criteria and reports drift |
| `acid-prophet:scry` | Audits an existing spec under `docs/acid-prophet/specs/` for SDD compliance, codebase reality, narrative quality, and style. Renders a structured BLOCKER/WARNING/INFO report and offers a hand-off menu (apply auto-fixes, open spec, hand to linear-devotee, stop) |

## Agents

| Agent | What |
|---|---|
| `scryer` | Read-only spec auditor. Used by `acid-prophet:scry` (standalone) and `acid-prophet:trip` Step 6 (auto-fix mode). Returns a structured BLOCKER/WARNING/INFO report with auto-fix candidates. |

## Runtime layout

```text
acid-prophet/
|-- .codex-plugin/
|-- assets/
|-- claudecode/
|   |-- agents/
|   |-- lib/
|   |-- skills/
|   `-- tests/
`-- codex/
    |-- lib/
    |-- skills/
    `-- tests/
```

## Install

### Claude Code

```
/plugin marketplace add g-bastianelli/nuthouse
/plugin install acid-prophet@nuthouse
```

Restart Claude Code after install.

### Codex CLI

```
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open the plugin browser (`/plugins`) and install `acid-prophet`.

## Trigger

Auto-invokes when a new project or feature needs a structured spec before development. Also triggered by `/acid-prophet:trip` in Claude Code or `$acid-prophet:trip` in Codex.

## License

MIT
