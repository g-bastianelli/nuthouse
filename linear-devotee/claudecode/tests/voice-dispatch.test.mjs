import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const SKILLS_DIR = path.join(ROOT, "skills");
const OBSOLETE_VOICE_AGENT = ["linear-devotee", "devotee"].join(":");

function skillFiles() {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_DIR, entry.name, "SKILL.md"));
}

test("root skills use warden for persona lines", () => {
  for (const file of skillFiles()) {
    const body = fs.readFileSync(file, "utf8");
    expect(body).not.toContain(OBSOLETE_VOICE_AGENT);
    expect(body).toContain("warden:voice");
    expect(body).toContain("Voice cadence:");
    expect(body).toContain("If `warden` is unavailable");
    expect(body).toContain("Never make voice dispatch a precondition");
  }
});
