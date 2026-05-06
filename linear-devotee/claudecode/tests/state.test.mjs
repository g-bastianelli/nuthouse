import { expect, test } from 'bun:test';
import { extractIssueId } from '../hooks/state.mjs';

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

test('extractIssueId ignores GitHub URLs', () => {
  expect(extractIssueId('https://github.com/g-bastianelli/nuthouse/pull/22')).toBeNull();
  expect(extractIssueId('https://github.com/g-bastianelli/nuthouse/tree/ENG-22-feature')).toBeNull();
});

test('extractIssueId still matches identifier alongside a GitHub URL', () => {
  expect(extractIssueId('check https://github.com/org/repo/pull/5 and fix ENG-42')).toBe('ENG-42');
});
