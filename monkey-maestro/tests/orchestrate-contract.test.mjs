import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const orchestrate = fs.readFileSync(
  path.join(ROOT, "monkey-maestro/skills/orchestrate/SKILL.md"),
  "utf8",
);

function normalize(document) {
  return document
    .replace(/[`*#|]/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .trim()
    .toLowerCase();
}

function frontmatter(document) {
  const match = document.match(/^---\n([\s\S]*?)\n---/);
  expect(match).not.toBeNull();
  return match[1];
}

function allowedTools(document) {
  const match = frontmatter(document).match(/^allowed-tools:\s*(.+)$/m);
  expect(match).not.toBeNull();
  return match[1];
}

const normalized = normalize(orchestrate);

test("the hot path loads Linear authority once and plans before Superset", () => {
  expect(normalized).toMatch(
    /dispatch monkey-maestro:control-loader and monkey-maestro:project-snapshot-loader mode: full in parallel/,
  );
  expect(normalized).toMatch(
    /resolve-controls.*linear-snapshot\.mjs hydrate.*linear-frontier\.mjs/,
  );
  expect(normalized).toMatch(/linear remains the only scheduling authority/);
  expect(normalized).toMatch(/terminal rows never enter superset/);
  expect(normalized).toMatch(/if both pools are empty, return idle immediately/);
});

test("task validation backfills failed ready candidates without slowing the healthy wave", () => {
  expect(normalized).toMatch(
    /run superset tasks get <issueid> --json for every candidate in a wave in parallel/,
  );
  expect(normalized).toMatch(
    /require the exact linear task binding, project id, provider branch, and usable task state/,
  );
  expect(normalized).toMatch(
    /a failed ready row is non-transportable but consumes no dispatch slot: backfill it from the next deferred ready row/,
  );
  expect(normalized).toMatch(
    /repeat only after a failure until capacity is full or the ready pool is exhausted/,
  );
  expect(normalized).toMatch(/the healthy path is one wave/);
  expect(normalized).toMatch(
    /select at most maxconcurrency transportable candidates in stable issue-id order/,
  );
});

test("the hot path delegates idempotence to branch-scoped workspace create", () => {
  expect(normalized).toMatch(
    /call superset workspaces create once per candidate, in parallel, with the exact project, host, task id, provider branch, deterministic name, --skip-branch-prefix, and --json/,
  );
  expect(normalized).toMatch(/do not pass --agent or --prompt to workspaces create/);
  expect(normalized).toMatch(/alreadyexists: false.*created/);
  expect(normalized).toMatch(/alreadyexists: true.*reused/);
  expect(normalized).toMatch(/never pre-list workspaces/);
});

test("reused workspaces preserve exact task ownership before agent launch", () => {
  expect(normalized).toMatch(/before using a reused workspace, fetch that exact workspace once/);
  expect(normalized).toMatch(/require its exact host, superset project, and provider branch/);
  expect(normalized).toMatch(/if its taskid matches the resolved task, continue/);
  expect(normalized).toMatch(/if its task binding is absent, repair it exactly once/);
  expect(normalized).toMatch(
    /a different non-empty task binding is an ownership conflict: fail only that candidate and never overwrite it/,
  );
});

test("agent launch is separate, duplicate-safe, and immediately returns", () => {
  expect(normalized).toMatch(/for a newly created workspace, call superset agents create once/);
  expect(normalized).toMatch(
    /for a binding-verified reused workspace, list its live terminals exactly once/,
  );
  expect(normalized).toMatch(
    /one or more live terminals means already-running; do not launch another agent/,
  );
  expect(normalized).toMatch(/zero live terminals means call superset agents create once/);
  expect(normalized).toMatch(/require a non-empty sessionid from agents create/);
  expect(normalized).toMatch(
    /return busy immediately after launches.*never poll or wait for workers/,
  );
});

test("normal orchestration contains no replay bridge, force, or custom lock ceremony", () => {
  for (const forbidden of [
    "invocationId",
    "orchestration-epoch",
    "needs-effects",
    "transcript",
    "effectId",
    "candidate-blockers",
    "runtime-inspector",
    "runtime-actions",
    "project-lock",
    "--force",
    "monitorWorker",
  ]) {
    expect(orchestrate, `hot-path ceremony must stay absent: ${forbidden}`).not.toContain(
      forbidden,
    );
  }

  const tools = allowedTools(orchestrate);
  expect(tools).toMatch(/workspaces get/i);
  expect(tools).toMatch(/workspaces update/i);
  expect(tools).not.toMatch(/superset --version|superset status|workspaces list/i);
  expect(tools).not.toMatch(/terminals read|terminals send/i);
  expect(tools).not.toMatch(/github|bash\(gh/i);
});

test("failure isolation and worker ownership remain explicit", () => {
  expect(normalized).toMatch(/one candidate failure never cancels a sibling/);
  expect(normalized).toMatch(/complete linear failure prevents every superset mutation/);
  expect(normalized).toMatch(/inactive or unusable control returns stopped/);
  expect(normalized).toMatch(/linear-devotee:greet <issueid>/);
  expect(normalized).toMatch(/maestro never changes linear lifecycle or dependency relations/);
  expect(normalized).toMatch(/superset_worker_done/);
  expect(normalized).toMatch(/superset_worker_blocked/);
});
