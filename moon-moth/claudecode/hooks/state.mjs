import fs from "node:fs";
import path from "node:path";

/**
 * Session-state helpers for moon-moth hooks.
 *
 * State files live under `<pluginRoot>/claudecode/data/state-<sessionId>.json`
 * and are git-ignored. Each session gets one file; stale files are reaped.
 */

function dataDir(pluginRoot) {
  return path.join(pluginRoot, "claudecode", "data");
}

export function statePath(pluginRoot, sessionId) {
  return path.join(dataDir(pluginRoot), `state-${sessionId}.json`);
}

export function readState(pluginRoot, sessionId) {
  try {
    return JSON.parse(fs.readFileSync(statePath(pluginRoot, sessionId), "utf8"));
  } catch {
    return null;
  }
}

export function writeState(pluginRoot, sessionId, state) {
  const dir = dataDir(pluginRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(pluginRoot, sessionId), JSON.stringify(state), "utf8");
}

export function cleanupOldStates(pluginRoot, maxAgeDays = 7) {
  const dir = dataDir(pluginRoot);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const file of files) {
    if (!file.startsWith("state-") || !file.endsWith(".json")) continue;
    const full = path.join(dir, file);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full);
    } catch {}
  }
}

/**
 * Walk up from `start` to find the moon workspace root (the dir containing
 * `.moon/`). Returns the root path, or null if not inside a moon workspace.
 */
export function findMoonRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, ".moon"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
