import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");

// A hook event declared both inline in .claude-plugin/plugin.json and in
// <plugin>/hooks/hooks.json fires twice. One source of truth per event:
// hooks/hooks.json wins when it exists.
function listPlugins() {
  return fs
    .readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_"))
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(REPO_ROOT, name, ".claude-plugin", "plugin.json")));
}

describe("hook declarations are not duplicated", () => {
  for (const plugin of listPlugins()) {
    const hooksJsonPath = path.join(REPO_ROOT, plugin, "hooks", "hooks.json");
    if (!fs.existsSync(hooksJsonPath)) continue;

    test(`${plugin}: plugin.json declares no event already covered by hooks/hooks.json`, () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, plugin, ".claude-plugin", "plugin.json"), "utf8"),
      );
      const hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, "utf8"));
      const fileEvents = Object.keys(hooksJson.hooks ?? {});
      const inlineEvents =
        typeof manifest.hooks === "object" && manifest.hooks !== null
          ? Object.keys(manifest.hooks)
          : [];
      const duplicated = inlineEvents.filter((e) => fileEvents.includes(e));
      expect(duplicated).toEqual([]);
    });
  }
});
