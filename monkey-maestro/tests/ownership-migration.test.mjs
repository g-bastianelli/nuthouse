import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");

const oldPaths = [
  "git-gremlin/claudecode/hooks/intercept-branch.mjs",
  "git-gremlin/hooks/hooks.json",
  "git-gremlin/skills/spawn/SKILL.md",
  "monkey-maestro/agents/queue-scout.md",
  "monkey-maestro/shared/pipeline-contract.md",
  "monkey-maestro/skills/advance/SKILL.md",
  "monkey-maestro/skills/halt/SKILL.md",
  "monkey-maestro/skills/run/SKILL.md",
];

test("workspace orchestration has one owner and no compatibility aliases", () => {
  for (const filename of oldPaths)
    expect(fs.existsSync(path.join(ROOT, filename)), filename).toBe(false);
  expect(fs.existsSync(path.join(ROOT, "monkey-maestro/skills/spawn/SKILL.md"))).toBe(true);
  expect(fs.existsSync(path.join(ROOT, "monkey-maestro/skills/orchestrate/SKILL.md"))).toBe(true);
  expect(fs.existsSync(path.join(ROOT, "monkey-maestro/hooks/hooks.json"))).toBe(true);
  expect(fs.existsSync(path.join(ROOT, "git-gremlin/hooks/hooks.json"))).toBe(false);
});

test("the moved branch guard names only its current owner", () => {
  const guard = fs.readFileSync(
    path.join(ROOT, "monkey-maestro/claudecode/hooks/intercept-branch.mjs"),
    "utf8",
  );
  expect(guard).toContain("monkey-maestro:spawn");
  expect(guard).toContain(
    "active Maestro project, use `monkey-maestro:orchestrate <project-id>` instead.",
  );
  expect(guard).toContain("MONKEY_MAESTRO_SPAWN_DISABLE");
  expect(guard).not.toContain("monkey-maestro:reconcile");
  expect(guard).not.toContain("git-gremlin:spawn");
  expect(guard).not.toContain("GIT_GREMLIN_SPAWN_DISABLE");
});

test("greet keeps exclusive ownership of the issue claim", () => {
  const greet = fs.readFileSync(path.join(ROOT, "linear-devotee/skills/greet/SKILL.md"), "utf8");
  const spawn = fs.readFileSync(path.join(ROOT, "monkey-maestro/skills/spawn/SKILL.md"), "utf8");
  expect(greet).toContain("sole owner of this transition");
  expect(spawn).toContain("never changes Linear status");
});
