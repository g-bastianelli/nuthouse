import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const HOOKS_PATH = path.join(ROOT, "hooks", "hooks.json");
const GREET_SKILL_PATH = path.join(ROOT, "skills", "greet", "SKILL.md");

test("plugin bundles default Codex hooks for greet detection", () => {
  const config = JSON.parse(fs.readFileSync(HOOKS_PATH, "utf8"));
  const sessionHook = config.hooks.SessionStart[0].hooks[0];
  const promptHook = config.hooks.UserPromptSubmit[0].hooks[0];

  expect(config.hooks.SessionStart[0].matcher).toBe("startup");
  expect(sessionHook.type).toBe("command");
  expect(sessionHook.command).toContain("claudecode/hooks/session-start.mjs");
  expect(sessionHook.command).toContain("PLUGIN_ROOT");
  expect(sessionHook.statusMessage).toBeUndefined();
  expect(promptHook.type).toBe("command");
  expect(promptHook.command).toContain("claudecode/hooks/prompt-submit.mjs");
  expect(promptHook.command).toContain("PLUGIN_ROOT");
  expect(promptHook.statusMessage).toBeUndefined();
});

test("plugin relies on default hooks/hooks.json discovery, not manifest hooks", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, ".codex-plugin", "plugin.json"), "utf8"),
  );

  expect(manifest.hooks).toBeUndefined();
  expect(fs.existsSync(HOOKS_PATH)).toBe(true);
});

test("greet requires a fresh Linear signal and absent context", () => {
  const skill = fs.readFileSync(GREET_SKILL_PATH, "utf8");

  expect(skill).toContain("Never use on resume or compaction");
  expect(skill).toContain("Silent gate: Run workflow step 1 before any voice dispatch");
  expect(skill).toContain("On `main`, `master`, or `staging`");
  expect(skill).toContain("an injected summary, prior turns, or an existing context brief");
});
