import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tmpRoot;
let tmpData;
let tmpBin;
const HOOK = path.resolve(import.meta.dir, "../hooks/session-start.mjs");

function runHook(stdinJson, env = {}, options = {}) {
  const childEnv = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: tmpRoot,
    CLAUDE_PLUGIN_DATA: tmpData,
    PATH: `${tmpBin}:${process.env.PATH}`,
    ...env,
  };
  for (const name of options.deleteEnv ?? []) {
    delete childEnv[name];
  }
  return spawnSync("node", [HOOK], {
    input: JSON.stringify(stdinJson),
    encoding: "utf8",
    env: childEnv,
  });
}

function stubGit(script) {
  const gitPath = path.join(tmpBin, "git");
  fs.writeFileSync(gitPath, `#!/usr/bin/env bash\n${script}\n`, { mode: 0o755 });
}

function expectRootDataUnused() {
  expect(fs.existsSync(path.join(tmpRoot, "data"))).toBe(false);
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "linear-devotee-root-"));
  tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "linear-devotee-data-"));
  tmpBin = fs.mkdtempSync(path.join(os.tmpdir(), "linear-devotee-bin-"));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(tmpData, { recursive: true, force: true });
  fs.rmSync(tmpBin, { recursive: true, force: true });
});

test("exits silently when not in a git repo", () => {
  stubGit(`if [ "$1" = "rev-parse" ]; then exit 128; fi`);
  const res = runHook({ session_id: "sess-1" });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  const state = JSON.parse(fs.readFileSync(path.join(tmpData, "state-sess-1.json"), "utf8"));
  expect(state.in_repo).toBe(false);
  expect(state.greeted).toBe(true);
  expectRootDataUnused();
});

test("exits silently without writing root data when CLAUDE_PLUGIN_DATA is missing", () => {
  stubGit(`
    case "$1" in
      rev-parse) exit 0 ;;
      branch) echo "g-bastianelli/eng-247-foo" ;;
    esac
  `);
  const res = runHook(
    { session_id: "sess-missing-data" },
    {},
    { deleteEnv: ["CLAUDE_PLUGIN_DATA"] },
  );
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  expectRootDataUnused();
});

test("detects identifier from feature branch and outputs additionalContext", () => {
  stubGit(`
    case "$1" in
      rev-parse) exit 0 ;;
      branch) echo "g-bastianelli/eng-247-foo" ;;
    esac
  `);
  const res = runHook({ session_id: "sess-2" });
  expect(res.status).toBe(0);
  const out = JSON.parse(res.stdout);
  expect(out.hookSpecificOutput.hookEventName).toBe("SessionStart");
  expect(out.hookSpecificOutput.additionalContext).toContain("ENG-247");
  const state = JSON.parse(fs.readFileSync(path.join(tmpData, "state-sess-2.json"), "utf8"));
  expect(state.issue).toBe("ENG-247");
  expect(state.source).toBe("branch");
  expect(state.awaiting_prompt).toBe(false);
  expectRootDataUnused();
});

test("on main branch with no id, marks needs_branch and awaiting_prompt", () => {
  stubGit(`
    case "$1" in
      rev-parse) exit 0 ;;
      branch) echo "main" ;;
    esac
  `);
  const res = runHook({ session_id: "sess-3" });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  const state = JSON.parse(fs.readFileSync(path.join(tmpData, "state-sess-3.json"), "utf8"));
  expect(state.issue).toBeNull();
  expect(state.needs_branch).toBe(true);
  expect(state.awaiting_prompt).toBe(true);
  expect(state.current_branch).toBe("main");
  expectRootDataUnused();
});

test("on neutral branch with no id, no needs_branch but awaiting_prompt", () => {
  stubGit(`
    case "$1" in
      rev-parse) exit 0 ;;
      branch) echo "experiment-foo" ;;
    esac
  `);
  const res = runHook({ session_id: "sess-4" });
  expect(res.status).toBe(0);
  expect(res.stdout).toBe("");
  const state = JSON.parse(fs.readFileSync(path.join(tmpData, "state-sess-4.json"), "utf8"));
  expect(state.needs_branch).toBe(false);
  expect(state.awaiting_prompt).toBe(true);
  expectRootDataUnused();
});
