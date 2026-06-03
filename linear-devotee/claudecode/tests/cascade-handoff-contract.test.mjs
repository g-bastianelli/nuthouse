import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

function readSkill(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const cascadeSkills = [
  "linear-devotee/skills/create-project/SKILL.md",
  "linear-devotee/skills/create-milestone/SKILL.md",
  "linear-devotee/skills/create-issue/SKILL.md",
];

test("cascade creation recommends greet manually instead of auto-chaining", () => {
  for (const skillPath of cascadeSkills) {
    const skill = readSkill(skillPath);
    expect(skill, skillPath).toContain("Recommended next issue:");
    expect(skill, skillPath).toContain("Start with: linear-devotee:greet <identifier>");
    expect(skill, skillPath).toContain("Do **not** write greet state");
    expect(skill, skillPath).toContain("invoke `linear-devotee:greet`");
    expect(skill, skillPath).toContain("or continue automatically");
  }
});

test("create-project no longer advertises an automatic greet handoff", () => {
  const skill = readSkill("linear-devotee/skills/create-project/SKILL.md");
  expect(skill).toContain("does not invoke `linear-devotee:greet` automatically");
  expect(skill).not.toContain("On success it auto-chains to `linear-devotee:greet`");
  expect(skill).not.toContain("Then print `linear-devotee:greet <identifier>` and continue");
});

test("next-issue recommends without mutating Linear or auto-chaining", () => {
  const skill = readSkill("linear-devotee/skills/next-issue/SKILL.md");
  expect(skill).toContain("Recommended next issue:");
  expect(skill).toContain("Start with: linear-devotee:greet <identifier>");
  expect(skill).toContain("Do **not** write greet state");
  expect(skill).toContain("Mutate Linear status");
  expect(skill).toContain("Invoke `linear-devotee:greet`");
});
