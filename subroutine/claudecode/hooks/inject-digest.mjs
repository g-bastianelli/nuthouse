#!/usr/bin/env node
// subroutine SessionStart hook (shared by Claude Code & Codex).
//
// PostToolUse delivers the full discipline once a TS file is edited, but the
// very first edit would be unguided. This hook injects a compact digest (one
// line per discipline, from each skill's description) at session start so the
// spine of the discipline is present from turn one. Stays dark outside
// TypeScript projects so it never adds noise where it doesn't belong.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDigest, discoverSkills } from "./lib/skills.mjs";

const exit0 = () => process.exit(0);

let input;
try {
  input = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  input = null;
}

const cwd = typeof input?.cwd === "string" && input.cwd ? input.cwd : process.cwd();

// TS-repo guard: a tsconfig anywhere from cwd up to the filesystem root marks a
// TypeScript repo. An unreadable level is skipped (not fatal), so a permission
// error on an intermediate dir can't suppress a tsconfig sitting above it.
function looksLikeTsRepo(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 40; i++) {
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      names = [];
    }
    if (names.some((f) => /^tsconfig(\..+)?\.json$/.test(f))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

if (!looksLikeTsRepo(cwd)) exit0();

const skillsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
const skills = discoverSkills(skillsDir);
if (!skills.length) exit0();

const digest = buildDigest(skills);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `<system-reminder>subroutine is active in this TypeScript repo. Implement to these disciplines from the start; the full rules auto-load when you edit a matching file (the repo's own AGENTS.md overrides where it is stricter):\n${digest}</system-reminder>`,
    },
  }),
);
