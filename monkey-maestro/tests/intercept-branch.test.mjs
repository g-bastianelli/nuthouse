import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const HOOK = path.resolve(import.meta.dir, "..", "claudecode", "hooks", "intercept-branch.mjs");
const SUPERSET_CWD = path.join(os.homedir(), ".superset", "projects", "nuthouse");

function run(input, env = {}) {
  return spawnSync("node", [HOOK], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, MONKEY_MAESTRO_SPAWN_DISABLE: "", ...env },
  });
}

function decision(result) {
  return result.stdout.trim() ? JSON.parse(result.stdout).hookSpecificOutput : null;
}

test("redirects in-place branch creation to monkey-maestro:spawn", () => {
  const output = decision(
    run({
      tool_name: "Bash",
      tool_input: { command: "git checkout -b feat-x" },
      cwd: SUPERSET_CWD,
    }),
  );
  expect(output.hookEventName).toBe("PreToolUse");
  expect(output.permissionDecision).toBe("deny");
  expect(output.permissionDecisionReason).toContain("monkey-maestro:spawn");
  expect(output.permissionDecisionReason).toContain("feat-x");
  expect(output.permissionDecisionReason).toContain("taskId");
  expect(output.permissionDecisionReason).not.toContain("git-gremlin:spawn");
});

test("allows branch creation outside Superset", () => {
  const result = run({
    tool_name: "Bash",
    tool_input: { command: "git switch -c feat-x" },
    cwd: "/tmp/another-repo",
  });
  expect(result.stdout.trim()).toBe("");
  expect(result.status).toBe(0);
});

test("allows non-creation and non-Bash tools", () => {
  expect(
    run({ tool_name: "Bash", tool_input: { command: "git status" }, cwd: SUPERSET_CWD }).stdout,
  ).toBe("");
  expect(run({ tool_name: "Read", tool_input: {}, cwd: SUPERSET_CWD }).stdout).toBe("");
});

test("Monkey Maestro kill switch disables interception", () => {
  const result = run(
    {
      tool_name: "Bash",
      tool_input: { command: "git branch feat-x" },
      cwd: SUPERSET_CWD,
    },
    { MONKEY_MAESTRO_SPAWN_DISABLE: "1" },
  );
  expect(result.stdout.trim()).toBe("");
});

test("malformed stdin fails open", () => {
  const result = spawnSync("node", [HOOK], {
    input: "not json",
    encoding: "utf8",
    env: { ...process.env, MONKEY_MAESTRO_SPAWN_DISABLE: "" },
  });
  expect(result.stdout.trim()).toBe("");
  expect(result.status).toBe(0);
});
