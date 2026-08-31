import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildWorkflowConfig } from "../build-workflow-config.mjs";
import { checkWorkflowMigration } from "../check-workflow-migration.mjs";
import { PARTICIPATING_WORKFLOW_PLUGINS } from "../workflow-bundles.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

describe("workflow migration gate", () => {
  test("keeps the legacy build command as a six-plugin bundle alias", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-workflow-build-"));
    const source = Buffer.from("export const profile = 'standard';\r\n");

    try {
      const sourceRoot = path.join(fixture, "_shared", "workflow", "src");
      const fixtureRoot = path.join(fixture, "_shared", "workflow", "fixtures");
      fs.mkdirSync(sourceRoot, { recursive: true });
      fs.mkdirSync(fixtureRoot, { recursive: true });
      fs.writeFileSync(path.join(sourceRoot, "index.mjs"), source);
      fs.writeFileSync(path.join(fixtureRoot, "parity.json"), "{}\n");
      fs.writeFileSync(path.join(fixture, "_shared", "workflow", "README.md"), "# Workflow\n");

      const result = buildWorkflowConfig(fixture);

      expect(result.plugins).toEqual(PARTICIPATING_WORKFLOW_PLUGINS);
      for (const plugin of PARTICIPATING_WORKFLOW_PLUGINS) {
        expect(fs.readFileSync(path.join(fixture, plugin, "lib", "workflow", "index.mjs"))).toEqual(
          source,
        );
        expect(
          JSON.parse(
            fs.readFileSync(path.join(fixture, plugin, "lib", "workflow", "bundle.json"), "utf8"),
          ).sourceHash,
        ).toBe(result.sourceHash);
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

  test.each([
    "monkey-maestro/lib/reconciliation-input.mjs",
    "monkey-maestro/lib/reconciliation-state.mjs",
    "monkey-maestro/scripts/reconcile-state.mjs",
  ])("rejects the superseded Maestro scheduling authority: %s", (filename) => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-linear-first-gate-"));
    try {
      const target = path.join(fixture, filename);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "export const legacy = true;\n");
      expect(checkWorkflowMigration(fixture)).toContain(`legacy path remains ${filename}`);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
