#!/usr/bin/env node
// Monkey Maestro branch guard — shared PreToolUse interceptor for Claude Code and Codex.

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
  return ["projects", "worktrees"].some((directory) => {
    const managedRoot = path.join(root, directory);
    return resolved === managedRoot || resolved.startsWith(`${managedRoot}${path.sep}`);
  });
};

if (process.env.MONKEY_MAESTRO_SPAWN_DISABLE) allow();

const input = readStdinJson();
if (!input || input.tool_name !== "Bash") allow();

const command = input.tool_input?.command;
const match = detectBranchCreation(command);
if (!match || !isSupersetContext(input.cwd)) allow();

const branch = match.branch ?? "<branch>";
const reason = [
  "monkey-maestro: branch creation intercepted — Superset work stays one workspace per branch.",
  "",
  `Do NOT run \`${command}\` in this workspace.`,
  "Invoke the `monkey-maestro:spawn` skill for the Linear issue/task instead.",
  `Pass \`${branch}\` only as the requested branch hint; spawn resolves the exact Linear identifier and Superset task,`,
  "checks existing taskId mappings, creates the workspace first, then launches its agent.",
  "",
  "The standalone spawn workflow shows its own mutation gate. If this issue belongs to an",
  "active Maestro project, use `monkey-maestro:orchestrate <project-id>` instead.",
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
