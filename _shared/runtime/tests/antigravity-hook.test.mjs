import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runBridge, toClaudeInput } from "../src/antigravity-hook.mjs";

const roots = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-agy-hook-"));
  roots.push(root);
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace);
  // Echoes what a Claude-format hook script received, as additionalContext.
  const script = path.join(root, "echo.mjs");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
const input = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify({ hookSpecificOutput: {
  additionalContext: [input.hook_event_name, input.session_id, process.cwd(), input.prompt ?? input.tool_input?.file_path ?? input.source].join("|"),
} }));`,
  );
  return { data: path.join(root, "data"), script, workspace: fs.realpathSync(workspace) };
}

const base = (workspace) => ({ conversationId: "c-1", workspacePaths: [workspace] });
const injected = (output) => output.injectSteps?.[0]?.systemMessage?.systemMessage;

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("antigravity hook bridge", () => {
  test("maps Antigravity payloads to the Claude hook shape", () => {
    expect(
      toClaudeInput("PostToolUse", {
        conversationId: "c",
        workspacePaths: ["/w"],
        toolCall: { name: "edit_file", args: { Path: "/w/a.ts" } },
      }),
    ).toEqual({
      session_id: "c",
      cwd: "/w",
      hook_event_name: "PostToolUse",
      tool_name: "edit_file",
      tool_input: { file_path: "/w/a.ts" },
    });
    expect(toClaudeInput("PreInvocation", { lastUserInput: "hi", cwd: "/x" })).toMatchObject({
      cwd: "/x",
      hook_event_name: "UserPromptSubmit",
      prompt: "hi",
    });
  });

  test("injects SessionStart context from the script run in the workspace", () => {
    const { data, script, workspace } = fixture();
    expect(injected(runBridge("SessionStart", script, base(workspace), data))).toBe(
      `SessionStart|c-1|${workspace}|startup`,
    );
  });

  test("defers PostToolUse context to the next PreInvocation, once", () => {
    const { data, script, workspace } = fixture();
    const edit = { ...base(workspace), toolCall: { name: "write_file", args: { Path: "/a.ts" } } };
    expect(runBridge("PostToolUse", script, edit, data)).toEqual({});
    expect(injected(runBridge("PreInvocation", undefined, base(workspace), data))).toBe(
      `PostToolUse|c-1|${workspace}|/a.ts`,
    );
    expect(runBridge("PreInvocation", undefined, base(workspace), data)).toEqual({});
    // The claimed copy is consumed, so nothing is left to inject twice.
    expect(fs.readdirSync(path.join(data, "antigravity-pending"))).toEqual([]);
  });

  test("runs the prompt script only on a turn's first model call", () => {
    const { data, script, workspace } = fixture();
    const turn = { ...base(workspace), lastUserInput: "fix LIN-1" };
    expect(injected(runBridge("PreInvocation", script, { ...turn, invocationNum: 0 }, data))).toBe(
      `UserPromptSubmit|c-1|${workspace}|fix LIN-1`,
    );
    expect(runBridge("PreInvocation", script, { ...turn, invocationNum: 1 }, data)).toEqual({});
  });

  test("drops context instead of failing when the script breaks", () => {
    const { data, workspace } = fixture();
    expect(runBridge("SessionStart", "/missing.mjs", base(workspace), data)).toEqual({});
  });
});
