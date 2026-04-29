#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const FLAG_PATH = PLUGIN_ROOT ? path.join(PLUGIN_ROOT, 'data', '.state') : null;

function isStatuslineConfigured() {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    const cmd = settings?.statusLine?.command || '';
    return cmd.includes('saucy-status');
  } catch (e) {
    return false;
  }
}

function autoConfigureStatusline() {
  if (!PLUGIN_ROOT) return false;
  try {
    let settings = {};
    try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')); } catch (e) {}
    settings.statusLine = {
      type: 'command',
      command: `bash "${PLUGIN_ROOT}/hooks/statusline.sh"`
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

if (!isStatuslineConfigured()) {
  const configured = autoConfigureStatusline();
  if (configured) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "SAUCY-STATUS: Statusline auto-configured. Restart Claude Code to activate the badge."
      }
    }));
  }
}
