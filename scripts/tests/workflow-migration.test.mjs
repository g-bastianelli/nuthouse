import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkWorkflowMigration } from "../check-workflow-migration.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

describe("workflow migration gate", () => {
  test("accepts the repository ownership migration", () => {
    expect(checkWorkflowMigration(REPO_ROOT)).toEqual([]);
  });

  test("reports a resurrected forbidden artifact", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-workflow-gate-"));
    try {
      fs.mkdirSync(path.join(fixture, "git-gremlin", "skills", "spawn"), { recursive: true });
      fs.writeFileSync(path.join(fixture, "git-gremlin", "skills", "spawn", "SKILL.md"), "old");
      expect(checkWorkflowMigration(fixture)).toContain(
        "legacy path remains git-gremlin/skills/spawn/SKILL.md",
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
