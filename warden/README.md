# warden

![warden](./assets/banner.png)

> keeper of the nuthouse — decides who gets to be fun

Warden is the centralized voice gate for the nuthouse plugin marketplace.
It hosts the shared Claude Code `voice` agent and the Codex `warden:voice`
skill that emit decorative persona lines for any plugin — and gives you a
single toggle to silence all fun messages globally.

If warden is not installed, all voice dispatches in other plugins
(`linear-devotee`, `acid-prophet`, etc.) fail silently. No errors, no drama.
Just clean, professional output.

## Dispatch cadence

Plugins should try `warden:voice` at every user-visible workflow transition:
skill start, context resolved, user decision point, external mutation gate,
handoff, recoverable failure, final report, and clean exit.

Do not call it for internal shell commands, hidden subagent work, or inside
serious artifacts such as specs, plans, Linear descriptions, commit messages, or
PR bodies.

`warden` is optional infrastructure. If the plugin is missing, the dispatch
fails, the flag file is unreadable, the output is malformed, or voice is off,
the caller prints nothing and continues. Missing `warden` is never a workflow
precondition.

## Skills

| Skill | What it does |
|---|---|
| `warden:voice` | Toggle fun messages on / off globally and, in Codex, dispatch one strict-JSON persona line when called with `SUMMARY`, `PERSONA_CONTRACT_PATH`, and `VOICE_FLAG_PATH` |

## Agents

| Agent | Used by | Role |
|---|---|---|
| `warden:voice` | `linear-devotee`, `acid-prophet`, any nuthouse plugin | Claude Code agent that reads the calling plugin's persona-line contract, checks the global flag, and emits one decorative line. Codex runs the same dispatcher contract through the `warden:voice` skill. |

## Install

### Claude Code

```
/plugin install warden@nuthouse
```

Restart Claude Code after install.

### Codex CLI

```
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `warden` from the nuthouse marketplace.

## Usage

Claude Code:

```
/warden:voice on      # enable fun messages
/warden:voice off     # silence all fun messages globally
/warden:voice status  # check current state
```

Codex:

```
$warden:voice on      # enable fun messages
$warden:voice off     # silence all fun messages globally
$warden:voice status  # check current state
```

Without warden installed, nuthouse plugins run in professional/neutral mode automatically.

## License

MIT
