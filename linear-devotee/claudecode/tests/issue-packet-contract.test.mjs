import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("project drafter emits complete traceable issue packets", () => {
  const agent = read("linear-devotee/agents/project-drafter.md");

  expect(agent).toContain("## Issue packets");
  expect(agent).toContain("draft-key: I-001");
  expect(agent).toContain("covers: AC-001");
  expect(agent).toContain("depends-on:");
  expect(agent).toContain("**Acceptance criteria**");
  expect(agent).toContain("dependentRef -> blockerRef");
  expect(agent).toContain("same project packet");
});

test("create-project approves full issue bodies before Linear mutation", () => {
  const skill = read("linear-devotee/skills/create-project/SKILL.md");

  expect(skill).toContain("acceptance_refs");
  expect(skill).toContain("sdd_body");
  expect(skill).toContain("pre-approved `sdd_body`");
  expect(skill).toContain("every source `AC-###` is covered");
  expect(skill).not.toContain("Dispatch `linear-devotee:issue-drafter` with:");
  expect(skill).toContain("normalized_graph");
  expect(skill).toContain("payload_hash");
  expect(skill).toContain("approved_payload_hash");
  expect(skill).toContain("mutation_envelope");
  expect(skill).toContain("validate-envelope");
  expect(skill).toContain("graph_hash");
  expect(skill).toContain(
    "project `clientRef`, `name`, full marked `description`, `teamIds`, `statusId`",
  );
});

test("foundation-only packets remain representable through authoritative reload", () => {
  const skill = read("linear-devotee/skills/create-project/SKILL.md");
  const loader = read("linear-devotee/agents/project-graph-loader.md");

  expect(skill).toContain("acceptanceIds: []");
  expect(skill).toContain("foundationReason");
  expect(skill).toContain("nuthouse-foundation-reason");
  expect(loader).toContain("base64url-decode");
  expect(loader).toContain("foundationReason");
});

test("create-project verifies the exact graph after every write is confirmed", () => {
  const skill = read("linear-devotee/skills/create-project/SKILL.md");

  expect(skill).toContain("project-graph.mjs validate");
  expect(skill).toContain("linear-devotee:project-graph-loader");
  expect(skill).toContain("project-graph.mjs compare");
  expect(skill).toContain('"verified": false');
  expect(skill).toContain("refuse Maestro activation");
});

test("cascade mutation never drops an unresolved approved dependency", () => {
  const createProject = read("linear-devotee/skills/create-project/SKILL.md");
  expect(createProject).toContain('last_error: "dependency_reference_unresolved"');
  expect(createProject).toContain("never drop, guess, or defer an approved dependency silently");
  expect(createProject).not.toContain("drop unresolved refs with a warning");
});

test("cascade resume confirms stable mutation markers before retrying", () => {
  for (const skillPath of [
    "linear-devotee/skills/create-project/SKILL.md",
    "linear-devotee/skills/create-issue/SKILL.md",
    "linear-devotee/skills/create-milestone/SKILL.md",
  ]) {
    const skill = read(skillPath);
    expect(skill, skillPath).toContain("nuthouse-client-ref");
    expect(skill, skillPath).toContain("confirmed_operations");
  }
});

test("plan auditor rejects missing acceptance coverage", () => {
  const agent = read("linear-devotee/agents/plan-auditor.md");
  const skill = read("linear-devotee/skills/plan/SKILL.md");

  expect(agent).toContain("acceptance identifier");
  expect(agent).toContain("uncovered");
  expect(skill).toContain("## Acceptance traceability");
});

test("standalone issue acceptance ids cannot collide with source ids", () => {
  const drafter = read("linear-devotee/agents/issue-drafter.md");
  const context = read("linear-devotee/agents/issue-context.md");
  const auditor = read("linear-devotee/agents/plan-auditor.md");
  const createIssue = read("linear-devotee/skills/create-issue/SKILL.md");

  expect(drafter).toContain("SOURCE_ACCEPTANCE_IDS");
  expect(drafter).toContain("AC-L001");
  expect(drafter).toContain("never generate an id in that mode");
  expect(context).toContain("AC-L###");
  expect(auditor).toContain("Keep the namespaces distinct");
  expect(auditor).toContain("different text under the same id is a BLOCKER");
  expect(createIssue).toContain("Source Acceptance namespace");
});

test("cascade issue milestones resolve stable refs before save_issue", () => {
  const createProject = read("linear-devotee/skills/create-project/SKILL.md");
  const createIssue = read("linear-devotee/skills/create-issue/SKILL.md");

  expect(createProject).toContain("Resolve `milestone_client_ref` to exactly one entry");
  expect(createProject).toContain('last_error: "milestone_reference_unresolved"');
  expect(createProject).toContain("Pass that id as `projectMilestoneId`");
  expect(createIssue).toContain("milestone_reference_unresolved");
});

test("project drafting fails closed before an oversized issue graph", () => {
  const drafter = read("linear-devotee/agents/project-drafter.md");

  expect(drafter).toContain("Emit at most 8 complete issue packets per run");
  expect(drafter).toContain("never emit a partial graph");
  expect(drafter).toContain("6–8 issues → phased");
});

test("Linear mutation skills declare their write tools", () => {
  const createProject = read("linear-devotee/skills/create-project/SKILL.md");
  const createIssue = read("linear-devotee/skills/create-issue/SKILL.md");
  const createMilestone = read("linear-devotee/skills/create-milestone/SKILL.md");

  expect(createProject).toContain("mcp__claude_ai_Linear__save_project");
  expect(createProject).toContain("mcp__claude_ai_Linear__save_milestone");
  expect(createProject).toContain("mcp__claude_ai_Linear__save_issue");
  expect(createIssue).toContain("mcp__claude_ai_Linear__save_issue");
  expect(createMilestone).toContain("mcp__claude_ai_Linear__save_milestone");
});

test("Linear mutation skills declare their direct read tools", () => {
  const createProject = read("linear-devotee/skills/create-project/SKILL.md");
  const createIssue = read("linear-devotee/skills/create-issue/SKILL.md");
  const createMilestone = read("linear-devotee/skills/create-milestone/SKILL.md");

  expect(createProject).toContain("mcp__claude_ai_Linear__list_teams");
  expect(createProject).toContain("mcp__claude_ai_Linear__list_projects");
  expect(createProject).toContain("mcp__claude_ai_Linear__list_issue_labels");
  expect(createIssue).toContain("mcp__claude_ai_Linear__list_projects");
  expect(createIssue).toContain("mcp__claude_ai_Linear__list_milestones");
  expect(createIssue).toContain("mcp__claude_ai_Linear__list_issue_labels");
  expect(createMilestone).toContain("mcp__claude_ai_Linear__list_projects");
});

test("label ids are resolved before approval and persisted for replay", () => {
  const createProject = read("linear-devotee/skills/create-project/SKILL.md");
  const createIssue = read("linear-devotee/skills/create-issue/SKILL.md");

  expect(createProject).toContain("pre-approval `LABEL_MAP`");
  expect(createProject).toContain('"label_ids": ["<pre-approved label id>"]');
  expect(createProject).toContain("envelope issue's exact `labelIds`");
  expect(createIssue).toContain("immutable `LABEL_MAP`");
  expect(createIssue).toContain("replay persisted `label_ids`");
});
