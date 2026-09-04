#!/usr/bin/env node
import { findMoonRoot } from "./workspace.mjs";

const moonRoot = findMoonRoot();
if (!moonRoot) {
  // Not a moon workspace — moon-moth stays dark, says nothing.
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `<system-reminder>Moon workspace: ${moonRoot}. For cross-project work, use \`moon-moth:scope\`; after edits, use \`moon-moth:verify\`.</system-reminder>`,
    },
  }),
);
