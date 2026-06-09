import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

import { collectReviewContext, globToRegExp, parseNameStatus } from "../scripts/review-context.mjs";

function run(cwd, args) {
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

function makeRepo() {
  const repo = mkdtempSync(path.join(os.tmpdir(), "review-context-"));
  run(repo, ["init", "-b", "main"]);
  run(repo, ["config", "user.email", "test@example.com"]);
  run(repo, ["config", "user.name", "Test User"]);
  return repo;
}

describe("review-context", () => {
  test("parses name-status with renames", () => {
    expect(parseNameStatus("M\tapp.ts\nR100\told.ts\tnew.ts")).toEqual([
      { status: "M", path: "app.ts" },
      { status: "R100", path: "new.ts", previousPath: "old.ts" },
    ]);
  });

  test("matches simple and recursive globs", () => {
    expect(globToRegExp("*.tsx").test("apps/web/App.tsx")).toBe(true);
    expect(globToRegExp("apps/**/*.ts").test("apps/api/src/env.ts")).toBe(true);
    expect(globToRegExp("apps/**/*.ts").test("packages/api/src/env.ts")).toBe(false);
  });

  test("collects applicable instruction sources for changed files", () => {
    const repo = makeRepo();
    mkdirSync(path.join(repo, "apps/web"), { recursive: true });
    mkdirSync(path.join(repo, ".github/instructions"), { recursive: true });
    writeFileSync(path.join(repo, "AGENTS.md"), "Use repo conventions.\n");
    writeFileSync(
      path.join(repo, ".github/instructions/react.instructions.md"),
      '---\napplyTo: "apps/**/*.tsx"\n---\nReact rules.\n',
    );
    writeFileSync(path.join(repo, "apps/web/App.tsx"), "export const App = () => null;\n");
    run(repo, ["add", "."]);
    run(repo, ["commit", "-m", "initial"]);

    writeFileSync(path.join(repo, "apps/web/App.tsx"), "export const App = () => <main />;\n");
    const context = collectReviewContext({ cwd: repo });

    expect(context.target.kind).toBe("worktree");
    expect(context.changedFiles.map((file) => file.path)).toContain("apps/web/App.tsx");
    const sources = context.instructionSources.filter((source) => source.applies);
    expect(sources.map((source) => source.path)).toContain("AGENTS.md");
    expect(sources.map((source) => source.path)).toContain(
      ".github/instructions/react.instructions.md",
    );
  });

  test("includes untracked files in worktree context", () => {
    const repo = makeRepo();
    writeFileSync(path.join(repo, "README.md"), "initial\n");
    run(repo, ["add", "."]);
    run(repo, ["commit", "-m", "initial"]);

    writeFileSync(path.join(repo, "new-file.ts"), "export const value = 1;\n");
    const context = collectReviewContext({ cwd: repo });

    expect(context.changedFiles).toContainEqual({ status: "??", path: "new-file.ts" });
    expect(context.warnings).toContain(
      "Untracked files are present; inspect their contents separately from plain git diff.",
    );
  });

  test("does not treat plugin marketplace JSON as review instructions", () => {
    const repo = makeRepo();
    mkdirSync(path.join(repo, ".agents/plugins"), { recursive: true });
    mkdirSync(path.join(repo, ".agents/rules"), { recursive: true });
    writeFileSync(path.join(repo, ".agents/plugins/marketplace.json"), "{}\n");
    writeFileSync(path.join(repo, ".agents/rules/review.md"), "Review rule.\n");
    writeFileSync(path.join(repo, "README.md"), "initial\n");
    run(repo, ["add", "."]);
    run(repo, ["commit", "-m", "initial"]);

    writeFileSync(path.join(repo, "README.md"), "changed\n");
    const context = collectReviewContext({ cwd: repo });
    const sourcePaths = context.instructionSources.map((source) => source.path);

    expect(sourcePaths).toContain(".agents/rules/review.md");
    expect(sourcePaths).not.toContain(".agents/plugins/marketplace.json");
  });
});
