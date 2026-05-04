---
name: saucy
description: Control saucy-status mode. Use when user types /saucy [on|off|gooning|status|uninstall]. No arg → toggle off↔saucy.
---

## Voice

Read `../../persona.md` at the start of this skill. The voice defined there is canonical for the `saucy-status` plugin and applies to all output of this skill (status reports, errors, mode-change announcements). The mechanical work below (flag toggle, state file write) stays serious — only the strings are saucy.

**Scope:** this voice is local to this skill's execution. Once the skill finishes (after the mode change is reported), revert to the session's default voice. Don't let the persona voice bleed into the rest of the session.

Control the saucy-status flag at `$CLAUDE_PLUGIN_ROOT/data/.state`.

Parse the argument the user passed after `/saucy`:

| Arg | Action |
|-----|--------|
| `on` or `saucy` | write `saucy` |
| `off` | write `off` |
| `gooning` | write `gooning` |
| `status` | report current mode, no write |
| `uninstall` | retire `statusLine` de settings.json + supprime le flag |
| (none) | toggle: `off` → `saucy`, else → `off` |

Compute the plugin root as the directory 2 levels above this skill's base directory (`BASE_DIR/../..`). Run the snippet by passing it as `CLAUDE_PLUGIN_ROOT`:

```bash
CLAUDE_PLUGIN_ROOT="$(cd "BASE_DIR/../.." && pwd)" node -e "SNIPPET"
```

Use this Node.js snippet, replacing `ARG` with the user's argument (or empty string) and `BASE_DIR` with the actual base directory path:

```javascript
const fs = require('fs');
const os = require('os');
const path = require('path');
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
const flagPath = path.join(pluginRoot, 'data', '.state');
const arg = 'ARG'.trim();
let current = 'off';
try { current = fs.readFileSync(flagPath, 'utf8').trim(); } catch(e) {}

if (arg === 'status') {
  console.log(`saucy-status: ${current}`);
  process.exit(0);
}

if (arg === 'uninstall') {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch(e) {}
  if (settings.statusLine?.command?.includes('saucy-status')) {
    delete settings.statusLine;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
  try { fs.unlinkSync(flagPath); } catch(e) {}
  console.log('saucy-status uninstalled — restart Claude Code to apply');
  process.exit(0);
}

let next;
switch (arg) {
  case 'on':
  case 'saucy':   next = 'saucy'; break;
  case 'off':     next = 'off'; break;
  case 'gooning': next = 'gooning'; break;
  case '':        next = current === 'off' ? 'saucy' : 'off'; break;
  default:
    console.error(`unknown arg: ${arg}. Use on|off|gooning|status|uninstall`);
    process.exit(1);
}
fs.writeFileSync(flagPath, next, { flag: 'w' });
console.log(`saucy-status: ${next}`);
```

Report the resulting state:
- `saucy` → "saucy mode activated 🌶️ — suggestive messages enabled"
- `off` → "saucy-status off — back to normal"
- `gooning` → "GOONING mode 🫠 — Claude lost in your embeddings"
- `status` → "current mode: <mode>"
- `uninstall` → "saucy-status uninstalled — restart Claude Code to apply"
