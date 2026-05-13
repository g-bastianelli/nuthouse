import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(import.meta.dir, "../hooks/session-start.mjs");
const PLUGIN_ROOT = path.resolve(import.meta.dir, "..");
const STATUSLINE_PATH = path.join(PLUGIN_ROOT, "hooks", "statusline.sh");

let tmpData;
let tmpHome;

beforeEach(() => {
  tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "saucy-session-data-"));
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "saucy-session-home-"));
  fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpData, { recursive: true, force: true });
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function runHook(env = {}, options = {}) {
  const childEnv = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    CLAUDE_PLUGIN_DATA: tmpData,
    HOME: tmpHome,
    ...env,
  };
  for (const name of options.deleteEnv ?? []) {
    delete childEnv[name];
  }
  return spawnSync("node", [HOOK], { encoding: "utf8", env: childEnv });
}

function writeSettings(payload) {
  fs.writeFileSync(path.join(tmpHome, ".claude", "settings.json"), JSON.stringify(payload));
}

function optIn(mode = "saucy") {
  fs.writeFileSync(path.join(tmpData, ".state"), mode);
}

test("exits silently when CLAUDE_PLUGIN_ROOT is missing", () => {
  const res = runHook({}, { deleteEnv: ["CLAUDE_PLUGIN_ROOT"] });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  expect(res.stderr).toBe("");
});

test("exits silently when CLAUDE_PLUGIN_DATA is missing", () => {
  const res = runHook({}, { deleteEnv: ["CLAUDE_PLUGIN_DATA"] });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  expect(res.stderr).toBe("");
});

test("exits silently when user has not opted in (no .state file)", () => {
  const res = runHook();
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
});

test('exits silently when user mode is "off"', () => {
  fs.writeFileSync(path.join(tmpData, ".state"), "off");
  const res = runHook();
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
});

test("emits install advice when opted in but settings.json is missing", () => {
  optIn();
  const res = runHook();
  expect(res.status).toBe(0);
  const out = JSON.parse(res.stdout);
  expect(out.hookSpecificOutput.hookEventName).toBe("SessionStart");
  expect(out.hookSpecificOutput.additionalContext).toContain("/saucy install");
});

test("emits install advice when opted in and statusLine command does not point here", () => {
  optIn("gooning");
  writeSettings({ statusLine: { command: "echo hello" } });
  const res = runHook();
  expect(res.status).toBe(0);
  const out = JSON.parse(res.stdout);
  expect(out.hookSpecificOutput.additionalContext).toContain("/saucy install");
});

test("exits silently when opted in and statusLine command points here", () => {
  optIn();
  writeSettings({
    statusLine: { command: `${STATUSLINE_PATH} ${PLUGIN_ROOT} ${tmpData}` },
  });
  const res = runHook();
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
});
