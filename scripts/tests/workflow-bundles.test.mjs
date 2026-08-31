import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildWorkflowBundles,
  canonicalWorkflowEntries,
  checkWorkflowBundles,
  computeWorkflowSourceHash,
} from "../workflow-bundles.mjs";

const temporaryDirectories = new Set();
const PLUGINS = ["first-plugin", "second-plugin"];

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-bundles-"));
  temporaryDirectories.add(root);
  fs.mkdirSync(path.join(root, "_shared", "workflow", "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "_shared", "workflow", "fixtures"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "_shared", "workflow", "src", "index.mjs"),
    'export { profile } from "./profile.mjs";\n',
  );
  fs.writeFileSync(
    path.join(root, "_shared", "workflow", "src", "profile.mjs"),
    'export const profile = "standard";\n',
  );
  fs.writeFileSync(
    path.join(root, "_shared", "workflow", "fixtures", "parity.json"),
    '{"schemaVersion":1}\n',
  );
  fs.writeFileSync(path.join(root, "_shared", "workflow", "README.md"), "# Workflow\n");
  return root;
}

function bundlePath(root, plugin, ...segments) {
  return path.join(root, plugin, "lib", "workflow", ...segments);
}

describe("workflow bundle generation", () => {
  test("builds byte-identical deterministic bundles and metadata for every plugin (AC-043, AC-044)", () => {
    const root = createFixture();
    const result = buildWorkflowBundles(root, { plugins: PLUGINS });

    expect(result.plugins).toEqual(PLUGINS);
    expect(result.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(checkWorkflowBundles(root, { plugins: PLUGINS })).toEqual([]);

    const firstMetadata = fs.readFileSync(bundlePath(root, PLUGINS[0], "bundle.json"), "utf8");
    const secondMetadata = fs.readFileSync(bundlePath(root, PLUGINS[1], "bundle.json"), "utf8");
    expect(firstMetadata).toBe(secondMetadata);
    expect(JSON.parse(firstMetadata)).toMatchObject({
      schemaVersion: 1,
      sourceHash: result.sourceHash,
    });

    for (const plugin of PLUGINS) {
      expect(fs.readFileSync(bundlePath(root, plugin, "profile.mjs"), "utf8")).toBe(
        'export const profile = "standard";\n',
      );
      expect(fs.readFileSync(bundlePath(root, plugin, "fixtures", "parity.json"), "utf8")).toBe(
        '{"schemaVersion":1}\n',
      );
      expect(
        fs
          .readdirSync(bundlePath(root, plugin), { recursive: true })
          .some((entry) => String(entry).endsWith(".tmp")),
      ).toBe(false);
    }
  });

  test("fails every stale bundle after canonical source changes until regeneration (AC-044)", () => {
    const root = createFixture();
    buildWorkflowBundles(root, { plugins: PLUGINS });
    fs.writeFileSync(
      path.join(root, "_shared", "workflow", "src", "profile.mjs"),
      'export const profile = "strict";\n',
    );

    const stale = checkWorkflowBundles(root, { plugins: PLUGINS });
    for (const plugin of PLUGINS) {
      expect(stale).toContainEqual(expect.stringContaining(`${plugin}: stale source hash`));
      expect(stale).toContainEqual(
        expect.stringContaining(`${plugin}: stale generated file profile.mjs`),
      );
    }

    buildWorkflowBundles(root, { plugins: PLUGINS });
    expect(checkWorkflowBundles(root, { plugins: PLUGINS })).toEqual([]);
  });

  test("reports missing, extra, metadata-mismatched, and forbidden runtime files", () => {
    const root = createFixture();
    buildWorkflowBundles(root, { plugins: PLUGINS });

    fs.rmSync(bundlePath(root, PLUGINS[0], "profile.mjs"));
    fs.writeFileSync(bundlePath(root, PLUGINS[0], "obsolete.mjs"), "export {};\n");

    const secondIndex = bundlePath(root, PLUGINS[1], "index.mjs");
    fs.writeFileSync(secondIndex, 'export * from "../../../_shared/workflow/src/index.mjs";\n');

    const problems = checkWorkflowBundles(root, { plugins: PLUGINS });
    expect(problems).toContain(`${PLUGINS[0]}: missing generated file profile.mjs`);
    expect(problems).toContain(`${PLUGINS[0]}: extra generated file obsolete.mjs`);
    expect(problems).toContain(`${PLUGINS[1]}: stale generated file index.mjs`);
    expect(problems).toContain(
      `${PLUGINS[1]}: forbidden repository-parent runtime import in index.mjs: ../../../_shared/workflow/src/index.mjs`,
    );
  });

  test("removes obsolete generated files and publishes metadata last on rebuild", () => {
    const root = createFixture();
    buildWorkflowBundles(root, { plugins: PLUGINS });
    for (const plugin of PLUGINS) {
      fs.writeFileSync(bundlePath(root, plugin, "obsolete.mjs"), "export {};\n");
    }

    buildWorkflowBundles(root, { plugins: PLUGINS });

    for (const plugin of PLUGINS) {
      expect(fs.existsSync(bundlePath(root, plugin, "obsolete.mjs"))).toBe(false);
      expect(fs.existsSync(bundlePath(root, plugin, "bundle.json"))).toBe(true);
    }
    expect(checkWorkflowBundles(root, { plugins: PLUGINS })).toEqual([]);
  });

  test("rejects a generated symlink even when its target has canonical bytes", () => {
    const root = createFixture();
    buildWorkflowBundles(root, { plugins: PLUGINS });
    const generated = bundlePath(root, PLUGINS[0], "profile.mjs");
    fs.rmSync(generated);
    fs.symlinkSync(path.join(root, "_shared", "workflow", "src", "profile.mjs"), generated);

    expect(checkWorkflowBundles(root, { plugins: PLUGINS })).toContain(
      `${PLUGINS[0]}: generated file is not regular profile.mjs`,
    );

    buildWorkflowBundles(root, { plugins: PLUGINS });
    expect(fs.lstatSync(generated).isFile()).toBe(true);
    expect(checkWorkflowBundles(root, { plugins: PLUGINS })).toEqual([]);
  });

  test("hashes canonical relative paths as well as exact file bytes", () => {
    const root = createFixture();
    const entries = canonicalWorkflowEntries(root);
    const original = computeWorkflowSourceHash(entries);
    const renamed = entries.map((entry, index) =>
      index === 0 ? { ...entry, path: `renamed/${entry.path}` } : entry,
    );

    expect(computeWorkflowSourceHash(renamed)).not.toBe(original);
    expect(computeWorkflowSourceHash(entries)).toBe(original);
  });
});
