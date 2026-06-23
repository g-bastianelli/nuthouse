import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOKS = path.resolve(import.meta.dir, "..", "hooks");
const ADDITIONAL_CONTEXT_CAP = 10000;

// Run a hook .mjs the way the runtime does: `node <hook>` with a JSON object on
// stdin. Returns parsed stdout JSON, or null when the hook stays silent (exit 0,
// no output).
function runHook(file, payload, env) {
  const out = execFileSync("node", [path.join(HOOKS, file)], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: env ? { ...process.env, ...env } : process.env,
  }).trim();
  return out ? JSON.parse(out) : null;
}

test("inject-on-edit emits PostToolUse discipline for a .ts edit, under the cap", () => {
  const res = runHook("inject-on-edit.mjs", {
    tool_input: { file_path: "/repo/src/service.ts" },
  });
  expect(res.hookSpecificOutput.hookEventName).toBe("PostToolUse");
  const ctx = res.hookSpecificOutput.additionalContext;
  expect(ctx).toContain("type-safety");
  expect(ctx.length).toBeLessThan(ADDITIONAL_CONTEXT_CAP);
});

test("inject-on-edit emits react discipline for a .tsx edit", () => {
  const res = runHook("inject-on-edit.mjs", {
    tool_input: { file_path: "/repo/src/Button.tsx" },
  });
  expect(res.hookSpecificOutput.additionalContext).toContain("react-rules");
});

test("inject-on-edit stays silent for a non-matching file", () => {
  expect(
    runHook("inject-on-edit.mjs", { tool_input: { file_path: "/repo/README.md" } }),
  ).toBeNull();
});

test("inject-on-edit stays silent on missing/garbage input", () => {
  expect(runHook("inject-on-edit.mjs", {})).toBeNull();
});

test("inject-on-review briefs a review subagent, under the cap", () => {
  const res = runHook("inject-on-review.mjs", { agent_type: "git-gremlin:reviewer" });
  expect(res.hookSpecificOutput.hookEventName).toBe("SubagentStart");
  expect(res.hookSpecificOutput.additionalContext).toContain("type-safety");
  expect(res.hookSpecificOutput.additionalContext.length).toBeLessThan(ADDITIONAL_CONTEXT_CAP);
});

test("inject-on-review also recognises the subagent_type field name", () => {
  const res = runHook("inject-on-review.mjs", { subagent_type: "code-reviewer" });
  expect(res.hookSpecificOutput.hookEventName).toBe("SubagentStart");
});

test("inject-on-review briefs moon-moth's change-auditor", () => {
  const res = runHook("inject-on-review.mjs", { subagent_type: "moon-moth:change-auditor" });
  expect(res.hookSpecificOutput.hookEventName).toBe("SubagentStart");
  expect(res.hookSpecificOutput.additionalContext).toContain("type-safety");
});

test("inject-on-review ignores 'preview' substring and document/plan auditors", () => {
  expect(runHook("inject-on-review.mjs", { agent_type: "preview-generator" })).toBeNull();
  expect(runHook("inject-on-review.mjs", { agent_type: "acid-prophet:spec-auditor" })).toBeNull();
  expect(runHook("inject-on-review.mjs", { agent_type: "plan-auditor" })).toBeNull();
});

test("inject-on-review stays silent for a non-review subagent", () => {
  expect(runHook("inject-on-review.mjs", { agent_type: "Explore" })).toBeNull();
});

test("inject-on-edit dedups within a session: full bodies first, reminder on repeat", () => {
  const memo = fs.mkdtempSync(path.join(os.tmpdir(), "subroutine-e2e-"));
  const env = { SUBROUTINE_MEMO_DIR: memo };
  const payload = { tool_input: { file_path: "/repo/src/service.ts" }, session_id: "e2e-1" };
  try {
    const first = runHook("inject-on-edit.mjs", payload, env);
    expect(first.hookSpecificOutput.additionalContext).toContain("### type-safety");
    const second = runHook("inject-on-edit.mjs", payload, env);
    expect(second.hookSpecificOutput.additionalContext).toContain(
      "Still binding (loaded earlier this session)",
    );
    expect(second.hookSpecificOutput.additionalContext).not.toContain("### type-safety");
  } finally {
    fs.rmSync(memo, { recursive: true, force: true });
  }
});

test("inject-on-edit packs a .tsx edit's react-rules as a full body", () => {
  const res = runHook("inject-on-edit.mjs", { tool_input: { file_path: "/repo/src/Button.tsx" } });
  expect(res.hookSpecificOutput.additionalContext).toContain("### react-rules");
});

test("inject-digest emits a SessionStart digest inside a TS repo", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subroutine-ts-"));
  fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}");
  try {
    const res = runHook("inject-digest.mjs", { cwd: dir });
    expect(res.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(res.hookSpecificOutput.additionalContext).toContain("type-safety");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("inject-digest stays silent outside a TS repo", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subroutine-nots-"));
  try {
    expect(runHook("inject-digest.mjs", { cwd: dir })).toBeNull();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
