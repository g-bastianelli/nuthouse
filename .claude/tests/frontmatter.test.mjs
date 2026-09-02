import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

const VALID_MODELS = new Set(["haiku", "sonnet", "opus", "fable", "inherit"]);
const VALID_EFFORT = new Set(["low", "medium", "high", "xhigh", "max"]);

function listTrackedFiles() {
  const out = execSync("git ls-files", { cwd: REPO_ROOT, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function findFrontmatterFiles() {
  const tracked = listTrackedFiles();
  const untracked = execSync("git ls-files --others --exclude-standard", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const all = [...new Set([...tracked, ...untracked])];
  return all.filter((rel) => {
    if (rel.startsWith("_templates/")) return false;
    if (rel.startsWith("node_modules/")) return false;
    const match = rel.endsWith("/SKILL.md") || (rel.includes("/agents/") && rel.endsWith(".md"));
    if (!match) return false;
    return fs.existsSync(path.join(REPO_ROOT, rel));
  });
}

function extractFrontmatterBlock(content) {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---", 4);
  if (end === -1) return null;
  return content.slice(4, end);
}

function parseTopLevelScalar(block, key) {
  const re = new RegExp(`^${key}:[ \\t]*([^\\n]*)$`, "m");
  const m = block.match(re);
  if (!m) return undefined;
  let value = m[1].trim();
  if (!value) return undefined;
  if (value.startsWith("#")) return undefined;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function parseTopLevelRawValue(block, key) {
  const re = new RegExp(`^${key}:[ \\t]*([^\\n]*)$`, "m");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

function isQuoted(value) {
  return (
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
  );
}

const files = findFrontmatterFiles();

describe("skill + agent frontmatter values", () => {
  test("discovers at least one skill and one agent", () => {
    expect(files.some((f) => f.endsWith("/SKILL.md"))).toBe(true);
    expect(files.some((f) => f.includes("/agents/"))).toBe(true);
  });

  for (const rel of files) {
    test(rel, () => {
      const abs = path.join(REPO_ROOT, rel);
      const content = fs.readFileSync(abs, "utf8");
      const block = extractFrontmatterBlock(content);
      expect(block, `${rel} has no YAML frontmatter`).not.toBeNull();

      const model = parseTopLevelScalar(block, "model");
      const effort = parseTopLevelScalar(block, "effort");
      const argumentHint = parseTopLevelRawValue(block, "argument-hint");

      if (model !== undefined) {
        expect(
          VALID_MODELS.has(model),
          `${rel}: model "${model}" not in ${[...VALID_MODELS].join(", ")}`,
        ).toBe(true);
      }

      if (effort !== undefined) {
        expect(
          VALID_EFFORT.has(effort),
          `${rel}: effort "${effort}" not in ${[...VALID_EFFORT].join(", ")}`,
        ).toBe(true);
      }

      if (argumentHint !== undefined) {
        expect(
          isQuoted(argumentHint) || !/^\[[^\n]*\]\s+\[/.test(argumentHint),
          `${rel}: quote argument-hint when it contains multiple bracket groups`,
        ).toBe(true);
      }
    });
  }
});

// A skill either speaks to the user or it is a contract the model reads. The first kind
// must name where its voice comes from; the second declares `genre: contract` and has no
// user-facing output at all. Asserting the property this way means no exception list to
// maintain when a skill is added or its genre changes.
describe("every user-facing skill names its voice", () => {
  const skills = listTrackedFiles()
    .filter((file) => /^[^/.][^/]*\/skills\/[^/]+\/SKILL\.md$/.test(file))
    // git still lists a path deleted in the working tree; only judge what is on disk.
    .filter((file) => fs.existsSync(path.join(REPO_ROOT, file)))
    .sort();

  test("the skill inventory is non-empty", () => {
    expect(skills.length).toBeGreaterThan(0);
  });

  for (const file of skills) {
    const body = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
    const block = extractFrontmatterBlock(body);
    const genre = block ? parseTopLevelScalar(block, "genre") : undefined;
    if (genre === "contract") continue;

    test(`${file}: reads its plugin persona`, () => {
      expect(body).toContain("persona.md");
    });
  }
});
