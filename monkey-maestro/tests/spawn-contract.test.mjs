import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const spawn = fs.readFileSync(path.join(ROOT, "monkey-maestro/skills/spawn/SKILL.md"), "utf8");

test("spawn resolves an exact Superset task binding and checks duplicates before mutation", () => {
  expect(spawn).toContain("superset tasks get <identifier> --json");
  expect(spawn).toMatch(/`taskId` is always the returned Superset\s+`task\.id`/);
  expect(spawn).toContain("taskId === task.id");
  expect(spawn).toContain("externalKey === identifier");
  expect(spawn).not.toContain("`taskId` is always the Linear UUID");
  expect(spawn).toContain("Multiple: return `ambiguous`");
  expect(spawn).toContain("One: inspect");
  expect(spawn).toContain("Zero: continue");
});

test("spawn creates and verifies the workspace before launching an agent", () => {
  const workspaceCreate = spawn.indexOf("superset workspaces create --host");
  const workspaceGet = spawn.indexOf("superset workspaces get <workspaceId>");
  const agentCreate = spawn.indexOf("superset agents create --workspace");
  expect(workspaceCreate).toBeGreaterThan(-1);
  expect(workspaceGet).toBeGreaterThan(workspaceCreate);
  expect(agentCreate).toBeGreaterThan(workspaceGet);
  expect(spawn).toContain("Do not pass `--agent`");
  expect(spawn).toContain("terminalId");
  expect(spawn).toContain("workspaceId");
});

test("manual spawn has one standalone gate and redirects active projects", () => {
  expect(spawn).toContain("Create this task-linked workspace and launch its agent?");
  expect(spawn).toContain("one valid latest control is active");
  expect(spawn).toContain("monkey-maestro:orchestrate <project-id>");
  expect(spawn).not.toContain("authorizationHash");
  expect(spawn).not.toContain("MODE: full");
});

test("project-less manual spawn skips project control loading", () => {
  expect(spawn).toContain("normalize absent and `null` as no project");
  expect(spawn).toContain("Only when `issue.projectId` is non-empty");
  expect(spawn).toMatch(/skip the project snapshot loader\s+entirely/);
  expect(spawn).toContain("`manual:<identifier>`");
  expect(spawn).toContain("including an unchanged absence of project");
});

test("invalid project controls require record repair, not reconciliation", () => {
  const controlBranch = spawn.slice(
    spawn.indexOf("Only when `issue.projectId` is non-empty"),
    spawn.indexOf("Verify `superset --version`"),
  );
  expect(controlBranch).toContain("CONTROL_AMBIGUOUS");
  expect(controlBranch).toContain("CONTROL_INVALID");
  expect(controlBranch).toMatch(/repair the malformed or conflicting Linear control\s+records/);
  expect(controlBranch).toMatch(/Never\s+recommend `start` or `reconcile`/);
});

test("spawn remains a manual legacy fallback, not the project coordinator", () => {
  expect(spawn).toContain("manual/legacy single-workspace fallback");
  expect(spawn).toMatch(/Project orchestration\s+never invokes this skill/);
  expect(spawn).not.toContain("Return the structured result to `reconcile`");
});

test("standalone authorization survives the human wait without racing ownership", () => {
  expect(spawn).toContain("standaloneRunId");
  expect(spawn).toContain("Immediately after standalone confirmation, acquire");
  expect(spawn).toMatch(/re-read its current\s+project control/);
  expect(spawn).toMatch(/rerun the exact `taskId` workspace\s+query/);
  expect(spawn).toMatch(/Standalone mode is read-only for this\s+orphaned-runtime path/);
});

test("manual authorization is revalidated after the human wait", () => {
  expect(spawn).toContain("refetch the issue with relations");
  expect(spawn).toContain("re-read its current project control");
  expect(spawn).toContain("changed task binding");
  expect(spawn).toMatch(/newly active control,\s+invalid control authority/);
});

test("partial and degraded executions are durable and never auto-deleted", () => {
  expect(spawn).toContain("Zero is `partial`");
  expect(spawn).toContain("is `degraded` traceability");
  expect(spawn).toContain("Never launch a second agent automatically");
  expect(spawn).toContain("Delete a workspace or terminal after partial/degraded failure");
});

test("greet exclusively owns the issue status transition", () => {
  expect(spawn).toContain("linear-devotee:greet <identifier>");
  expect(spawn).toContain("owns the In Progress transition");
  expect(spawn).toContain("never changes Linear status");
});
