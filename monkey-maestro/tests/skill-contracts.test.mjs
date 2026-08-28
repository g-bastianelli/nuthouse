import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const skillNames = ["status", "start", "reconcile", "spawn", "stop"];

test("new Maestro skills follow the canonical root skill structure", () => {
  for (const name of skillNames) {
    const skill = read(`monkey-maestro/skills/${name}/SKILL.md`);
    expect(skill, name).toContain(`name: ${name}`);
    expect(skill, name).toContain("## Voice");
    expect(skill, name).toContain("Read `../../persona.md`");
    expect(skill, name).toContain("## Language");
    expect(skill, name).toContain("project-execution-contract.md");
    expect(skill, name).toContain("## Final Report");
    expect(skill, name).toContain("## Never");
  }
});

test("start persists versioned policy then runs one initial reconciliation", () => {
  const skill = read("monkey-maestro/skills/start/SKILL.md");
  expect(skill).toContain("nuthouse:project-graph-receipt");
  expect(skill).toContain("verified: true");
  expect(skill).toContain("defaulting to **4**");
  expect(skill).toContain("**10**");
  expect(skill).toContain("executionIssueIds");
  expect(skill).toContain("exitedExecutionIssueIds");
  expect(skill).toMatch(/latest\s+inactive control's exact `decisionBaseline`/);
  expect(skill).toContain("scripts/records.mjs build-control");
  expect(skill).toContain("Acquire the project lock");
  expect(skill).toContain("scripts/project-lock.mjs release");
  expect(skill).toContain("## Step 4 — Run the initial reconciliation");
  expect(skill).toContain("Invoke `monkey-maestro:reconcile <project-id>` exactly once");
  expect(skill).toContain("activation lock to have been released");
  expect(skill).toContain("Do not request a second activation gate or a per-issue gate");
  expect(skill).toContain("Bash(superset workspaces create:*)");
  expect(skill).toContain("Bash(mktemp:*)");
  expect(skill).toContain("already-active");
  expect(skill).toContain("Initial reconcile");
  expect(skill).not.toContain("Dispatches:    0 — reconcile was not invoked");
  expect(skill).not.toMatch(/Do not call\s+`reconcile`/);
  expect(skill).not.toContain("superset automations create");
});

test("status claims project links only and remains read-only", () => {
  const skill = read("monkey-maestro/skills/status/SKILL.md");
  expect(skill).toContain("linear.app/<workspace>/project/<slug>/");
  expect(skill).toContain("Never claim a `/issue/` URL");
  expect(skill).toContain("project-snapshot-loader");
  expect(skill).toContain("MODE: full");
  expect(skill).toContain("Runtime:          not inspected");
  expect(skill).toContain("Voice flag: !`cat");
  expect(skill).toContain("CONTROL_AMBIGUOUS");
  expect(skill).toContain("Control: invalid");
  expect(skill.indexOf("invalid control authority")).toBeLessThan(
    skill.indexOf("unavailable or required-partial Linear data"),
  );
  expect(skill).toContain("Call `start`, `reconcile`, `spawn`, or `stop` automatically");
  expect(skill).not.toContain("mcp__claude_ai_Linear__save_");
  expect(skill).not.toContain("superset workspaces create");
});

test("stop only revisions the Linear control", () => {
  const skill = read("monkey-maestro/skills/stop/SKILL.md");
  expect(skill).toContain("setting `active: false`");
  expect(skill).toContain("Existing workspaces and agents keep running");
  expect(skill).toContain("Update the existing Linear project comment");
  expect(skill).toContain("Acquire the project lock");
  expect(skill).toContain("scripts/project-lock.mjs release");
  expect(skill).toContain("same comment id, run id, revision");
  expect(skill).not.toContain("superset workspaces delete");
  expect(skill).not.toContain("superset stop");
});

test("reconcile is one LLM pass with lock, fresh readers, pure resolution, and spawn", () => {
  const skill = read("monkey-maestro/skills/reconcile/SKILL.md");
  expect(skill).toContain("scripts/project-lock.mjs acquire");
  expect(skill).toContain("project-snapshot-loader");
  expect(skill).toContain("runtime-inspector");
  expect(skill).toContain("scripts/reconcile-state.mjs");
  expect(skill).toContain("confirmedRunnableExpansions");
  expect(skill).toContain("counts owned live task executions against capacity");
  expect(skill).toContain("executionIssueIds");
  expect(skill).toContain("confirmedExitedIssueIds");
  expect(skill).toContain("known terminal Linear status");
  expect(skill).toContain("complete `ready` workspace inventory");
  expect(skill).toContain("`workspaceInventory`");
  expect(skill).toContain("full unfiltered");
  expect(skill).toContain("Persist the decision before dispatch");
  expect(skill).toContain("resolver's `nextBaseline`");
  expect(skill).toContain("Never persist the loader's raw `currentBaseline`");
  expect(skill).toContain("build-authorization");
  expect(skill).toContain("per-issue hash-bound authorization");
  expect(skill).toContain("invoke `monkey-maestro:spawn`");
  expect(skill).toContain("release the lock on every exit");
  expect(skill).toContain("release the project lock before");
  expect(skill).toMatch(/Never dispatch\s+from the pre-confirmation snapshots/);
  expect(skill).toContain("explicit invocation only");
  expect(skill).toContain("invoke `superset-orchestrate`");
});

test("snapshot and runtime agents are explicitly read-only", () => {
  const snapshot = read("monkey-maestro/agents/project-snapshot-loader.md");
  const runtime = read("monkey-maestro/agents/runtime-inspector.md");
  expect(snapshot).toContain("project-snapshot-loader");
  expect(snapshot).toContain("human author");
  expect(snapshot).toContain("status.type");
  expect(snapshot).toContain("canonical issue identity is Linear's exact `identifier`");
  expect(snapshot).toContain('"id": "<same exact Linear identifier>"');
  expect(snapshot).not.toContain('"id": "<Linear UUID>"');
  expect(snapshot).toContain('"marker": "nuthouse:maestro-execution"');
  expect(snapshot).toContain('"workspaceId": "<id>"');
  expect(snapshot).toContain("complete parsed schema");
  expect(snapshot).not.toContain("mcp__claude_ai_Linear__save_");
  expect(runtime).toContain("superset workspaces list");
  expect(runtime).toContain("superset tasks get");
  expect(runtime).toContain('"issueId": "TEAM-123"');
  expect(runtime).toContain("never assume a `NOT-`");
  expect(runtime).toContain('"taskId": "<Superset task UUID>"');
  expect(runtime).toContain("`taskBindings` is mandatory even when empty");
  expect(runtime).toContain("including `[]`; never omit it");
  expect(runtime).toContain('"workspaceInventory"');
  expect(runtime).toContain('"workspaceIds"');
  expect(runtime).toContain("full unfiltered workspace inventory");
  expect(runtime).toContain("superset terminals list");
  expect(runtime).toContain("gh pr list");
  expect(runtime).toContain("Never run `superset workspaces create|delete`");
});
