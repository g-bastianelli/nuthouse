import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");

test("Monkey Maestro registers the branch guard through hooks.json", () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "hooks", "hooks.json"), "utf8"));
  const registration = config.hooks.PreToolUse[0];
  const hook = registration.hooks[0];
  expect(registration.matcher).toBe("Bash");
  expect(hook.type).toBe("command");
  expect(hook.command).toContain("claudecode/hooks/intercept-branch.mjs");
  expect(hook.command).toContain("PLUGIN_ROOT");
  expect(fs.existsSync(path.join(ROOT, "claudecode", "hooks", "intercept-branch.mjs"))).toBe(true);
});

test("the manifest relies on default hooks discovery", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, ".codex-plugin", "plugin.json"), "utf8"),
  );
  expect(manifest.hooks).toBeUndefined();
});
