import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildWorkflowConfig } from "../build-workflow-config.mjs";
import { checkPluginInvariants } from "../check-plugin-invariants.mjs";
import { PARTICIPATING_WORKFLOW_PLUGINS } from "../workflow-bundles.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

describe("workflow gate", () => {
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

  test("the repository satisfies every plugin invariant", () => {
    expect(checkPluginInvariants(REPO_ROOT)).toEqual([]);
  });

  test("reports a manifest version drifting between runtimes", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-manifest-drift-"));
    try {
      for (const [runtime, version] of [
        [".claude-plugin", "1.0.4"],
        [".codex-plugin", "1.0.3"],
      ]) {
        const target = path.join(fixture, "warden", runtime);
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(path.join(target, "plugin.json"), JSON.stringify({ version }));
      }
      expect(checkPluginInvariants(fixture)).toContain(
        "warden: Claude/Codex versions differ (1.0.4 != 1.0.3)",
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("reports durable local state written outside the Maestro lock", () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-maestro-state-"));
    try {
      const target = path.join(fixture, "monkey-maestro", "lib");
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(
        path.join(target, "queue.mjs"),
        'import fs from "node:fs";\nfs.writeFileSync("queue.json", "[]");\n',
      );
      expect(checkPluginInvariants(fixture)).toContain(
        "monkey-maestro/lib/queue.mjs: unexpected durable local-state mutation",
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
