#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createClaudeRuntime } from "../lib/runtime.mjs";
import { extractIssueId } from "./state.mjs";

if (!process.env.CLAUDE_PLUGIN_DATA) process.exit(0);

const runtime = createClaudeRuntime();
const statePath = (sessionId) => runtime.sessionStatePath("state", sessionId);

const DEFAULT_BRANCHES = new Set(["main", "master", "staging"]);

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function inGitRepo() {
  try {
    git(["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

const { session_id } = readStdinJson();
if (!session_id) process.exit(0);

runtime.cleanupSessionState("state", 7);

if (!inGitRepo()) {
  runtime.writeJson(statePath(session_id), { greeted: true, in_repo: false });
  process.exit(0);
}

const branch = (() => {
  try {
    return git(["branch", "--show-current"]);
  } catch {
    return "";
  }
})();

const issue = extractIssueId(branch);
const needs_branch = issue == null && DEFAULT_BRANCHES.has(branch);

const state = {
  greeted: false,
  awaiting_prompt: issue == null,
  issue,
  source: issue ? "branch" : null,
  current_branch: branch,
  needs_branch,
  in_repo: true,
};
runtime.writeJson(statePath(session_id), state);

if (issue) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: `<EXTREMELY-IMPORTANT>linear-devotee detected Linear issue ${issue} on the current branch. Invoke the \`linear-devotee:greet\` skill BEFORE doing anything else (including answering or running other tools).</EXTREMELY-IMPORTANT>`,
      },
    }),
  );
}
