# warden

![warden](./assets/banner.png)

> keeper of the nuthouse — decides who gets to be fun

Warden is the centralized voice agent for the nuthouse plugin marketplace.
It hosts the shared `voice` agent that emits decorative persona lines for
any plugin — and gives you a single toggle to silence all fun messages globally.

If warden is not installed, all voice dispatches in other plugins (`linear-devotee`,
`acid-prophet`, etc.) fail silently. No errors, no drama. Just clean, professional output.

## Skills

| Skill | What it does |
|---|---|
| `warden:voice` | Toggle fun messages on / off globally (`/warden:voice [on\|off\|status]`) |

## Agents

| Agent | Used by | Role |
|---|---|---|
| `warden:voice` | `linear-devotee`, `acid-prophet`, any nuthouse plugin | Reads the calling plugin's persona-line contract, checks the global flag, emits one decorative line |

## Install

```
/plugin install warden@nuthouse
```

Restart Claude Code after install.

## Usage

```
/warden:voice on      # enable fun messages
/warden:voice off     # silence all fun messages globally
/warden:voice status  # check current state
```

Without warden installed, nuthouse plugins run in professional/neutral mode automatically.

## License

MIT
