import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const commitSkill = read("git-gremlin/skills/commit/SKILL.md");
const prSkill = read("git-gremlin/skills/pr/SKILL.md");
const prAgent = read("git-gremlin/agents/pr-drafter.md");

function git(repository, args) {
  const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

test("commit intent prepares an empty index without widening scope", () => {
  expect(commitSkill).toContain("Bash(git add:*)");
  expect(commitSkill).toContain(
    "For **explicit path scope** with an empty index and a dirty working tree, run `git add -- <pathspec...>`",
  );
  expect(commitSkill).toContain("`ALL_STAGED` from the unfiltered `git diff --staged --name-only`");
  expect(commitSkill).toContain(
    "`IN_SCOPE_STAGED` from `git diff --staged --name-only -- <pathspec...>`",
  );
  expect(commitSkill).toContain("Require the sets to be exactly equal");
  expect(commitSkill).toContain("Never fall back to the full tree");
  expect(commitSkill).toContain("preserve any existing staged selection");
  expect(commitSkill).toContain("For **full tree** scope, run `git add -A`");
  expect(commitSkill).toContain("For **default** scope");
  expect(commitSkill).toContain("Draft-only intent never authorizes staging or committing");
});

test("explicit path scope detects an unrelated pre-staged file", () => {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), "git-gremlin-scope-"));

  try {
    git(repository, ["init"]);
    git(repository, ["config", "user.name", "Git Gremlin Test"]);
    git(repository, ["config", "user.email", "gremlin@example.invalid"]);
    fs.writeFileSync(path.join(repository, "README.md"), "initial readme\n");
    fs.writeFileSync(path.join(repository, "outside.txt"), "initial outside\n");
    git(repository, ["add", "-A"]);
    git(repository, ["commit", "-m", "seed"]);

    fs.writeFileSync(path.join(repository, "README.md"), "changed readme\n");
    fs.writeFileSync(path.join(repository, "outside.txt"), "changed outside\n");
    git(repository, ["add", "--", "outside.txt"]);

    const allStaged = git(repository, ["diff", "--staged", "--name-only"]);
    const inScopeStaged = git(repository, ["diff", "--staged", "--name-only", "--", "README.md"]);

    expect(allStaged).toBe("outside.txt");
    expect(inScopeStaged).toBe("");
    expect(inScopeStaged).not.toBe(allStaged);
  } finally {
    fs.rmSync(repository, { recursive: true });
  }
});

test("PR approval binds HEAD and publishes only a same-named non-base branch", () => {
  expect(prSkill).toContain(
    "confirmation authorizes publishing only that commit to the same-named branch",
  );
  expect(prSkill).toContain("Immediately before displaying the proposal");
  expect(prSkill).toMatch(
    /ACTION: execute[\s\S]*BRANCH: <approved current branch>[\s\S]*HEAD_OID: <approved git commit OID>/,
  );
  expect(prAgent).toContain("HEAD changed since approval; regenerate the PR proposal");
  expect(prAgent).toContain("Reject when `BRANCH` equals `BASE`");
  expect(prAgent).toContain("branch.<BRANCH>.pushRemote");
  expect(prAgent).toContain("remote.pushDefault");
  expect(prAgent).toContain('git push "<REMOTE>" "<HEAD_OID>:refs/heads/<BRANCH>"');
  expect(prAgent).toContain('git config "branch.<BRANCH>.merge" "refs/heads/<BRANCH>"');

  const executeSection = prAgent
    .split("### 2. On `ACTION: execute`")[1]
    .split("## Output Format")[0];
  const oidCheckIndex = executeSection.indexOf("git rev-parse HEAD");
  const pushIndex = executeSection.indexOf('git push "<REMOTE>" "<HEAD_OID>');
  const createIndex = executeSection.indexOf('gh pr create --head "<BRANCH>"');

  expect(oidCheckIndex).toBeGreaterThan(-1);
  expect(pushIndex).toBeGreaterThan(oidCheckIndex);
  expect(pushIndex).toBeGreaterThan(-1);
  expect(createIndex).toBeGreaterThan(pushIndex);
  expect(executeSection).not.toContain('"HEAD:refs/heads/<BRANCH>"');
  expect(executeSection).not.toContain("HEAD:<MERGE_REF>");
  expect(executeSection).not.toContain("git push --force");
  expect(executeSection).not.toContain("git push -f");
});

test("PR handoff resumes healthy Maestro orchestration and keeps reconcile recovery-only", () => {
  expect(prSkill).toContain(
    "active Maestro project, mention only this optional next action: after Linear records the issue completed, the user or a known workflow may invoke `monkey-maestro:orchestrate <project-id>`.",
  );
  expect(prSkill).toContain(
    "Reserve `monkey-maestro:reconcile <project-id>` for an explicit Superset runtime-correlation audit or telemetry repair",
  );
  expect(prSkill).toContain(
    "Project execution: optional monkey-maestro:orchestrate <project-id> after Linear completion | n/a",
  );
  expect(prSkill).not.toContain(
    "Project execution: optional monkey-maestro:reconcile after Linear completion",
  );
});
