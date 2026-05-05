// Source of truth: _shared/runtime/src/claude.mjs.
// `bun run build:runtime` copies this file verbatim into each plugin's
// lib/runtime.mjs. If you are reading this comment inside a plugin's
// lib/, edit the source above instead — your changes here will be
// overwritten on the next build.
import fs from 'node:fs';
import path from 'node:path';

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function isMissingFileError(error) {
  return error?.code === 'ENOENT';
}

export function createClaudeRuntime(options = {}) {
  const env = options.env ?? process.env;
  const root = options.pluginRoot ?? env.CLAUDE_PLUGIN_ROOT ?? null;
  const data = options.pluginData ?? env.CLAUDE_PLUGIN_DATA ?? (root ? path.join(root, 'data') : null);

  function pluginRoot() {
    return requireValue(root, 'CLAUDE_PLUGIN_ROOT is not set');
  }

  function pluginData() {
    return requireValue(data, 'CLAUDE_PLUGIN_DATA is not set and no plugin root fallback is available');
  }

  function rootPath(...segments) {
    return path.join(pluginRoot(), ...segments);
  }

  function dataPath(...segments) {
    return path.join(pluginData(), ...segments);
  }

  function readJson(filePath, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      if (isMissingFileError(error) || error instanceof SyntaxError) return fallback;
      throw error;
    }
  }

  function readText(filePath, fallback = '') {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (isMissingFileError(error)) return fallback;
      throw error;
    }
  }

  function atomicWrite(filePath, value) {
    ensureParent(filePath);
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmpPath, value, 'utf8');
      fs.renameSync(tmpPath, filePath);
    } catch (error) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // tmp file may not exist; nothing else we can do.
      }
      throw error;
    }
  }

  function writeJson(filePath, value) {
    atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  function writeText(filePath, value) {
    atomicWrite(filePath, value);
  }

  function sessionStatePath(kind, sessionId) {
    return dataPath(`${kind}-${sessionId}.json`);
  }

  function cleanupSessionState(kind, maxAgeDays = 7) {
    let entries;
    try {
      entries = fs.readdirSync(pluginData());
    } catch {
      return;
    }

    const prefix = `${kind}-`;
    const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
    for (const name of entries) {
      if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
      const fullPath = dataPath(name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(fullPath);
      } catch {
        // Best effort cleanup only.
      }
    }
  }

  return {
    pluginRoot,
    pluginData,
    rootPath,
    dataPath,
    readJson,
    writeJson,
    readText,
    writeText,
    sessionStatePath,
    cleanupSessionState,
  };
}
