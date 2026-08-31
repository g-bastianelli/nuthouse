import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PARTICIPATING_WORKFLOW_PLUGINS, checkWorkflowBundles } from "../workflow-bundles.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");
const RUNNER = path.join(REPO_ROOT, "scripts", "fixtures", "workflow-install-runner.mjs");
const DOMAIN_PLUGINS = PARTICIPATING_WORKFLOW_PLUGINS.filter((plugin) => plugin !== "warden");
const temporaryDirectories = new Set();

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

function copyInstallUnit(plugin) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), `workflow-install-${plugin}-`));
  temporaryDirectories.add(parent);
  const pluginRoot = path.join(parent, plugin);
  const runner = path.join(parent, "workflow-install-runner.mjs");
  fs.cpSync(path.join(REPO_ROOT, plugin), pluginRoot, { recursive: true });
  fs.copyFileSync(RUNNER, runner);
  return { parent, pluginRoot, runner };
}

function runCopiedPlugin(plugin) {
  const copy = copyInstallUnit(plugin);
  expect(fs.existsSync(path.join(copy.parent, "_shared"))).toBe(false);
  if (plugin !== "warden") expect(fs.existsSync(path.join(copy.parent, "warden"))).toBe(false);

  const result = spawnSync(process.execPath, [copy.runner, copy.pluginRoot], {
    cwd: copy.pluginRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: copy.parent,
      CLAUDE_PLUGIN_ROOT: copy.pluginRoot,
      CLAUDE_PLUGIN_DATA: path.join(copy.parent, "plugin-data"),
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `${plugin} isolated runner failed (${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  return JSON.parse(result.stdout);
}

describe("independent workflow bundle installations", () => {
  test("the repository bundle inventory is fresh before release isolation", () => {
    expect(checkWorkflowBundles(REPO_ROOT)).toEqual([]);
  });

  for (const plugin of PARTICIPATING_WORKFLOW_PLUGINS) {
    test(`${plugin} resolves parity and fallbacks from its copied install unit (AC-043, AC-045–AC-048, AC-051)`, () => {
      const result = runCopiedPlugin(plugin);

      expect(result).toEqual({
        plugin,
        sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        decisions: 3,
        fallbacks: 4,
        verificationCases: 3,
      });
    });
  }

  for (const plugin of DOMAIN_PLUGINS) {
    test(`${plugin} skills document the install-local Warden-free fallback contract (AC-046–AC-048)`, () => {
      const { pluginRoot } = copyInstallUnit(plugin);
      const skillFiles = fs
        .readdirSync(path.join(pluginRoot, "skills"), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name === "SKILL.md")
        .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));

      expect(skillFiles.length).toBeGreaterThan(0);
      for (const skillFile of skillFiles) {
        const source = fs.readFileSync(skillFile, "utf8");
        expect(source).toContain("install-local `lib/workflow/index.mjs`");
        expect(source).toContain("Warden must not be required");
        expect(source).toContain("block completion");
      }
    });
  }
});
