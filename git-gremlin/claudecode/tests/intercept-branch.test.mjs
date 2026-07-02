import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(import.meta.dir, "../hooks/intercept-branch.mjs");
const SUPERSET_CWD = path.join(os.homedir(), ".superset", "projects", "nuthouse");
const OUTSIDE_CWD = "/tmp/some-other-repo";

const run = (input, env = {}) => {
  const res = spawnSync("node", [HOOK], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, GIT_GREMLIN_SPAWN_DISABLE: "", ...env },
  });
  return res;
};

const decision = (res) => {
  if (!res.stdout.trim()) return null;
  return JSON.parse(res.stdout).hookSpecificOutput;
};

test("denies branch creation inside a Superset workspace", () => {
  const res = run({
    tool_name: "Bash",
    tool_input: { command: "git checkout -b feat-x" },
    cwd: SUPERSET_CWD,
  });
  const out = decision(res);
  expect(out.hookEventName).toBe("PreToolUse");
  expect(out.permissionDecision).toBe("deny");
  expect(out.permissionDecisionReason).toContain("git-gremlin:spawn");
  expect(out.permissionDecisionReason).toContain("feat-x");
  expect(out.permissionDecisionReason).toContain("superset workspaces create");
  expect(out.permissionDecisionReason).toContain("choose Codex or Claude");
});

test("allows branch creation OUTSIDE the Superset tree", () => {
  const res = run({
    tool_name: "Bash",
    tool_input: { command: "git checkout -b feat-x" },
    cwd: OUTSIDE_CWD,
  });
  expect(res.stdout.trim()).toBe("");
  expect(res.status).toBe(0);
});

test("allows non-creation git commands inside Superset", () => {
  const res = run({
    tool_name: "Bash",
    tool_input: { command: "git status" },
    cwd: SUPERSET_CWD,
  });
  expect(res.stdout.trim()).toBe("");
});

test("ignores non-Bash tools", () => {
  const res = run({
    tool_name: "Read",
    tool_input: { file_path: "/x" },
    cwd: SUPERSET_CWD,
  });
  expect(res.stdout.trim()).toBe("");
});

test("kill-switch env disables interception", () => {
  const res = run(
    {
      tool_name: "Bash",
      tool_input: { command: "git checkout -b feat-x" },
      cwd: SUPERSET_CWD,
    },
    { GIT_GREMLIN_SPAWN_DISABLE: "1" },
  );
  expect(res.stdout.trim()).toBe("");
});

test("malformed stdin is allowed (fail-open)", () => {
  const res = spawnSync("node", [HOOK], {
    input: "not json",
    encoding: "utf8",
    env: { ...process.env, GIT_GREMLIN_SPAWN_DISABLE: "" },
  });
  expect(res.stdout.trim()).toBe("");
  expect(res.status).toBe(0);
});
