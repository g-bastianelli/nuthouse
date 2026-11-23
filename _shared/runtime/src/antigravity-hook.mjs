#!/usr/bin/env node
// Source of truth: _shared/runtime/src/antigravity-hook.mjs.
// `bun run build:runtime` copies this file verbatim into each hooked plugin's
// claudecode/hooks/. Edit the source above; plugin copies are overwritten.
//
// Antigravity bridge for the Claude-format hook scripts (ADR 0010). Antigravity runs a plugin
// hook from the plugin root with camelCase stdin and injects context only through
// `injectSteps` at SessionStart and PreInvocation. The bridge runs the shared script from the
// workspace with Claude-shaped stdin and maps `additionalContext` back. PostToolUse cannot
// inject, so its context waits under PLUGIN_DATA until the next PreInvocation.
//
// usage: node antigravity-hook.mjs SessionStart <script>
//        node antigravity-hook.mjs PostToolUse <script>
//        node antigravity-hook.mjs PreInvocation [<prompt-script>]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCRIPT_TIMEOUT_MS = 20_000;

export function toClaudeInput(event, input) {
  const args = input.toolCall?.args ?? {};
  // The CLI's write_file/edit_file use `Path`; the documented app tools use `TargetFile`.
  const filePath = args.Path ?? args.TargetFile;
  return {
    session_id: input.conversationId,
    cwd: input.workspacePaths?.[0] ?? input.cwd,
    hook_event_name: event === "PreInvocation" ? "UserPromptSubmit" : event,
    ...(event === "SessionStart" && { source: "startup" }),
    ...(event === "PreInvocation" && { prompt: input.lastUserInput ?? "" }),
    ...(event === "PostToolUse" && {
      tool_name: input.toolCall?.name,
      tool_input: typeof filePath === "string" ? { file_path: filePath } : {},
    }),
  };
}

function runScript(script, claudeInput) {
  const result = spawnSync(process.execPath, [script], {
    cwd: claudeInput.cwd,
    encoding: "utf8",
    input: JSON.stringify(claudeInput),
    timeout: SCRIPT_TIMEOUT_MS,
  });
  try {
    return JSON.parse(result.stdout)?.hookSpecificOutput?.additionalContext ?? "";
  } catch {
    return "";
  }
}

function pendingPath(dataDir, conversationId) {
  const id = String(conversationId ?? "unknown").replace(/[^\w-]/g, "_");
  return path.join(dataDir, "antigravity-pending", `${id}.md`);
}

export function runBridge(event, script, input, dataDir) {
  const claudeInput = toClaudeInput(event, input);
  const pending = pendingPath(dataDir, input.conversationId);

  if (event === "PostToolUse") {
    const context = script ? runScript(script, claudeInput) : "";
    if (context) {
      fs.mkdirSync(path.dirname(pending), { recursive: true });
      fs.appendFileSync(pending, `${context}\n`);
    }
    return {};
  }

  const parts = [];
  if (event === "PreInvocation") {
    try {
      parts.push(fs.readFileSync(pending, "utf8").trim());
      fs.rmSync(pending);
    } catch {}
    // A turn's prompt does not change after its first model call.
    if (script && input.invocationNum === 0) parts.push(runScript(script, claudeInput));
  } else if (event === "SessionStart" && script) {
    parts.push(runScript(script, claudeInput));
  }

  const context = parts.filter(Boolean).join("\n\n");
  return context ? { injectSteps: [{ systemMessage: { systemMessage: context } }] } : {};
}

function main() {
  const [event, script] = process.argv.slice(2);
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, "utf8")) ?? {};
  } catch {}
  let output = {};
  try {
    output = runBridge(
      event,
      script && path.resolve(script),
      input,
      process.env.PLUGIN_DATA || os.tmpdir(),
    );
  } catch {}
  // Antigravity requires JSON on stdout and exit 0; a failure only drops the context.
  process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
