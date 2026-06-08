#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { cleanupOldStates, findMoonRoot, writeState } from "./state.mjs";

// CLAUDE_PLUGIN_ROOT resolves to the plugin root (<plugin>/). Bail if absent.
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
if (!PLUGIN_ROOT) process.exit(0);

function readStdinJson() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

const { session_id } = readStdinJson();
if (!session_id) process.exit(0);

cleanupOldStates(PLUGIN_ROOT, 7);

const moonRoot = findMoonRoot();
if (!moonRoot) {
  // Not a moon workspace — moon-moth stays dark, says nothing.
  writeState(PLUGIN_ROOT, session_id, { in_moon: false });
  process.exit(0);
}

// Cheap, best-effort peek at what the lamp lit. Never let a slow/missing
// `moon` binary block session start — short timeout, swallow all errors.
function moon(args) {
  try {
    return execFileSync("moon", args, {
      cwd: moonRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    }).trim();
  } catch {
    return "";
  }
}

// `moon query changed-files` emits JSON on stdout natively (no --json flag).
let changedCount = 0;
const raw = moon(["query", "changed-files", "--local"]);
if (raw) {
  try {
    const parsed = JSON.parse(raw);
    changedCount = Array.isArray(parsed?.files) ? parsed.files.length : 0;
  } catch {}
}

writeState(PLUGIN_ROOT, session_id, {
  in_moon: true,
  moon_root: moonRoot,
  changed_files: changedCount,
});

const lamp =
  changedCount > 0
    ? `The lamp is lit: ${changedCount} changed file(s) detected.`
    : `No working-tree changes yet — the lamp comes on once you touch a file.`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `<system-reminder>moon-moth: this is a moon workspace (\`.moon/\` at ${moonRoot}). ${lamp} Before exploring broadly or running repo-wide tasks, scope to the affected project graph with the \`moon-moth:scope\` skill (it runs \`moon query changed-files\`/\`affected\` so you work only the touched packages, not the whole repo). Verify changes with \`moon-moth:verify\` (affected \`:typecheck\`/\`:lint\`/\`:test\`) before handing off.</system-reminder>`,
    },
  }),
);
