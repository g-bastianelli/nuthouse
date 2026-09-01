import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const PLUGIN_ROOT = path.resolve(import.meta.dir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

test("clean direct tasks derive a canonical planned Moon scope", () => {
  const scope = read("skills/scope/SKILL.md");
  const contract = read("skills/affected-scope/SKILL.md");

  expect(scope).toContain("Direct-task planned scope contract");
  expect(scope).toContain('"mode": "affected-or-planned | planned-paths"');
  expect(scope).toContain("moon query projects");
  expect(scope).toContain("unique deepest project source");
  expect(scope).toContain("planned-scope-unresolved");
  expect(scope).toContain('base: "planned-paths"');
  expect(scope).toContain('reason: "planned"');
  expect(scope).toContain('"name": "direct-task"');
  expect(contract).toContain('`base: "planned-paths"`');
  expect(contract).toContain("`affected[].reason` is");
  expect(contract).toContain("`planned`");
});

test("direct-task Moon evidence is bound to the run and exact verified snapshot", () => {
  const verify = read("skills/verify/SKILL.md");

  for (const term of [
    "Direct-task verification contract",
    "consumeManifestHandoff",
    "evaluateDirectTaskCompletion",
    '"decision_content_hash"',
    '"head_oid"',
    '"worktree_snapshot_hash"',
    '"changed_paths"',
    '"verified_files"',
    '"results"',
    "CURRENT_SNAPSHOT",
  ]) {
    expect(verify).toContain(term);
  }
  expect(verify).toContain("every additional snapshot path must be protected context");
  expect(verify).toContain("rerun if they differ");
  expect(verify).toContain("only when it reports `completed`");
});
