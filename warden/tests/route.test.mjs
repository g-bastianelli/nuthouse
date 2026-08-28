import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { runRoute } from "../scripts/route.mjs";

const ROUTE_SCRIPT = path.resolve(import.meta.dir, "..", "scripts", "route.mjs");
const temporaryDirectories = new Set();

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  temporaryDirectories.clear();
});

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }

  return result.stdout.trim();
}

function makeRepository(branch = "main") {
  const repository = fs.mkdtempSync(path.join(os.tmpdir(), "warden-route-"));
  temporaryDirectories.add(repository);
  git(repository, ["init", "-b", branch]);
  git(repository, ["config", "user.email", "warden-route@example.test"]);
  git(repository, ["config", "user.name", "Warden Route Test"]);
  fs.writeFileSync(path.join(repository, "README.md"), "fixture\n");
  git(repository, ["add", "README.md"]);
  git(repository, ["commit", "-m", "fixture"]);
  return repository;
}

function routeInput(projectIntent, task, branch = "feature/plain-task") {
  return { projectIntent, task, branch };
}

describe("warden route adapter", () => {
  test("routes caller-normalized project creation independently of task language (AC-001)", () => {
    const descriptions = [
      "Créer un projet Linear pour cette initiative",
      "Create a Linear project for this initiative",
      "この取り組み用の Linear プロジェクトを作成する",
      "Crear un proyecto de Linear para esta iniciativa",
    ];

    for (const task of descriptions) {
      expect(runRoute(routeInput("explicit", task))).toEqual({
        workflow: "project-creation",
        projectIntent: "explicit",
        issueIdentifiers: [],
        target: { kind: "skill", name: "linear-devotee:create-project" },
        diagnostics: [],
        blocked: false,
      });
    }
  });

  test("routes one normalized request or branch identifier to Linear Devotee greet (AC-002)", () => {
    expect(
      runRoute(routeInput("absent", "Work on https://linear.app/notom/issue/not-548/x")),
    ).toEqual({
      workflow: "issue-delivery",
      projectIntent: "absent",
      issueIdentifiers: ["NOT-548"],
      target: { kind: "skill", name: "linear-devotee:greet", arguments: ["NOT-548"] },
      diagnostics: [],
      blocked: false,
    });

    expect(
      runRoute(routeInput("absent", "Continue the current issue", "team/not-548-fix")),
    ).toEqual({
      workflow: "issue-delivery",
      projectIntent: "absent",
      issueIdentifiers: ["NOT-548"],
      target: { kind: "skill", name: "linear-devotee:greet", arguments: ["NOT-548"] },
      diagnostics: [],
      blocked: false,
    });
  });

  test("deduplicates compatible request and branch evidence", () => {
    const result = runRoute(
      routeInput("absent", "Implement NOT-548", "gbastianelli/not-548-routing"),
    );

    expect(result.workflow).toBe("issue-delivery");
    expect(result.issueIdentifiers).toEqual(["NOT-548"]);
    expect(result.blocked).toBe(false);
  });

  test("keeps a task with no Linear signal in the current turn (AC-003)", () => {
    expect(runRoute(routeInput("absent", "Refactor the local parser"))).toEqual({
      workflow: "direct-task",
      projectIntent: "absent",
      issueIdentifiers: [],
      target: { kind: "current-turn", name: "direct-task" },
      diagnostics: [],
      blocked: false,
    });
  });

  test("blocks incompatible project and issue signals without a target (AC-004)", () => {
    const result = runRoute(routeInput("explicit", "Create the project for NOT-548"));

    expect(result.workflow).toBe("ambiguous");
    expect(result.target).toBeNull();
    expect(result.blocked).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "incompatible-workflow-signals", blocked: true }),
    ]);
  });

  test("blocks uncertain project intent and multiple distinct issue identifiers (AC-004)", () => {
    const uncertain = runRoute(routeInput("ambiguous", "Maybe start a project"));
    expect(uncertain.workflow).toBe("ambiguous");
    expect(uncertain.target).toBeNull();
    expect(uncertain.diagnostics[0]?.code).toBe("ambiguous-project-intent");

    const multiple = runRoute(routeInput("absent", "Compare NOT-548 with OPS-7"));
    expect(multiple.workflow).toBe("ambiguous");
    expect(multiple.issueIdentifiers).toEqual(["NOT-548", "OPS-7"]);
    expect(multiple.target).toBeNull();
    expect(multiple.diagnostics[0]?.code).toBe("multiple-linear-issue-identifiers");
  });

  test("blocks invalid normalized project intent at the adapter boundary", () => {
    const result = runRoute(routeInput("unknown", "Create a project"));

    expect(result).toEqual({
      workflow: "ambiguous",
      projectIntent: "unknown",
      issueIdentifiers: [],
      target: null,
      diagnostics: [
        expect.objectContaining({
          code: "invalid-project-intent",
          field: "$.projectIntent",
          blocked: true,
        }),
      ],
      blocked: true,
    });
  });

  test("produces identical JSON for equivalent Claude and Codex adapter inputs (AC-045)", () => {
    const shared = routeInput("absent", "Deliver NOT-548", "feature/plain-task");

    expect(runRoute({ ...shared, runtime: "claude" })).toEqual(
      runRoute({ ...shared, runtime: "codex" }),
    );
  });

  test("CLI reads the current branch, returns JSON, and performs no repository mutation", () => {
    const repository = makeRepository("gbastianelli/not-548-routing");
    const beforeStatus = git(repository, ["status", "--porcelain=v1"]);
    const beforeHead = git(repository, ["rev-parse", "HEAD"]);

    const result = spawnSync(
      process.execPath,
      [ROUTE_SCRIPT, "--project-intent", "absent", "--", "Continue the current issue"],
      { cwd: repository, encoding: "utf8" },
    );
    const parsed = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(parsed.workflow).toBe("issue-delivery");
    expect(parsed.issueIdentifiers).toEqual(["NOT-548"]);
    expect(parsed.target).toEqual({
      kind: "skill",
      name: "linear-devotee:greet",
      arguments: ["NOT-548"],
    });
    expect(git(repository, ["status", "--porcelain=v1"])).toBe(beforeStatus);
    expect(git(repository, ["rev-parse", "HEAD"])).toBe(beforeHead);
  });

  test("CLI exits nonzero for ambiguity while leaving the repository unchanged (AC-004)", () => {
    const repository = makeRepository();
    const beforeStatus = git(repository, ["status", "--porcelain=v1"]);
    const result = spawnSync(
      process.execPath,
      [ROUTE_SCRIPT, "--project-intent", "explicit", "--", "Create a project for NOT-548"],
      { cwd: repository, encoding: "utf8" },
    );
    const parsed = JSON.parse(result.stdout);

    expect(result.status).not.toBe(0);
    expect(parsed.workflow).toBe("ambiguous");
    expect(parsed.target).toBeNull();
    expect(parsed.blocked).toBe(true);
    expect(git(repository, ["status", "--porcelain=v1"])).toBe(beforeStatus);
  });

  test("imports only Warden's install-local workflow bundle", () => {
    const source = fs.readFileSync(ROUTE_SCRIPT, "utf8");
    expect(source).toContain('from "../lib/workflow/index.mjs"');
    expect(source).not.toContain("_shared/workflow");
  });
});
