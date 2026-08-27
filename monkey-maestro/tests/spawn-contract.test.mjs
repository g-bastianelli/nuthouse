import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const spawn = fs.readFileSync(path.join(ROOT, "monkey-maestro/skills/spawn/SKILL.md"), "utf8");

test("spawn uses an exact Linear UUID taskId and checks duplicates before mutation", () => {
  expect(spawn).toContain("`taskId` is always the Linear UUID");
  expect(spawn).toContain("taskId === issue.id");
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

test("authorization has one standalone gate and no project per-issue gate", () => {
  expect(spawn).toContain("No user confirmation is requested");
  expect(spawn).toContain("In standalone mode only");
  expect(spawn).toContain("Create this task-linked workspace and launch its agent?");
  expect(spawn).toContain("active Maestro project");
  expect(spawn).toContain("authorizationHash");
  expect(spawn).toContain("validate-authorization");
  expect(spawn).toContain("one final full Linear reload");
});

test("standalone authorization survives the human wait without racing ownership", () => {
  expect(spawn).toContain("standaloneRunId");
  expect(spawn).toContain("Immediately after standalone confirmation, acquire");
  expect(spawn).toContain("re-read its current project control");
  expect(spawn).toMatch(/rerun the exact `taskId` workspace\s+query/);
  expect(spawn).toContain("Standalone mode is read-only for this orphaned-runtime path");
});

test("project authorization is scoped to fresh issue eligibility", () => {
  expect(spawn).toContain("equal its hash-bound `issueId`");
  expect(spawn).toContain("still present exactly once in that project");
  expect(spawn).toContain("status and blocker fields known");
  expect(spawn).toMatch(/same\s+`authorizationHash`/);
});

test("partial and degraded executions are durable and never auto-deleted", () => {
  expect(spawn).toContain("`partial` when the workspace exists");
  expect(spawn).toContain("return the runtime as `degraded`");
  expect(spawn).toContain("Never launch a second agent automatically");
  expect(spawn).toContain("Delete a workspace or terminal after partial/degraded failure");
});

test("greet exclusively owns the issue status transition", () => {
  expect(spawn).toContain("linear-devotee:greet <identifier>");
  expect(spawn).toContain("owns the In Progress transition");
  expect(spawn).toContain("never changes Linear status");
});
