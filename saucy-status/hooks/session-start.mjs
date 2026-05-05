#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClaudeRuntime } from '../lib/runtime.mjs';

const runtime = createClaudeRuntime();
const root = runtime.pluginRoot();
const data = runtime.pluginData();
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

function isStatuslineConfigured() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const cmd = settings?.statusLine?.command || '';
    return cmd.includes(root) && cmd.includes(data) && cmd.includes('statusline.sh');
  } catch {
    return false;
  }
}

if (!isStatuslineConfigured()) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'SAUCY-STATUS: Statusline is not configured. Run `/saucy install` if you want the statusline badge for this plugin install.',
    },
  }));
}
