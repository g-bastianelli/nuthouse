import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const orchestrate = fs.readFileSync(
  path.join(ROOT, "monkey-maestro/skills/orchestrate/SKILL.md"),
  "utf8",
);
const targetedLoader = fs.readFileSync(
  path.join(ROOT, "monkey-maestro/agents/project-snapshot-loader.md"),
  "utf8",
);

test("one full hydration is outside the incremental transition loop", () => {
  expect(orchestrate.match(/MODE: full`/g)).toHaveLength(1);
  const incremental = orchestrate.slice(orchestrate.indexOf("## Step 5 — Advance incrementally"));
  expect(incremental).toContain("targeted Linear read");
  expect(incremental).not.toContain("runtime-inspector");
  expect(incremental).not.toContain("MODE: full");
});

test("table reuse refreshes lifecycle authority before deriving readiness", () => {
  const establish = orchestrate.slice(
    orchestrate.indexOf("## Step 0 — Establish the control surface"),
    orchestrate.indexOf("## Step 1 — Hydrate once"),
  );
  const targetedRefresh = establish.indexOf("MODE: targeted");
  const reuse = establish.indexOf("Reuse the table");
  expect(targetedRefresh).toBeGreaterThan(-1);
  expect(reuse).toBeGreaterThan(targetedRefresh);
  expect(establish).toContain("every Coordinator task");
  expect(establish).toContain("even when no row is running or ready");
  expect(establish).toMatch(/fresh normalized status and waiver\s+facts/);
  expect(establish).toMatch(/Never derive\s+readiness from the pre-refresh table/);
});

test("orchestrate skips voice dispatches at load time when voice is off", () => {
  expect(orchestrate).toContain(
    '> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on`',
  );
  expect(orchestrate).toContain("skip every warden:voice dispatch in this skill");
});

test("batch dispatch is workspace-first and releases its lock before monitoring", () => {
  const dispatch = orchestrate.slice(
    orchestrate.indexOf("## Step 3 — Dispatch the batch directly"),
    orchestrate.indexOf("## Step 4 — Monitor every worker"),
  );
  const workspaceCreate = dispatch.indexOf("superset workspaces create");
  const workspaceGet = dispatch.indexOf("superset workspaces get");
  const agentCreate = dispatch.indexOf("superset agents create");
  expect(workspaceCreate).toBeGreaterThan(-1);
  expect(workspaceGet).toBeGreaterThan(workspaceCreate);
  expect(agentCreate).toBeGreaterThan(workspaceGet);
  expect(dispatch).toMatch(/release the\s+project lock before monitoring/);
  expect(dispatch).not.toContain("superset terminals read");
});

test("worker results are durable but Linear remains dependency authority", () => {
  expect(orchestrate).toContain("records.mjs build-result");
  expect(orchestrate).toContain("nuthouse:maestro-result");
  expect(orchestrate).toMatch(/worker envelope[\s\S]+never\s+substitutes for Linear completion/);
  expect(orchestrate).toContain("reconcile_required");
});

test("targeted loader scales with the requested transition, not project size", () => {
  expect(targetedLoader).toContain("MODE: control-only | full | targeted");
  expect(targetedLoader).toContain("EXPECTED_DECISION_HASH");
  expect(targetedLoader).toContain("never call `list_issues`");
  expect(targetedLoader).toContain("proportional to `ISSUE_IDS`");
  expect(targetedLoader).toContain("Never pass a `targeted` response");
});

test("full and targeted snapshots use the same authoritative relation reads", () => {
  expect(targetedLoader).toContain("always fetch every managed issue detail with relations");
  expect(targetedLoader).toContain("The list response is never relation authority");
  expect(targetedLoader).toContain("same relation read and normalization path");
  expect(targetedLoader).toMatch(
    /Never backfill current relations from the verified graph receipt or control baseline/,
  );
});

test("delayed Linear completion stays observable without a full reload", () => {
  const monitoring = orchestrate.slice(
    orchestrate.indexOf("## Step 4 — Monitor every worker"),
    orchestrate.indexOf("## Subagent dispatch"),
  );
  expect(monitoring).toContain("union of every");
  expect(monitoring).toContain("`Linear waiting` issue");
  expect(monitoring).toContain("one loader call, not one call per");
  expect(monitoring).toContain("running workers or `Linear waiting` rows remain");
  expect(monitoring).not.toContain("MODE: full");
});
