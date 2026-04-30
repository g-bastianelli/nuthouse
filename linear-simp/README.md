# linear-simp

![linear-simp](./assets/banner.png)

Devoted Linear simp — a Claude Code plugin that detects your Linear issue at the start of a session, flips it to `In Progress`, and prepares a SDD-formatted brief so you don't code like a maniac.

Brainrot/simp voice all the way through: "yes king", "the gooner came back boss", "this issue is PEAK".

## Skills

| Skill | What |
|---|---|
| `linear-simp:greet` | Detects issue from branch or first prompt, sets In Progress, dispatches the gooner, returns an SDD brief, hands off to plan / clarifications / skip |

## Detection

Two stages, **start of session only**:

1. **SessionStart hook** — reads `git branch --show-current`, regex `[A-Z]+-[0-9]+`. Match → invokes `linear-simp:greet`.
2. **UserPromptSubmit hook** — if the branch didn't yield an ID, scans the first user prompt. Match → invokes `linear-simp:greet`.

After the first prompt: total silence. The greet window closes.

## Requirements

- Linear MCP tools (`mcp__claude_ai_Linear__*`) loaded in the session
- A git repository
- A detectable Linear identifier (regex `[A-Z]+-[0-9]+`)

## Install

```
/plugin marketplace add g-bastianelli/skill-issue
/plugin install linear-simp@skill-issue
```

Restart Claude Code after install.

## License

MIT
