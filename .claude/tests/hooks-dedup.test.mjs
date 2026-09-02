import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

// Two properties, both invisible on read:
//  1. A hook declared inline in .claude-plugin/plugin.json is invisible to Codex.
//     Codex discovers plugin hooks only through <plugin>/hooks/hooks.json, so a
//     Codex-registered plugin that declares its hooks inline silently loses them
//     on that runtime.
//  2. A hook event declared in both places fires twice on Claude Code.
// hooks/hooks.json is the single source of truth whenever a plugin ships to Codex.

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listPlugins() {
  return fs
    .readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_"))
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(REPO_ROOT, name, ".claude-plugin", "plugin.json")));
}

const codexRegistered = new Set(
  (readJson(path.join(REPO_ROOT, ".agents", "plugins", "marketplace.json")).plugins ?? []).map(
    (p) => p.name,
  ),
);

function inlineEvents(plugin) {
  const manifest = readJson(path.join(REPO_ROOT, plugin, ".claude-plugin", "plugin.json"));
  return typeof manifest.hooks === "object" && manifest.hooks !== null
    ? Object.keys(manifest.hooks)
    : [];
}

function fileEvents(plugin) {
  const hooksJsonPath = path.join(REPO_ROOT, plugin, "hooks", "hooks.json");
  if (!fs.existsSync(hooksJsonPath)) return [];
  return Object.keys(readJson(hooksJsonPath).hooks ?? {});
}

describe("hooks reach both runtimes", () => {
  for (const plugin of listPlugins()) {
    if (!codexRegistered.has(plugin)) continue;

    test(`${plugin}: declares no hook inline (Codex reads only hooks/hooks.json)`, () => {
      expect(inlineEvents(plugin)).toEqual([]);
    });
  }
});

describe("hook declarations are not duplicated", () => {
  for (const plugin of listPlugins()) {
    const events = fileEvents(plugin);
    if (events.length === 0) continue;

    test(`${plugin}: plugin.json declares no event already covered by hooks/hooks.json`, () => {
      expect(inlineEvents(plugin).filter((e) => events.includes(e))).toEqual([]);
    });
  }
});
