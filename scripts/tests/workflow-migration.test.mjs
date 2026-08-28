import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildWorkflowConfig } from "../build-workflow-config.mjs";
import { checkWorkflowMigration } from "../check-workflow-migration.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

describe("workflow migration gate", () => {
  test("builds byte-identical Warden workflow mirrors", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-workflow-build-"));
    const files = new Map([
      ["configuration.mjs", Buffer.from("export const profile = 'standard';\r\n")],
      ["worktree-overrides.mjs", Buffer.from("export const lifetime = 24;\n")],
      ["index.mjs", Buffer.from("export * from './configuration.mjs';\n")],
    ]);

    try {
      const sourceRoot = path.join(fixture, "_shared", "workflow", "src");
      fs.mkdirSync(sourceRoot, { recursive: true });
      for (const [filename, body] of files) {
        fs.writeFileSync(path.join(sourceRoot, filename), body);
      }

      buildWorkflowConfig(fixture);

      for (const [filename, body] of files) {
        expect(fs.readFileSync(path.join(fixture, "warden", "lib", "workflow", filename))).toEqual(
          body,
        );
      }
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

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

  test("reports a missing Warden workflow mirror", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-workflow-gate-"));
    try {
      fs.mkdirSync(path.join(fixture, "_shared", "workflow", "src"), { recursive: true });
      fs.writeFileSync(
        path.join(fixture, "_shared", "workflow", "src", "configuration.mjs"),
        "export const profile = 'standard';\n",
      );

      expect(checkWorkflowMigration(fixture)).toContain(
        "missing required warden/lib/workflow/configuration.mjs",
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("reports a stale Warden workflow mirror", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-workflow-gate-"));
    try {
      fs.mkdirSync(path.join(fixture, "_shared", "workflow", "src"), { recursive: true });
      fs.mkdirSync(path.join(fixture, "warden", "lib", "workflow"), { recursive: true });
      fs.writeFileSync(
        path.join(fixture, "_shared", "workflow", "src", "configuration.mjs"),
        "export const profile = 'standard';\n",
      );
      fs.writeFileSync(
        path.join(fixture, "warden", "lib", "workflow", "configuration.mjs"),
        "export const profile = 'quick';\n",
      );

      expect(checkWorkflowMigration(fixture)).toContain(
        "stale workflow mirror warden/lib/workflow/configuration.mjs (differs from _shared/workflow/src/configuration.mjs)",
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
