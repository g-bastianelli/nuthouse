import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = resolve(import.meta.dir, "../..");

const read = (path) => readFileSync(resolve(repoRoot, path), "utf8");

describe("project-scoped autopilot relays", () => {
  test("stores flags and locks under the Linear project id", () => {
    const contract = read("monkey-maestro/shared/pipeline-contract.md");

    expect(contract).toContain("PROJECT_STATE_DIR = <STATE_ROOT>/<LINEAR_PROJECT_ID>");
    expect(contract).toContain("RELAY_FLAG = <PROJECT_STATE_DIR>/autopilot.json");
    expect(contract).toContain("LOCK_DIR = <PROJECT_STATE_DIR>/lock");
    expect(contract).toContain("mkdir <LOCK_DIR>");
  });

  test("resolves a project before it acquires a relay lock", () => {
    const run = read("monkey-maestro/skills/run/SKILL.md");

    expect(run).toContain("## Step 1 — Resolve the target project + first movement");
    expect(run).toContain("## Step 2 — Atomically arm this project only");
    expect(run).toContain("the first mutation");
    expect(run).toContain("PREFERRED_ISSUE: <required issue-id from $ARGUMENTS>");
  });

  test("derives autopilot behavior from the current issue project", () => {
    const skillPaths = [
      "linear-devotee/skills/greet/SKILL.md",
      "linear-devotee/skills/plan/SKILL.md",
      "moon-moth/skills/verify/SKILL.md",
      "git-gremlin/skills/commit/SKILL.md",
      "git-gremlin/skills/pr/SKILL.md",
      "monkey-maestro/skills/advance/SKILL.md",
      "monkey-maestro/skills/halt/SKILL.md",
    ];

    for (const path of skillPaths) {
      const skill = read(path);

      expect(skill).toMatch(/project(?:_id| id)/);
      expect(skill).toContain("autopilot.json");
    }
  });

  test("keeps --legacy isolated from project relay selection", () => {
    const halt = read("monkey-maestro/skills/halt/SKILL.md");

    expect(halt).toContain("`--legacy` is terminal");
    expect(halt).toMatch(/Never continue\s+into project target resolution after `--legacy`/);
  });

  test("allows the planner to resolve project scope and validate session-cache freshness", () => {
    const plan = read("linear-devotee/skills/plan/SKILL.md");

    expect(plan).toContain("mcp__claude_ai_Linear__get_issue");
    expect(plan).toContain("git rev-parse HEAD");
    expect(plan).not.toContain("this skill lacks Bash");
  });

  test("does not impose an issue budget on a relay", () => {
    const relayDocs = [
      "monkey-maestro/shared/pipeline-contract.md",
      "monkey-maestro/skills/run/SKILL.md",
      "monkey-maestro/skills/advance/SKILL.md",
      "monkey-maestro/skills/halt/SKILL.md",
    ].map(read);

    for (const doc of relayDocs) {
      expect(doc).not.toContain("max_issues");
      expect(doc).not.toContain("accepted_count");
      expect(doc).not.toContain("budget_reached");
    }
  });

  test("verifies a new workspace and asks before cleanup", () => {
    const spawn = read("git-gremlin/skills/spawn/SKILL.md");
    const contract = read("monkey-maestro/shared/pipeline-contract.md");

    expect(spawn).toContain("report `spawn unverified`");
    expect(spawn).toContain("This confirmation is mandatory even for relay-origin spawns");
    expect(spawn).toContain("or delete without explicit user\n  confirmation");
    expect(contract).toContain("asks the patron whether to delete the previous workspace");
  });
});
