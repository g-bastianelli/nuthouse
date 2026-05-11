# Codex Tool Mapping

Skills use Claude Code tool names. When running on Codex, use these equivalents:

| Skill references          | Codex equivalent            |
|---------------------------|-----------------------------|
| `Task` (dispatch subagent)| `spawn_agent`               |
| Multiple `Task` calls     | Multiple `spawn_agent` calls|
| Task returns result       | `wait_agent`                |
| `TodoWrite` (progress)    | `update_plan`               |
| `Read`, `Write`, `Edit`   | Native file tools           |
| `Bash` (run commands)     | Native shell tools          |

## Subagent dispatch

Subagent support requires multi-agent enabled in Codex config (`~/.codex/config.toml`):

```toml
[features]
multi_agent = true
```

If subagents are unavailable, the skill's fallback instruction applies: perform the same discovery locally before editing.
