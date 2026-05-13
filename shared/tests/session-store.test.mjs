import { afterEach, beforeEach, describe, test } from "bun:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { invalidate, isStale, merge, read, storePath, write } from "../session-store.mjs";

const SESSION_ID = "test-session-abc123";
let projectRoot;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-store-"));
  // Minimal .git so getHeadSha doesn't blow up (it will return null, which is fine)
  fs.mkdirSync(path.join(projectRoot, ".git"));
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// storePath
// ---------------------------------------------------------------------------
describe("storePath", () => {
  test("returns the expected path", () => {
    const p = storePath("sid", "/repo");
    assert.strictEqual(p, "/repo/.claude/nuthouse/sessions/sid.json");
  });
});

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------
describe("read", () => {
  test("returns null for falsy sessionId", () => {
    assert.strictEqual(read(null, projectRoot), null);
    assert.strictEqual(read("", projectRoot), null);
    assert.strictEqual(read(undefined, projectRoot), null);
  });

  test("returns null when file is absent", () => {
    assert.strictEqual(read(SESSION_ID, projectRoot), null);
  });

  test("returns null for corrupt JSON (no throw)", () => {
    const dir = path.dirname(storePath(SESSION_ID, projectRoot));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(SESSION_ID, projectRoot), "{NOT JSON}");
    assert.strictEqual(read(SESSION_ID, projectRoot), null);
  });

  test("returns parsed object when file exists", () => {
    write(SESSION_ID, projectRoot, { spec_path: "/a/b.md" });
    const s = read(SESSION_ID, projectRoot);
    assert.ok(s);
    assert.strictEqual(s.spec_path, "/a/b.md");
  });
});

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------
describe("write", () => {
  test("no-op for falsy sessionId", () => {
    write(null, projectRoot, { x: 1 });
    assert.ok(!fs.existsSync(path.join(projectRoot, ".claude")));
  });

  test("creates parent directories", () => {
    write(SESSION_ID, projectRoot, {});
    assert.ok(fs.existsSync(storePath(SESSION_ID, projectRoot)));
  });

  test("injects _meta.session_id and _meta.written_at", () => {
    write(SESSION_ID, projectRoot, { foo: "bar" });
    const s = read(SESSION_ID, projectRoot);
    assert.strictEqual(s._meta.session_id, SESSION_ID);
    assert.ok(typeof s._meta.written_at === "string");
    assert.ok("git_sha" in s._meta);
  });

  test("preserves _meta._shas from data when present", () => {
    const shas = { relevant_files: "abc" };
    write(SESSION_ID, projectRoot, { _meta: { _shas: shas }, relevant_files: [] });
    const s = read(SESSION_ID, projectRoot);
    assert.deepStrictEqual(s._meta._shas, shas);
  });

  test("overwrites existing file", () => {
    write(SESSION_ID, projectRoot, { spec_path: "/old" });
    write(SESSION_ID, projectRoot, { spec_path: "/new" });
    assert.strictEqual(read(SESSION_ID, projectRoot)?.spec_path, "/new");
  });
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------
describe("merge", () => {
  test("returns patch unchanged when sessionId is falsy", () => {
    const result = merge(null, projectRoot, { x: 1 });
    assert.deepStrictEqual(result, { x: 1 });
  });

  test("creates session if absent", () => {
    merge(SESSION_ID, projectRoot, { spec_path: "/a" });
    assert.strictEqual(read(SESSION_ID, projectRoot)?.spec_path, "/a");
  });

  test("deep-merges into existing session", () => {
    write(SESSION_ID, projectRoot, { "linear-devotee": { issue: { id: "ENG-1" } } });
    merge(SESSION_ID, projectRoot, { "linear-devotee": { plan_path: "/plan.md" } });
    const s = read(SESSION_ID, projectRoot);
    assert.strictEqual(s["linear-devotee"].issue.id, "ENG-1");
    assert.strictEqual(s["linear-devotee"].plan_path, "/plan.md");
  });

  test("overwrites scalar values", () => {
    write(SESSION_ID, projectRoot, { spec_path: "/old" });
    merge(SESSION_ID, projectRoot, { spec_path: "/new" });
    assert.strictEqual(read(SESSION_ID, projectRoot)?.spec_path, "/new");
  });

  test("ignores _meta in patch", () => {
    merge(SESSION_ID, projectRoot, { _meta: { injected: true }, foo: "bar" });
    const s = read(SESSION_ID, projectRoot);
    assert.ok(!s._meta.injected);
    assert.strictEqual(s.foo, "bar");
  });

  test("updates _meta._shas for sha-tracked keys in patch", () => {
    merge(SESSION_ID, projectRoot, { relevant_files: ["a.ts"] });
    const s = read(SESSION_ID, projectRoot);
    assert.ok("relevant_files" in s._meta._shas);
  });

  test("preserves _meta._shas for sha-tracked keys not in patch", () => {
    // Write relevant_files first
    merge(SESSION_ID, projectRoot, { relevant_files: ["a.ts"] });
    const shas1 = read(SESSION_ID, projectRoot)._meta._shas;

    // Write something else — should not touch _shas.relevant_files
    merge(SESSION_ID, projectRoot, { spec_path: "/spec.md" });
    const shas2 = read(SESSION_ID, projectRoot)._meta._shas;

    assert.strictEqual(shas2.relevant_files, shas1.relevant_files);
  });

  test("options.shasKeys extends sha tracking beyond SHA_TRACKED_KEYS", () => {
    merge(
      SESSION_ID,
      projectRoot,
      { "custom-plugin": { report: {} } },
      { shasKeys: ["custom-plugin.report"] },
    );
    const s = read(SESSION_ID, projectRoot);
    assert.ok("custom-plugin.report" in s._meta._shas);
  });

  test("options.shasKeys does not affect built-in SHA_TRACKED_KEYS", () => {
    merge(
      SESSION_ID,
      projectRoot,
      { relevant_files: ["a.ts"] },
      { shasKeys: ["custom-plugin.report"] },
    );
    const s = read(SESSION_ID, projectRoot);
    assert.ok("relevant_files" in s._meta._shas);
  });
});

// ---------------------------------------------------------------------------
// isStale
// ---------------------------------------------------------------------------
describe("isStale", () => {
  test("returns true for null session", () => {
    assert.strictEqual(isStale(null, "spec_path", null, projectRoot), true);
  });

  test("spec_path: not stale when file exists", () => {
    const p = path.join(projectRoot, "spec.md");
    fs.writeFileSync(p, "");
    assert.strictEqual(isStale({ spec_path: p }, "spec_path", null, projectRoot), false);
  });

  test("spec_path: stale when file missing", () => {
    assert.strictEqual(
      isStale({ spec_path: "/nonexistent/file.md" }, "spec_path", null, projectRoot),
      true,
    );
  });

  test("spec_path: not stale when empty string (no path set)", () => {
    assert.strictEqual(isStale({ spec_path: "" }, "spec_path", null, projectRoot), false);
  });

  test("relevant_files: stale when no sha in _meta", () => {
    assert.strictEqual(isStale({ relevant_files: [] }, "relevant_files", null, projectRoot), true);
  });

  test("relevant_files: uses per-key sha from _shas when available", () => {
    // Planted sha that will never match real HEAD (no commits in tmp dir)
    const session = {
      relevant_files: ["a.ts"],
      _meta: { _shas: { relevant_files: "deadbeef" } },
    };
    assert.strictEqual(isStale(session, "relevant_files", null, projectRoot), true);
  });

  test("linear-devotee.issue: always stale", () => {
    const session = { "linear-devotee": { issue: { id: "ENG-1" } }, _meta: {} };
    assert.strictEqual(isStale(session, "issue", "linear-devotee", projectRoot), true);
  });

  test("linear-devotee.plan_path: not stale when file exists", () => {
    const p = path.join(projectRoot, "plan.md");
    fs.writeFileSync(p, "");
    const session = { "linear-devotee": { plan_path: p } };
    assert.strictEqual(isStale(session, "plan_path", "linear-devotee", projectRoot), false);
  });

  test("linear-devotee.plan_path: stale when file gone", () => {
    const session = { "linear-devotee": { plan_path: "/gone.md" } };
    assert.strictEqual(isStale(session, "plan_path", "linear-devotee", projectRoot), true);
  });

  test("acid-prophet.handoff_spec: stale when spec_path changed", () => {
    const session = {
      spec_path: "/new/path.md",
      "acid-prophet": { handoff_spec: {}, _handoff_spec_path: "/old/path.md" },
    };
    assert.strictEqual(isStale(session, "handoff_spec", "acid-prophet", projectRoot), true);
  });

  test("acid-prophet.handoff_spec: not stale when spec_path matches", () => {
    const session = {
      spec_path: "/same/path.md",
      "acid-prophet": { handoff_spec: {}, _handoff_spec_path: "/same/path.md" },
    };
    assert.strictEqual(isStale(session, "handoff_spec", "acid-prophet", projectRoot), false);
  });

  test("unknown key returns false (not stale by default)", () => {
    assert.strictEqual(isStale({}, "unknown", null, projectRoot), false);
    assert.strictEqual(isStale({}, "unknown", "some-plugin", projectRoot), false);
  });
});

// ---------------------------------------------------------------------------
// invalidate
// ---------------------------------------------------------------------------
describe("invalidate", () => {
  test("no-op for falsy sessionId", () => {
    invalidate(null, projectRoot, "spec_path", null);
    // no file created, no error
    assert.ok(!fs.existsSync(path.join(projectRoot, ".claude")));
  });

  test("no-op when session does not exist", () => {
    invalidate(SESSION_ID, projectRoot, "spec_path", null);
    assert.strictEqual(read(SESSION_ID, projectRoot), null);
  });

  test("removes a top-level key", () => {
    write(SESSION_ID, projectRoot, { spec_path: "/a", "linear-devotee": {} });
    invalidate(SESSION_ID, projectRoot, "spec_path", null);
    const s = read(SESSION_ID, projectRoot);
    assert.ok(!("spec_path" in s));
    assert.ok("linear-devotee" in s);
  });

  test("removes a namespaced key", () => {
    write(SESSION_ID, projectRoot, {
      "acid-prophet": { handoff_spec: { x: 1 }, _handoff_spec_path: "/p" },
    });
    invalidate(SESSION_ID, projectRoot, "handoff_spec", "acid-prophet");
    const s = read(SESSION_ID, projectRoot);
    assert.ok(!("handoff_spec" in s["acid-prophet"]));
    assert.ok("_handoff_spec_path" in s["acid-prophet"]);
  });

  test("no-op when namespace does not exist in session", () => {
    write(SESSION_ID, projectRoot, { spec_path: "/a" });
    invalidate(SESSION_ID, projectRoot, "plan_path", "linear-devotee");
    const s = read(SESSION_ID, projectRoot);
    // namespace was absent — must not be created as empty object
    assert.ok(!("linear-devotee" in s));
  });

  test("no-op when namespaced key is absent (namespace exists)", () => {
    write(SESSION_ID, projectRoot, { "linear-devotee": { plan_path: "/p" } });
    invalidate(SESSION_ID, projectRoot, "nonexistent_key", "linear-devotee");
    const s = read(SESSION_ID, projectRoot);
    assert.strictEqual(s["linear-devotee"].plan_path, "/p");
  });
});
