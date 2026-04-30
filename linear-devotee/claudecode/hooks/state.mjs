import fs from 'node:fs';
import path from 'node:path';

function statePath(pluginRoot, sessionId) {
  return path.join(pluginRoot, 'data', `state-${sessionId}.json`);
}

export function readState(pluginRoot, sessionId) {
  try {
    const content = fs.readFileSync(statePath(pluginRoot, sessionId), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function writeState(pluginRoot, sessionId, state) {
  const dir = path.join(pluginRoot, 'data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(pluginRoot, sessionId), JSON.stringify(state, null, 2), 'utf8');
}

export function cleanupOldStates(pluginRoot, maxAgeDays = 7) {
  const dir = path.join(pluginRoot, 'data');
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
  for (const name of entries) {
    if (!name.startsWith('state-') || !name.endsWith('.json')) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(full);
    } catch {
      // best-effort, ignore
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
