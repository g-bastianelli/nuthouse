import { afterEach, beforeEach, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClaudeRuntime } from '../src/claude.mjs';

let tmpRoot;
let tmpData;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nuthouse-runtime-root-'));
  tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'nuthouse-runtime-data-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test('resolves plugin root and data from Claude env vars', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });

  expect(runtime.pluginRoot()).toBe(tmpRoot);
  expect(runtime.pluginData()).toBe(tmpData);
  expect(runtime.dataPath('state-sess.json')).toBe(path.join(tmpData, 'state-sess.json'));
  expect(runtime.rootPath('persona.md')).toBe(path.join(tmpRoot, 'persona.md'));
});

test('falls back to plugin root data directory when plugin data env is absent', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
    },
  });

  expect(runtime.pluginData()).toBe(path.join(tmpRoot, 'data'));
});

test('throws a clear error when plugin root is unavailable', () => {
  expect(() => createClaudeRuntime({ env: {} }).pluginRoot()).toThrow('CLAUDE_PLUGIN_ROOT is not set');
});

test('writes stable JSON with parent directories and trailing newline', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  const target = runtime.dataPath('nested', 'state.json');

  runtime.writeJson(target, { issue: 'ENG-42', greeted: false });

  expect(fs.readFileSync(target, 'utf8')).toBe('{\n  "issue": "ENG-42",\n  "greeted": false\n}\n');
  expect(runtime.readJson(target, null)).toEqual({ issue: 'ENG-42', greeted: false });
});

test('readJson returns fallback for missing or malformed files', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  const target = runtime.dataPath('broken.json');
  fs.writeFileSync(target, '{bad json');

  expect(runtime.readJson(runtime.dataPath('missing.json'), { ok: false })).toEqual({ ok: false });
  expect(runtime.readJson(target, { ok: false })).toEqual({ ok: false });
});

test('readJson rethrows unexpected IO and path type errors', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  const directory = runtime.dataPath('state-dir');
  fs.mkdirSync(directory);

  expect(() => runtime.readJson(directory, { ok: false })).toThrow();
  expect(() => runtime.readJson(undefined, { ok: false })).toThrow(TypeError);
});

test('writes and reads text files', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  const target = runtime.dataPath('mode', '.state');

  runtime.writeText(target, 'saucy\n');

  expect(runtime.readText(target, 'off')).toBe('saucy\n');
  expect(runtime.readText(runtime.dataPath('missing'), 'off')).toBe('off');
});

test('writeJson and writeText leave no temporary files on success', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });

  runtime.writeJson(runtime.dataPath('json-target.json'), { ok: true });
  runtime.writeText(runtime.dataPath('text-target'), 'hello\n');

  const leftovers = fs
    .readdirSync(tmpData)
    .filter((name) => name.endsWith('.tmp') || name.includes('.tmp'));
  expect(leftovers).toEqual([]);
});

test('atomic write preserves existing target when rename fails', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  // Create a directory at the target path so rename(tmp -> target) fails.
  const target = runtime.dataPath('blocked');
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, 'sentinel'), 'still-here');

  expect(() => runtime.writeText(target, 'new-payload')).toThrow();
  // Existing directory + sentinel must be untouched.
  expect(fs.statSync(target).isDirectory()).toBe(true);
  expect(fs.readFileSync(path.join(target, 'sentinel'), 'utf8')).toBe('still-here');
  // Tmp file must be cleaned up.
  const leftovers = fs.readdirSync(tmpData).filter((name) => name.startsWith('blocked.'));
  expect(leftovers).toEqual([]);
});

test('readText rethrows unexpected IO and path type errors', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  const directory = runtime.dataPath('mode-dir');
  fs.mkdirSync(directory);

  expect(() => runtime.readText(directory, 'off')).toThrow();
  expect(() => runtime.readText(undefined, 'off')).toThrow(TypeError);
});

test('sessionStatePath prefixes state kind and session id', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });

  expect(runtime.sessionStatePath('chain', 'sess-1')).toBe(path.join(tmpData, 'chain-sess-1.json'));
});

test('cleanupSessionState removes only old matching state files', () => {
  const runtime = createClaudeRuntime({
    env: {
      CLAUDE_PLUGIN_ROOT: tmpRoot,
      CLAUDE_PLUGIN_DATA: tmpData,
    },
  });
  const oldState = runtime.dataPath('state-old.json');
  const freshState = runtime.dataPath('state-fresh.json');
  const oldChain = runtime.dataPath('chain-old.json');
  fs.writeFileSync(oldState, '{}');
  fs.writeFileSync(freshState, '{}');
  fs.writeFileSync(oldChain, '{}');
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);
  fs.utimesSync(oldState, tenDaysAgo, tenDaysAgo);
  fs.utimesSync(oldChain, tenDaysAgo, tenDaysAgo);

  runtime.cleanupSessionState('state', 7);

  expect(fs.existsSync(oldState)).toBe(false);
  expect(fs.existsSync(freshState)).toBe(true);
  expect(fs.existsSync(oldChain)).toBe(true);
});
