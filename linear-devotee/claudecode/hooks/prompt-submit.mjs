#!/usr/bin/env node
import fs from 'node:fs';
import { createClaudeRuntime } from '../lib/runtime.mjs';
import { extractIssueId, readState, writeState } from './state.mjs';

const runtime = createClaudeRuntime();
const PLUGIN_DATA = runtime.pluginData();

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const { session_id, prompt } = readStdinJson();
if (!session_id) process.exit(0);

const state = readState(PLUGIN_DATA, session_id);
if (!state || state.awaiting_prompt !== true) process.exit(0);

const issue = extractIssueId(prompt || '');

const updated = {
  ...state,
  awaiting_prompt: false,
  issue: issue ?? state.issue ?? null,
  source: issue ? 'prompt' : state.source,
};
writeState(PLUGIN_DATA, session_id, updated);

if (issue) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `<EXTREMELY-IMPORTANT>linear-devotee detected Linear issue ${issue} in your prompt. Invoke the \`linear-devotee:greet\` skill BEFORE doing anything else (including answering or running other tools).</EXTREMELY-IMPORTANT>`,
      },
    }),
  );
}
