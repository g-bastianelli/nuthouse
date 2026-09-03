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

const skills = Object.fromEntries(SKILL_NAMES.map((name) => [name, skill(name)]));

test("the public surface is six prose skills, no custom agents, and one JS helper pair", () => {
  const skillDirectories = fs
    .readdirSync(path.join(PLUGIN_ROOT, "skills"), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(PLUGIN_ROOT, "skills", entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
  const agentFiles = fs
    .readdirSync(path.join(PLUGIN_ROOT, "agents"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"));
  const libraries = fs
    .readdirSync(path.join(PLUGIN_ROOT, "lib"))
    .filter((name) => name.endsWith(".mjs"));
  const scripts = fs
    .readdirSync(path.join(PLUGIN_ROOT, "scripts"))
    .filter((name) => name.endsWith(".mjs"));
  const tests = fs
    .readdirSync(path.join(PLUGIN_ROOT, "tests"))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort();

  expect(skillDirectories).toEqual(SKILL_NAMES);
  expect(agentFiles).toEqual([]);
  expect(libraries).toEqual(["records.mjs"]);
  expect(scripts).toEqual(["records.mjs"]);
  expect(tests).toEqual(["records.test.mjs", "skill-contracts.test.mjs"]);
  expect(JSON.parse(read("monkey-maestro/.claude-plugin/plugin.json"))).not.toHaveProperty(
    "agents",
  );

  for (const name of SKILL_NAMES) {
    expect(frontmatterField(skills[name], "name")).toBe(name);
    expect(skills[name]).toContain("../../persona.md");
    expect(skills[name]).toContain("project-execution-contract.md");
  }
});

test("deleted machinery and external scheduling authority stay absent", () => {
  const documents = [
    read("monkey-maestro/README.md"),
    read("monkey-maestro/shared/project-execution-contract.md"),
    ...Object.values(skills),
  ].join("\n");
  for (const obsolete of [
    "host-agents.mjs",
    "linear-frontier.mjs",
    "linear-snapshot.mjs",
    "orchestration-epoch.mjs",
    "project-lock.mjs",
    "runtime-actions.mjs",
    "runtime-inspector",
    "runtime-snapshot.mjs",
    "decisionHash",
    "graphHash",
  ]) {
    expect(documents).not.toContain(obsolete);
  }
  for (const document of Object.values(skills)) {
    expect(allowedTools(document)).not.toMatch(/github|bash\(gh|save_issue|update_issue/i);
  }
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
  expect((skills.start.match(/\(y \/ cancel\)/g) ?? []).length).toBe(1);
  expect(tools).toMatch(/Bash\(superset status:\*\)/);
  expect(tools).toMatch(/Bash\(superset projects list:\*\)/);
  expect(tools).toMatch(/Bash\(superset agents list:\*\)/);
  expect(tools).not.toMatch(/workspaces|terminals|tasks|agents create/i);
});

test("orchestrate uses one Linear capacity calculation and one-shot Superset transport", () => {
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
  expect(orchestrate).toMatch(/--agent <defaultagent>.*--prompt <workerprompt>/);
  expect(orchestrate).toMatch(/sibling attempts settled independently/);
  expect(tools).toMatch(/Bash\(superset workspaces create:\*\)/);
  expect(tools).not.toMatch(/workspaces (list|get|update)|terminals|agents (list|create)/i);
});

test("status reports the same Linear-only capacity without Superset", () => {
  const status = normalize(skills.status);
  expect(status).toMatch(/read-only and linear-only/);
  expect(status).toMatch(/remaining = max\(0, maxconcurrency - startedcount\)/);
  expect(status).toMatch(/never use runtime state to adjust/);
  expect(allowedTools(skills.status)).not.toMatch(/superset|save_comment|github/i);
});

test("spawn cannot force Linear and performs at most one approved create", () => {
  const spawn = normalize(skills.spawn);
  const tools = allowedTools(skills.spawn);

  expect(frontmatterField(skills.spawn, "argument-hint")).not.toContain("--force");
  expect(spawn).not.toMatch(/\bforce\b/);
  expect(spawn).toMatch(/completed or canceled issue returns already-terminal/);
  expect(spawn).toMatch(/blocked issue or any unknown.*refuses dispatch/);
  expect(spawn).toMatch(/ready issue may proceed only when.*is positive/);
  expect((skills.spawn.match(/^superset workspaces create/gm) ?? []).length).toBe(1);
  expect((skills.spawn.match(/\(y \/ cancel\)/g) ?? []).length).toBe(1);
  expect(tools).not.toMatch(/workspaces (list|get|update)|terminals|agents (list|create)/i);
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
  expect((skills.stop.match(/\(y \/ cancel\)/g) ?? []).length).toBe(1);
  expect(allowedTools(skills.stop)).not.toMatch(/superset|github/i);
});
