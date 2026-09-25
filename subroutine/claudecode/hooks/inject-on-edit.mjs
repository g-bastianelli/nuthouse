#!/usr/bin/env node
// subroutine PostToolUse hook (shared by Claude Code & Codex).
//
// When the agent edits/writes files, inject the discipline bodies whose `paths`
// globs match them as additionalContext — deterministic delivery of the rules that
// model-driven skill invocation never reliably loaded. The SKILL.md files stay
// the source of truth; this hook only reads and packs them.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildInjection,
  disciplineEnvelope,
  discoverSkills,
  matchSkills,
  sessionIdOf,
} from "./lib/skills.mjs";

const exit0 = () => process.exit(0);

// Claude Code's Edit/Write/MultiEdit carry `tool_input.file_path`; Codex's
// apply_patch carries only the patch text in `tool_input.command`.
const FILE_HEADER = /^\*\*\* (Add File|Update File|Move to|Delete File): (.+?)\s*$/;

/** Absolute paths of the files that exist after the edit, deduplicated. */
function editedPaths(input) {
  const toolInput = input?.tool_input;
  const filePath = toolInput?.file_path;
  if (typeof filePath === "string" && filePath !== "") return [filePath];

  const patch = toolInput?.command;
  if (typeof patch !== "string") return [];
  const cwd = typeof input?.cwd === "string" && input.cwd ? input.cwd : process.cwd();
  const written = [];
  let previousKind = "";
  for (const line of patch.split("\n")) {
    const header = FILE_HEADER.exec(line);
    if (!header) continue;
    const [, kind, file] = header;
    // A move follows its `Update File:` header and replaces the source path.
    if (kind === "Move to" && previousKind === "Update File") written.pop();
    if (kind !== "Delete File") written.push(path.resolve(cwd, file));
    previousKind = kind;
  }
  return [...new Set(written)];
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  exit0();
}

const filePaths = editedPaths(input);
if (!filePaths.length) exit0();

const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
const matched = matchSkills(discoverSkills(skillsDir), filePaths);
if (!matched.length) exit0();

// Dedup per context: a discipline body is injected in full at most once per
// session and subagent; later edits get a one-line reminder instead of a fresh
// ~9 KB copy.
const sessionId = sessionIdOf(input);
const agentId = String(input?.agent_id ?? "");
const additionalContext = buildInjection(matched, sessionId, disciplineEnvelope(skillsDir), {
  agentId,
});
if (!additionalContext) exit0();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext,
    },
  }),
);
