import { expect, test } from 'bun:test';
import { applyFrontmatterPatch } from '../lib/apply-frontmatter-patch.mjs';

const baseSpec = `---
id: my-spec
status: draft
linear-project: _none_
---

# My Spec

Body content here.
`;

test('adds a missing key to existing frontmatter', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'verified-by', value: '_none_' },
  ]);
  expect(out).toContain('verified-by: _none_');
  expect(out).toContain('id: my-spec');
  expect(out).toContain('# My Spec');
});

test('updates an existing key', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'status', value: 'approved' },
  ]);
  expect(out).toContain('status: approved');
  expect(out).not.toContain('status: draft');
});

test('applies multiple patches in one call', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'verified-by', value: '_none_' },
    { key: 'last-reviewed', value: '2026-05-04' },
    { key: 'status', value: 'approved' },
  ]);
  expect(out).toContain('verified-by: _none_');
  expect(out).toContain('last-reviewed: 2026-05-04');
  expect(out).toContain('status: approved');
});

test('preserves trailing newline', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'verified-by', value: '_none_' },
  ]);
  expect(out.endsWith('\n')).toBe(true);
});

test('preserves body content unchanged', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'verified-by', value: '_none_' },
  ]);
  expect(out).toContain('# My Spec');
  expect(out).toContain('Body content here.');
});

test('is idempotent — applying the same patch twice yields the same result', () => {
  const once = applyFrontmatterPatch(baseSpec, [
    { key: 'verified-by', value: '_none_' },
  ]);
  const twice = applyFrontmatterPatch(once, [
    { key: 'verified-by', value: '_none_' },
  ]);
  expect(twice).toEqual(once);
});

test('empty patch list returns content unchanged', () => {
  const out = applyFrontmatterPatch(baseSpec, []);
  expect(out).toEqual(baseSpec);
});

test('throws when content has no frontmatter block', () => {
  const bad = '# No frontmatter here\n\nJust body.\n';
  expect(() => applyFrontmatterPatch(bad, [{ key: 'id', value: 'x' }]))
    .toThrow(/frontmatter/i);
});

test('throws when frontmatter block is unterminated', () => {
  const bad = `---
id: my-spec

# Body without closing frontmatter
`;
  expect(() => applyFrontmatterPatch(bad, [{ key: 'id', value: 'x' }]))
    .toThrow(/frontmatter/i);
});

test('values containing spaces are written as-is', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'description', value: 'a multi word value' },
  ]);
  expect(out).toContain('description: a multi word value');
});

test('updates a key while preserving the order of other keys', () => {
  const out = applyFrontmatterPatch(baseSpec, [
    { key: 'status', value: 'approved' },
  ]);
  const lines = out.split('\n');
  const idIndex = lines.findIndex((l) => l.startsWith('id:'));
  const statusIndex = lines.findIndex((l) => l.startsWith('status:'));
  const linearIndex = lines.findIndex((l) => l.startsWith('linear-project:'));
  expect(idIndex).toBeLessThan(statusIndex);
  expect(statusIndex).toBeLessThan(linearIndex);
});
