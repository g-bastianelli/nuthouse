import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(import.meta.dir, "../hooks/loading-message.mjs");
const PLUGIN_ROOT = path.resolve(import.meta.dir, "..");

let tmpData;

beforeEach(() => {
  tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "saucy-loading-"));
});

afterEach(() => {
  fs.rmSync(tmpData, { recursive: true, force: true });
});

function runHook(env = {}, options = {}) {
  const childEnv = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    CLAUDE_PLUGIN_DATA: tmpData,
    ...env,
  };
  for (const name of options.deleteEnv ?? []) {
    delete childEnv[name];
  }
  return spawnSync("node", [HOOK], { encoding: "utf8", env: childEnv });
}

test("exits silently when CLAUDE_PLUGIN_DATA is missing", () => {
  const res = runHook({}, { deleteEnv: ["CLAUDE_PLUGIN_DATA"] });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  expect(res.stderr).toBe("");
});

test("exits silently when .state is absent", () => {
  const res = runHook();
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
});

test('exits silently when mode is "off"', () => {
  fs.writeFileSync(path.join(tmpData, ".state"), "off");
  const res = runHook();
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
});

test("exits silently when mode value is unrecognised", () => {
  fs.writeFileSync(path.join(tmpData, ".state"), "banana");
  const res = runHook();
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
});

test('emits a saucy message when mode is "saucy"', () => {
  fs.writeFileSync(path.join(tmpData, ".state"), "saucy\n");
  const res = runHook();
  expect(res.status).toBe(0);
  const out = JSON.parse(res.stdout);
  expect(typeof out.systemMessage).toBe("string");
  expect(out.systemMessage.length).toBeGreaterThan(0);
});

test('emits a gooning message when mode is "gooning"', () => {
  fs.writeFileSync(path.join(tmpData, ".state"), "gooning");
  const res = runHook();
  expect(res.status).toBe(0);
  const out = JSON.parse(res.stdout);
  expect(typeof out.systemMessage).toBe("string");
});
