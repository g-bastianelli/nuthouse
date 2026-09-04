import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const PLUGIN_ROOT = path.join(ROOT, "monkey-maestro");
const SKILL_NAMES = ["orchestrate", "reconcile", "spawn", "start", "status", "stop"];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

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

function frontmatterField(document, field) {
  const match = frontmatter(document).match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  expect(match, `missing frontmatter field: ${field}`).not.toBeNull();
  return match[1].trim();
}

function skill(name) {
  return read(`monkey-maestro/skills/${name}/SKILL.md`);
}

function allowedTools(document) {
  return frontmatterField(document, "allowed-tools");
}

function agentTools(document) {
  const match = frontmatter(document).match(/(?:^|\n)tools:\n([\s\S]*?)(?=\n\S|$)/);
  expect(match).not.toBeNull();
  return [...match[1].matchAll(/^\s*-\s*(.+)$/gm)].map((entry) => entry[1]);
}

const skills = Object.fromEntries(SKILL_NAMES.map((name) => [name, skill(name)]));

test("discovered skills and agents preserve their context and capability boundaries", () => {
  const skillFiles = fs
    .readdirSync(path.join(PLUGIN_ROOT, "skills"), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(PLUGIN_ROOT, "skills", entry.name, "SKILL.md")),
    )
    .map((entry) => path.join(PLUGIN_ROOT, "skills", entry.name, "SKILL.md"));
  const agentFiles = fs
    .readdirSync(path.join(PLUGIN_ROOT, "agents"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(PLUGIN_ROOT, "agents", entry.name));

  expect(skillFiles.length).toBeGreaterThan(0);
  for (const file of skillFiles) {
    const document = fs.readFileSync(file, "utf8");
    expect(frontmatterField(document, "name")).not.toBe("");
    expect(document).toContain("../../persona.md");
    expect(document).toContain("project-execution-contract.md");
    expect(allowedTools(document)).not.toMatch(/mcp__claude_ai_linear__(get|list)_/i);
  }

  for (const file of agentFiles) {
    const document = fs.readFileSync(file, "utf8");
    expect(frontmatterField(document, "name")).not.toBe("");
    expect(agentTools(document).length).toBeGreaterThan(0);
    expect(agentTools(document).every((tool) => /linear__(get|list)_/i.test(tool))).toBe(true);
    expect(agentTools(document).join(" ")).not.toMatch(/save|create|update|delete/i);
  }
});

test("Linear remains the only scheduling authority and public skills cannot mutate lifecycle", () => {
  const documents = [
    read("monkey-maestro/README.md"),
    read("monkey-maestro/shared/project-execution-contract.md"),
    ...Object.values(skills),
  ].join("\n");
  for (const document of Object.values(skills)) {
    expect(allowedTools(document)).not.toMatch(/github|bash\(gh|save_issue|update_issue/i);
  }
  expect(normalize(documents)).toMatch(/linear is the sole scheduling authority/);
  expect(normalize(documents)).toMatch(/runtime state never decides capacity/);
  expect(normalize(documents)).toMatch(
    /never merges or pushes, changes dependencies, changes issue status or relations/,
  );
});

test("start discovers ordinary local transport and has one mutation approval", () => {
  const start = normalize(skills.start);
  const tools = allowedTools(skills.start);

  expect(start).toMatch(/explicit argument, then the latest usable control, then local discovery/);
  expect(start).toMatch(/superset status --json.*running: true.*healthy: true/);
  expect(start).toMatch(/superset projects list --local --json/);
  expect(start).toMatch(/\.superset\/worktrees\/.*sole listed local project/);
  expect(start).toMatch(
    /active runtime.*only when that exact preset or id is listed.*sole listed agent/,
  );
  expect(start).toMatch(/every unresolved selector.*one concise clarification/);
  expect(start).toMatch(/resolved non-empty selectors/);
  expect(start).toMatch(/ask exactly once.*apply this maestro activation\/update to linear/);
  expect(start).toMatch(/linear-reader.*mode: control/);
  expect((skills.start.match(/\(y \/ cancel\)/g) ?? []).length).toBe(1);
  expect(tools).toMatch(/Bash\(superset status:\*\)/);
  expect(tools).toMatch(/Bash\(superset projects list:\*\)/);
  expect(tools).toMatch(/Bash\(superset agents list:\*\)/);
  expect(tools).not.toMatch(/workspaces|terminals|tasks|agents create/i);
});

test("orchestrate uses one Linear capacity calculation and bounded Superset transport", () => {
  const orchestrate = normalize(skills.orchestrate);
  const tools = allowedTools(skills.orchestrate);

  expect(orchestrate).toMatch(/count every known started issue/);
  expect(orchestrate).toMatch(
    /slots = max\(0, maxconcurrency - startedcount\).*select the first slots/,
  );
  expect(orchestrate).toMatch(/every blocker is present and terminal/);
  expect(orchestrate).toMatch(/started issues consume capacity but are never redispatched/);
  expect(orchestrate).toMatch(/do not backfill/);
  expect((skills.orchestrate.match(/^superset workspaces create/gm) ?? []).length).toBe(1);
  expect((skills.orchestrate.match(/^superset agents create/gm) ?? []).length).toBe(1);
  const workspaceCommand = skills.orchestrate.match(
    /superset workspaces create \\\n[\s\S]*?  --json/,
  )?.[0];
  expect(workspaceCommand).not.toMatch(/--agent|--prompt/);
  expect(orchestrate).toMatch(/report dispatched only when the agent command confirms success/);
  expect(orchestrate).toMatch(/launch-failed.*monkey-maestro:spawn <issueid>/);
  expect(orchestrate).toMatch(/launch-unknown.*monkey-maestro:reconcile/);
  expect(orchestrate).toMatch(/launch only after an explicit created result/);
  expect(orchestrate).toMatch(/reused or ambiguous result never launches an agent/);
  expect(orchestrate).toMatch(/reclassify every selected issue.*require it to remain ready/);
  expect(orchestrate).toMatch(/linear-reader.*mode: project.*mode: selected/);
  expect(orchestrate).toMatch(/sibling attempts settled independently/);
  expect(orchestrate).toMatch(/linear-<lowercaseissueid>-<taskdigest>/);
  expect(tools).toMatch(/Bash\(superset workspaces create:\*\)/);
  expect(tools).toMatch(/Bash\(superset agents create:\*\)/);
  expect(tools).not.toMatch(/workspaces (list|get|update)|terminals/i);
});

test("status reports the same Linear-only capacity without Superset", () => {
  const status = normalize(skills.status);
  expect(status).toMatch(/read-only and linear-only/);
  expect(status).toMatch(/remaining = max\(0, maxconcurrency - startedcount\)/);
  expect(status).toMatch(/never use runtime state to adjust/);
  expect(status).toMatch(/linear-reader.*mode: project/);
  expect(allowedTools(skills.status)).not.toMatch(/superset|save_comment|github/i);
});

test("spawn keeps issue dispatch manual and independent from project controls", () => {
  const spawn = normalize(skills.spawn);
  const tools = allowedTools(skills.spawn);

  expect(frontmatterField(skills.spawn, "argument-hint")).not.toContain("--force");
  expect(spawn).not.toMatch(/\bforce\b/);
  expect(spawn).toMatch(/issue mode.*linear issue identifier/);
  expect(spawn).toMatch(/linear-reader.*mode: selected/);
  expect(spawn).not.toMatch(/resolve-controls|maxconcurrency|mode: project/);
  expect(spawn).toMatch(/never read or obey a linear project control/);
  expect(spawn).toMatch(/completed or canceled issue returns already-terminal/);
  expect(spawn).toMatch(/blocked issue or any unknown.*refuses dispatch/);
  expect(spawn).toMatch(/does not calculate project capacity/);
  expect(spawn).toMatch(/exact linear issue and project binding/);
  expect(spawn).toMatch(/linear-<lowercaseissueid>-<taskdigest>/);
  expect(spawn).toMatch(/not specified in linear.*never infer/);
  expect(tools).toMatch(/Bash\(superset tasks get:\*\)/);
});

test("spawn launches deterministic quick fixes without Linear or controls", () => {
  const spawn = normalize(skills.spawn);
  const tools = allowedTools(skills.spawn);

  expect(frontmatterField(skills.spawn, "argument-hint")).toMatch(/quick-fix objective/i);
  expect(spawn).toMatch(/quick-fix mode.*free-form objective/);
  expect(spawn).toMatch(/do not dispatch linear-reader/);
  expect(spawn).toMatch(/no linear issue, task, project control, or capacity calculation/);
  expect(spawn).toMatch(/sha-256.*normalized objective/);
  expect(spawn).toMatch(/unicode nfkd.*outside a-z0-9/);
  expect(spawn).toMatch(/quick\/<slug>-<digest>/);
  expect(spawn).toMatch(/bindingargs = --branch <branchname> --skip-branch-prefix/);
  expect(spawn).toMatch(/worker prompt.*must not invoke linear-devotee:greet/);
  expect(tools).toMatch(/Bash\(superset status:\*\)/);
  expect(tools).toMatch(/Bash\(superset projects list:\*\)/);
  expect(tools).toMatch(/Bash\(superset agents list:\*\)/);
});

test("spawn performs at most one approved create and one launch in either mode", () => {
  const spawn = normalize(skills.spawn);
  const tools = allowedTools(skills.spawn);

  expect((skills.spawn.match(/^superset workspaces create/gm) ?? []).length).toBe(1);
  expect((skills.spawn.match(/^superset agents create/gm) ?? []).length).toBe(1);
  expect((skills.spawn.match(/\(y \/ cancel\)/g) ?? []).length).toBe(1);
  expect(spawn).toMatch(/live terminal returns already-running.*without approval or launch/);
  expect(spawn).toMatch(/immediately list the chosen workspace's live terminals once more/);
  expect(spawn).toMatch(/require explicit success before reporting dispatched/);
  expect(spawn).toMatch(/if it says reused.*report concurrent-reuse and launch nothing/);
  expect(spawn).toMatch(/launch-unknown.*monkey-maestro:reconcile/);
  expect(tools).toMatch(/workspaces list.*terminals list.*agents create/i);
});

test("the Linear reader bounds full-project payloads and refreshes selected blockers", () => {
  const reader = normalize(read("monkey-maestro/agents/linear-reader.md"));

  expect(reader).toMatch(/project mode.*return only status and blocker facts/);
  expect(reader).toMatch(/never return issue descriptions for a full project read/);
  expect(reader).toMatch(/selected mode.*derive their current direct blocker union/);
  expect(reader).toMatch(
    /selected scope is exactly the requested issues plus their current direct blocker union/,
  );
});

test("reconcile is optional read-only observation and stop only updates control", () => {
  const reconcile = normalize(skills.reconcile);
  const stop = normalize(skills.stop);

  expect(reconcile).toMatch(/optional and read-only/);
  expect(reconcile).toMatch(/never decides readiness or capacity/);
  expect(reconcile).toMatch(/do not create, update, delete, adopt, repair, retry, or write/);
  expect(allowedTools(skills.reconcile)).not.toMatch(
    /save_comment|workspaces create|agents create/i,
  );

  expect(stop).toMatch(/active: false.*incrementing revision/);
  expect(stop).toMatch(/existing superset work untouched/);
  expect(stop).toMatch(/linear-reader.*mode: control/);
  expect((skills.stop.match(/\(y \/ cancel\)/g) ?? []).length).toBe(1);
  expect(allowedTools(skills.stop)).not.toMatch(/superset|github/i);
});
