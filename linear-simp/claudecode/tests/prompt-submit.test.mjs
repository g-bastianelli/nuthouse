import { afterEach, beforeEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let tmpRoot;
const HOOK = path.resolve(import.meta.dir, '../hooks/prompt-submit.mjs');

function runHook(stdinJson) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify(stdinJson),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: tmpRoot },
  });
}

function writeStateFile(sessionId, state) {
  fs.writeFileSync(
    path.join(tmpRoot, 'data', `state-${sessionId}.json`),
    JSON.stringify(state),
  );
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'linear-simp-hook-'));
  fs.mkdirSync(path.join(tmpRoot, 'data'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('does nothing when awaiting_prompt is false', () => {
  writeStateFile('sess-1', { greeted: false, awaiting_prompt: false, issue: 'ENG-12' });
  const res = runHook({ session_id: 'sess-1', prompt: 'fix ENG-99 please' });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe('');
  const state = JSON.parse(
    fs.readFileSync(path.join(tmpRoot, 'data', 'state-sess-1.json'), 'utf8'),
  );
  expect(state.issue).toBe('ENG-12');
  expect(state.awaiting_prompt).toBe(false);
});

test('detects identifier in first prompt and outputs additionalContext', () => {
  writeStateFile('sess-2', {
    greeted: false,
    awaiting_prompt: true,
    issue: null,
    source: null,
    current_branch: 'main',
    needs_branch: true,
  });
  const res = runHook({ session_id: 'sess-2', prompt: 'fix ENG-42 logging issue' });
  expect(res.status).toBe(0);
  const out = JSON.parse(res.stdout);
  expect(out.hookSpecificOutput.additionalContext).toContain('ENG-42');
  const state = JSON.parse(
    fs.readFileSync(path.join(tmpRoot, 'data', 'state-sess-2.json'), 'utf8'),
  );
  expect(state.issue).toBe('ENG-42');
  expect(state.source).toBe('prompt');
  expect(state.awaiting_prompt).toBe(false);
});

test('first prompt without identifier closes the awaiting_prompt window', () => {
  writeStateFile('sess-3', {
    greeted: false,
    awaiting_prompt: true,
    issue: null,
    current_branch: 'feature/foo',
    needs_branch: false,
  });
  const res = runHook({ session_id: 'sess-3', prompt: 'how do I run the tests?' });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe('');
  const state = JSON.parse(
    fs.readFileSync(path.join(tmpRoot, 'data', 'state-sess-3.json'), 'utf8'),
  );
  expect(state.awaiting_prompt).toBe(false);
  expect(state.issue).toBeNull();
});

test('exits silently when no state file exists', () => {
  const res = runHook({ session_id: 'sess-missing', prompt: 'ENG-12' });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe('');
});
