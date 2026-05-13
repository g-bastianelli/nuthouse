# saucy-status

<p align="center"><img src="./assets/banner.png" width="640" /></p>

Claude Code statusline and prompt-time fun messages.

It restores rotating thinking/status text with two modes: `saucy` and `gooning`. State persists in Claude plugin data.

## Commands

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `/saucy install`   | Configure the Claude Code statusline |
| `/saucy uninstall` | Remove the statusline configuration  |
| `/saucy on`        | Enable saucy mode                    |
| `/saucy off`       | Disable messages                     |
| `/saucy gooning`   | Enable gooning mode                  |
| `/saucy status`    | Show current mode                    |
| `/saucy`           | Toggle off/saucy                     |

## Install

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install saucy-status@nuthouse
/saucy install
```

Restart Claude Code after install.
