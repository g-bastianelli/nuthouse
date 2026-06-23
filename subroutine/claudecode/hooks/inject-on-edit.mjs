#!/usr/bin/env node
// subroutine PostToolUse hook (shared by Claude Code & Codex).
//
// When the agent edits/writes a file, inject the discipline bodies whose `paths`
// globs match it as additionalContext — deterministic delivery of the rules that
// model-driven skill invocation never reliably loaded. The SKILL.md files stay
// the source of truth; this hook only reads and packs them.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildInjection, discoverSkills, matchSkills } from "./lib/skills.mjs";

const exit0 = () => process.exit(0);

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  exit0();
}

const filePath = input?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath === "") exit0();

const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
const matched = matchSkills(discoverSkills(skillsDir), filePath);
if (!matched.length) exit0();

// Dedup per session: a discipline body is injected in full at most once per
// session; later edits get a one-line reminder instead of a fresh ~9 KB copy.
const sessionId = String(input?.session_id ?? input?.sessionId ?? "");
const additionalContext = buildInjection(
  matched,
  sessionId,
  (body) =>
    `<system-reminder>subroutine — discipline bound to this file (the repo's own AGENTS.md overrides where it is stricter):\n${body}</system-reminder>`,
);
if (!additionalContext) exit0();

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext,
    },
  }),
);
