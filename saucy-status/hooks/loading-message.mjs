import fs from 'node:fs';
import { createClaudeRuntime } from '../lib/runtime.mjs';

const runtime = createClaudeRuntime();
const flagPath = runtime.dataPath('.state');
const validModes = new Set(['off', 'saucy', 'gooning']);

let mode = 'off';
try {
  const content = fs.readFileSync(flagPath, 'utf8').trim();
  if (validModes.has(content)) mode = content;
} catch {}

if (mode === 'off') process.exit(0);

const messages = JSON.parse(fs.readFileSync(runtime.rootPath('data', 'messages.json'), 'utf8'));
const pool = messages[mode] || messages.saucy;
const message = pool[Math.floor(Math.random() * pool.length)];

process.stdout.write(JSON.stringify({ systemMessage: message }));
