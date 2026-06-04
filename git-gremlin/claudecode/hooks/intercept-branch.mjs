#!/usr/bin/env node
// git-gremlin spawn hook — PreToolUse interceptor (shared by Claude Code & Codex).
//
// One workspace per branch. When the agent tries to create a branch in place
// (`git checkout -b`, `git switch -c`, `git branch <new>`), this hook DENIES the
// Bash call and instructs the agent to spawn a dedicated Superset workspace (an
// isolated git worktree) with a fresh agent picking up the task instead.
//
// Both runtimes feed a JSON object on stdin and read a JSON decision on stdout
// with the identical PreToolUse `permissionDecision: "deny"` contract, so a
// single script serves both. The deny reason is surfaced back to the model, which
// then self-corrects to the workspace flow.
//
// Safety gate: only enforced when the cwd lives under the Superset-managed tree
// (~/.superset/projects or ~/.superset/worktrees). Outside Superset, or when
// GIT_GREMLIN_SPAWN_DISABLE is set, the hook stays out of the way (exit 0, allow).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectBranchCreation } from "./branch-detect.mjs";

const allow = () => process.exit(0);

const readStdinJson = () => {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return null;
  }
};

const isSupersetContext = (cwd) => {
  if (typeof cwd !== "string" || cwd === "") return false;
  const root = path.join(os.homedir(), ".superset");
  const resolved = path.resolve(cwd);
  return (
    resolved === path.join(root, "projects") ||
    resolved === path.join(root, "worktrees") ||
    resolved.startsWith(path.join(root, "projects") + path.sep) ||
    resolved.startsWith(path.join(root, "worktrees") + path.sep)
  );
};

if (process.env.GIT_GREMLIN_SPAWN_DISABLE) allow();

const input = readStdinJson();
if (!input) allow();

if (input.tool_name !== "Bash") allow();

const command = input.tool_input?.command;
const hit = detectBranchCreation(command);
if (!hit) allow();

if (!isSupersetContext(input.cwd)) allow();

const branch = hit.branch ?? "<branch>";
const reason = [
  "git-gremlin: branch creation intercepted. one workspace per branch here — no in-place branches.",
  "",
  `Do NOT run \`${command}\`. Instead, spawn an isolated Superset workspace (a dedicated git worktree)`,
  "that starts a fresh agent on the task, then stop work in the current workspace.",
  "",
  "Preferred: invoke the `git-gremlin:spawn` skill. It wraps, roughly:",
  `  superset workspaces create --local --branch ${branch} \\`,
  "    --base-branch <current-branch> --agent <claude|codex> \\",
  '    --prompt "<the task to continue, summarized>"',
  "",
  "The new agent takes over inside its own worktree. The current agent does not create the branch.",
].join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }),
);
process.exit(0);
