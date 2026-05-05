import { afterEach, beforeEach, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupOldStates, extractIssueId, readState, writeState } from '../hooks/state.mjs';

let tmpData;

beforeEach(() => {
  tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'linear-devotee-test-'));
});

afterEach(() => {
  fs.rmSync(tmpData, { recursive: true, force: true });
});

test('readState returns parsed object when file exists', () => {
  const sessionId = 'sess-abc';
  const payload = { greeted: false, issue: 'ENG-1', awaiting_prompt: false };
  fs.writeFileSync(
    path.join(tmpData, `state-${sessionId}.json`),
    JSON.stringify(payload),
  );
  expect(readState(tmpData, sessionId)).toEqual(payload);
});

test('readState returns null when file is missing', () => {
  expect(readState(tmpData, 'sess-missing')).toBeNull();
});

test('readState returns null when file is malformed JSON', () => {
  const sessionId = 'sess-bad';
  fs.writeFileSync(
    path.join(tmpData, `state-${sessionId}.json`),
    '{not json',
  );
  expect(readState(tmpData, sessionId)).toBeNull();
});

test('writeState persists object as JSON', () => {
  const sessionId = 'sess-write';
  const payload = { greeted: true, issue: 'ENG-2' };
  writeState(tmpData, sessionId, payload);
  const onDisk = JSON.parse(
    fs.readFileSync(path.join(tmpData, `state-${sessionId}.json`), 'utf8'),
  );
  expect(onDisk).toEqual(payload);
});

test('writeState terminates file with a trailing newline', () => {
  const sessionId = 'sess-newline';
  writeState(tmpData, sessionId, { greeted: true });
  const raw = fs.readFileSync(
    path.join(tmpData, `state-${sessionId}.json`),
    'utf8',
  );
  expect(raw.endsWith('\n')).toBe(true);
});

test('writeState creates the data directory if missing', () => {
  fs.rmSync(tmpData, { recursive: true, force: true });
  writeState(tmpData, 'sess-mkdir', { greeted: false });
  expect(fs.existsSync(path.join(tmpData, 'state-sess-mkdir.json'))).toBe(true);
});

test('cleanupOldStates removes files older than maxAgeDays', () => {
  const oldFile = path.join(tmpData, 'state-old.json');
  const freshFile = path.join(tmpData, 'state-fresh.json');
  fs.writeFileSync(oldFile, '{}');
  fs.writeFileSync(freshFile, '{}');
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);
  fs.utimesSync(oldFile, tenDaysAgo, tenDaysAgo);

  cleanupOldStates(tmpData, 7);

  expect(fs.existsSync(oldFile)).toBe(false);
  expect(fs.existsSync(freshFile)).toBe(true);
});

test('cleanupOldStates is silent when data dir is missing', () => {
  fs.rmSync(tmpData, { recursive: true, force: true });
  expect(() => cleanupOldStates(tmpData, 7)).not.toThrow();
});

test('extractIssueId pulls identifier from branch with user prefix', () => {
  expect(extractIssueId('g-bastianelli/eng-247-foo-bar')).toBe('ENG-247');
});

test('extractIssueId pulls identifier from branch without user prefix', () => {
  expect(extractIssueId('eng-12-fix-bug')).toBe('ENG-12');
});

test('extractIssueId returns null when no identifier present', () => {
  expect(extractIssueId('main')).toBeNull();
  expect(extractIssueId('feature/random-thing')).toBeNull();
});

test('extractIssueId ignores common false positives', () => {
  expect(extractIssueId('use utf-8 encoding')).toBeNull();
});

test('extractIssueId pulls identifier from prompt sentence', () => {
  expect(extractIssueId('fix ENG-42 logging issue please')).toBe('ENG-42');
  expect(extractIssueId('please fix eng-99 today')).toBe('ENG-99');
});

test('extractIssueId returns first match when multiple present', () => {
  expect(extractIssueId('ENG-12 and ENG-34 both broken')).toBe('ENG-12');
});
