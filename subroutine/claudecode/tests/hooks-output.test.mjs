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

test("inject-on-edit names a skills dir where routed references resolve", () => {
  const res = runHook("inject-on-edit.mjs", { tool_input: { file_path: "/repo/src/Button.tsx" } });
  const dir = res.hookSpecificOutput.additionalContext.match(/resolve under (.+)\/<skill>\//)?.[1];
  expect(dir).toBeDefined();
  expect(fs.existsSync(path.join(dir, "react-rules", "references", "components.md"))).toBe(true);
});

test("inject-on-edit stays silent for a non-matching file", () => {
  expect(
    runHook("inject-on-edit.mjs", { tool_input: { file_path: "/repo/README.md" } }),
  ).toBeNull();
});

test("inject-on-edit stays silent on missing/garbage input", () => {
  expect(runHook("inject-on-edit.mjs", {})).toBeNull();
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

test("inject-on-edit keeps a summarized discipline fresh for the next matching edit", () => {
  const memo = fs.mkdtempSync(path.join(os.tmpdir(), "subroutine-e2e-"));
  const env = { SUBROUTINE_MEMO_DIR: memo };
  const session_id = "e2e-overflow";
  try {
    const testEdit = runHook(
      "inject-on-edit.mjs",
      { tool_input: { file_path: "/repo/src/orders/service.test.ts" }, session_id },
      env,
    );
    const testContext = testEdit.hookSpecificOutput.additionalContext;
    expect(testContext).toContain("`hono-pipeline` —");
    expect(testContext).not.toContain("### hono-pipeline\n");

    const serviceEdit = runHook(
      "inject-on-edit.mjs",
      { tool_input: { file_path: "/repo/src/orders/service.ts" }, session_id },
      env,
    );
    expect(serviceEdit.hookSpecificOutput.additionalContext).toContain("### hono-pipeline\n");
  } finally {
    fs.rmSync(memo, { recursive: true, force: true });
  }
});

test("inject-on-edit packs a .tsx edit's react-rules as a full body", () => {
  const res = runHook("inject-on-edit.mjs", { tool_input: { file_path: "/repo/src/Button.tsx" } });
  expect(res.hookSpecificOutput.additionalContext).toContain("### react-rules");
});

test("inject-on-edit packs focused testing and state-machine disciplines in full", () => {
  const testRes = runHook("inject-on-edit.mjs", {
    tool_input: { file_path: "/repo/src/orders/service.test.ts" },
  });
  expect(testRes.hookSpecificOutput.additionalContext).toContain("### testing-discipline");

  const machineRes = runHook("inject-on-edit.mjs", {
    tool_input: { file_path: "/repo/src/jobs/state-machine.ts" },
  });
  expect(machineRes.hookSpecificOutput.additionalContext).toContain("### state-machine");
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

function withMemo(run) {
  const memo = fs.mkdtempSync(path.join(os.tmpdir(), "subroutine-e2e-"));
  try {
    return run({ SUBROUTINE_MEMO_DIR: memo });
  } finally {
    fs.rmSync(memo, { recursive: true, force: true });
  }
}

const patch = (...lines) => ["*** Begin Patch", ...lines, "*** End Patch"].join("\n");

test("inject-on-edit reads the files a Codex apply_patch touches", () => {
  const res = runHook("inject-on-edit.mjs", {
    tool_name: "apply_patch",
    cwd: "/repo",
    tool_input: {
      command: patch("*** Update File: web/orders/OrderPanel.tsx", "@@", "-a", "+b"),
    },
  });
  expect(res.hookSpecificOutput.additionalContext).toContain("### react-rules\n");
});

test("inject-on-edit binds the files a patch leaves behind, not moved or deleted ones", () => {
  const res = runHook("inject-on-edit.mjs", {
    tool_name: "apply_patch",
    cwd: "/repo",
    tool_input: {
      command: patch(
        "*** Add File: /repo/web/orders/OrderPanel.tsx",
        "+export {};",
        "*** Update File: api/orders/old.test.ts",
        "*** Move to: api/orders/service.ts",
        "*** Delete File: web/orders/OrderPanel.test.tsx",
      ),
    },
  });
  const ctx = res.hookSpecificOutput.additionalContext;
  expect(ctx).toContain("react-rules");
  expect(ctx).toContain("result-pattern");
  expect(ctx).not.toContain("testing-discipline");
});

test("inject-on-edit gives a subagent full bodies its parent already received", () => {
  withMemo((env) => {
    const edit = { tool_input: { file_path: "/repo/src/service.ts" }, session_id: "parent" };
    runHook("inject-on-edit.mjs", edit, env);
    const sub = runHook("inject-on-edit.mjs", { ...edit, agent_id: "sub-1" }, env);
    expect(sub.hookSpecificOutput.additionalContext).toContain("### type-safety\n");
    const again = runHook("inject-on-edit.mjs", { ...edit, agent_id: "sub-1" }, env);
    expect(again.hookSpecificOutput.additionalContext).not.toContain("### type-safety\n");
  });
});

test("a compaction makes the next edit re-inject full bodies, subagents included", () => {
  withMemo((env) => {
    const edit = { tool_input: { file_path: "/repo/src/service.ts" }, session_id: "s" };
    runHook("inject-on-edit.mjs", edit, env);
    runHook("inject-on-edit.mjs", { ...edit, agent_id: "sub-1" }, env);
    runHook("inject-digest.mjs", { session_id: "s", source: "compact", cwd: os.tmpdir() }, env);
    for (const payload of [edit, { ...edit, agent_id: "sub-1" }]) {
      const res = runHook("inject-on-edit.mjs", payload, env);
      expect(res.hookSpecificOutput.additionalContext).toContain("### type-safety\n");
    }
  });
});
