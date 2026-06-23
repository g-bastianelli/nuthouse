import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const HOOKS_PATH = path.join(ROOT, "hooks", "hooks.json");

test("hooks.json wires the three discipline-delivery events", () => {
  const config = JSON.parse(fs.readFileSync(HOOKS_PATH, "utf8"));

  const session = config.hooks.SessionStart[0];
  expect(session.matcher).toBe("startup|resume");
  expect(session.hooks[0].command).toContain("claudecode/hooks/inject-digest.mjs");

  const edit = config.hooks.PostToolUse[0];
  expect(edit.matcher).toBe("Edit|Write|MultiEdit");
  expect(edit.hooks[0].command).toContain("claudecode/hooks/inject-on-edit.mjs");

  const review = config.hooks.SubagentStart[0];
  expect(review.matcher).toBe("review|auditor");
  expect(review.hooks[0].command).toContain("claudecode/hooks/inject-on-review.mjs");

  for (const evt of ["SessionStart", "PostToolUse", "SubagentStart"]) {
    const hook = config.hooks[evt][0].hooks[0];
    expect(hook.type).toBe("command");
    expect(hook.command).toContain("PLUGIN_ROOT");
  }
});

test("every hooks.json command points at a hook file that exists", () => {
  const config = JSON.parse(fs.readFileSync(HOOKS_PATH, "utf8"));
  for (const event of Object.values(config.hooks)) {
    for (const matcher of event) {
      for (const hook of matcher.hooks) {
        const rel = hook.command.match(/claudecode\/hooks\/[\w.-]+\.mjs/)[0];
        expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
      }
    }
  }
});

test("plugin relies on default hooks/hooks.json discovery, not manifest hooks", () => {
  expect(fs.existsSync(HOOKS_PATH)).toBe(true);
  for (const manifest of [".claude-plugin", ".codex-plugin"]) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, manifest, "plugin.json"), "utf8"));
    expect(json.hooks).toBeUndefined();
  }
});
