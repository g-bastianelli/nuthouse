import { describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');

const VALID_MODELS = new Set(['haiku', 'sonnet', 'opus', 'inherit']);
const VALID_EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

function listTrackedFiles() {
  const out = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function findFrontmatterFiles() {
  const tracked = listTrackedFiles();
  const untracked = execSync('git ls-files --others --exclude-standard', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const all = [...new Set([...tracked, ...untracked])];
  return all.filter((rel) => {
    if (rel.startsWith('_templates/')) return false;
    if (rel.startsWith('node_modules/')) return false;
    const match = rel.endsWith('/SKILL.md') || (rel.includes('/agents/') && rel.endsWith('.md'));
    if (!match) return false;
    return fs.existsSync(path.join(REPO_ROOT, rel));
  });
}

function extractFrontmatterBlock(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return null;
  return content.slice(4, end);
}

function parseTopLevelScalar(block, key) {
  const re = new RegExp(`^${key}:[ \\t]*([^\\n]*)$`, 'm');
  const m = block.match(re);
  if (!m) return undefined;
  let value = m[1].trim();
  if (!value) return undefined;
  if (value.startsWith('#')) return undefined;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const files = findFrontmatterFiles();

describe('skill + agent frontmatter values', () => {
  test('discovers at least one skill and one agent', () => {
    expect(files.some((f) => f.endsWith('/SKILL.md'))).toBe(true);
    expect(files.some((f) => f.includes('/agents/'))).toBe(true);
  });

  for (const rel of files) {
    test(rel, () => {
      const abs = path.join(REPO_ROOT, rel);
      const content = fs.readFileSync(abs, 'utf8');
      const block = extractFrontmatterBlock(content);
      expect(block, `${rel} has no YAML frontmatter`).not.toBeNull();

      const model = parseTopLevelScalar(block, 'model');
      const effort = parseTopLevelScalar(block, 'effort');

      if (model !== undefined) {
        expect(
          VALID_MODELS.has(model),
          `${rel}: model "${model}" not in ${[...VALID_MODELS].join(', ')}`,
        ).toBe(true);
      }

      if (effort !== undefined) {
        expect(
          VALID_EFFORT.has(effort),
          `${rel}: effort "${effort}" not in ${[...VALID_EFFORT].join(', ')}`,
        ).toBe(true);
      }
    });
  }
});
