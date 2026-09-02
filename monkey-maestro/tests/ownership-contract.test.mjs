import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");

test("Monkey Maestro ships no PreToolUse interceptor", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "monkey-maestro/.claude-plugin/plugin.json"), "utf8"),
  );
  expect(manifest.hooks).toBeUndefined();
  expect(fs.existsSync(path.join(ROOT, "monkey-maestro/claudecode"))).toBe(false);
  expect(fs.existsSync(path.join(ROOT, "monkey-maestro/hooks"))).toBe(false);
});

test("greet keeps exclusive ownership of the issue claim", () => {
  const greet = fs.readFileSync(path.join(ROOT, "linear-devotee/skills/greet/SKILL.md"), "utf8");
  const spawn = fs.readFileSync(path.join(ROOT, "monkey-maestro/skills/spawn/SKILL.md"), "utf8");
  expect(greet).toContain("sole owner of this transition");
  expect(spawn).toMatch(/spawn never changes Linear\s+status/);
});
