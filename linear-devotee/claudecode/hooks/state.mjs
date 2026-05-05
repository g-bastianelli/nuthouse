import fs from 'node:fs';
import path from 'node:path';

function statePath(pluginData, sessionId) {
  return path.join(pluginData, `state-${sessionId}.json`);
}

export function readState(pluginData, sessionId) {
  try {
    const content = fs.readFileSync(statePath(pluginData, sessionId), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function writeState(pluginData, sessionId, state) {
  fs.mkdirSync(pluginData, { recursive: true });
  fs.writeFileSync(statePath(pluginData, sessionId), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function cleanupOldStates(pluginData, maxAgeDays = 7) {
  let entries;
  try {
    entries = fs.readdirSync(pluginData);
  } catch {
    return;
  }
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
  for (const name of entries) {
    if (!name.startsWith('state-') || !name.endsWith('.json')) continue;
    const full = path.join(pluginData, name);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
    } catch {
      // Best effort cleanup only.
    }
  }
}

const ISSUE_ID_RE = /\b([a-z]{2,6})-([0-9]{2,})\b/i;

export function extractIssueId(input) {
  if (!input || typeof input !== 'string') return null;
  const stripped = input.includes('/') ? input.slice(input.indexOf('/') + 1) : input;
  const m = stripped.match(ISSUE_ID_RE);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}`;
}
