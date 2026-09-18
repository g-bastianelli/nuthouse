import { afterEach, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cli = path.resolve(import.meta.dir, "../skills/check-folder-shape/scripts/inventory.mjs");
const repos = [];
function repo(files) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "folder-shape-"));
  repos.push(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  const write = (name, body = "export const value = 1;\n") => {
    fs.mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
    fs.writeFileSync(path.join(cwd, name), body);
  };
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  for (const [name, body] of Object.entries(files)) write(name, body);
  git("add", ".");
  git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD").trim();
  const scan = (from = cwd) =>
    JSON.parse(execFileSync("node", [cli, "--base", base], { cwd: from, encoding: "utf8" }));
  return { cwd, git, write, base, scan };
}
afterEach(() => {
  for (const cwd of repos.splice(0)) fs.rmSync(cwd, { recursive: true, force: true });
});

test("settled tree includes commits, staged, unstaged, untracked and both rename owners", () => {
  const r = repo({
    "AGENTS.md": "Root convention",
    "src/AGENTS.md": "Local convention",
    "src/Old/index.tsx": "export {};",
    "src/Old/kept.ts": "export const kept = 2;",
    "src/a.ts": "export const a = 1;",
  });
  r.git("rm", "src/Old/index.tsx");
  r.git("commit", "-qm", "remove owner");
  r.git("mv", "src/a.ts", "src/b.ts");
  r.write("src/Old/kept.ts", "export const kept = 3;");
  r.write("src/new file\twith tab.ts");
  r.write(".gitignore", "ignored/\n");
  r.write("ignored/no.ts");
  const report = r.scan(path.join(r.cwd, "src"));
  expect(report.changes.some((c) => c.path === "src/new file\twith tab.ts")).toBe(true);
  expect(report.changes.some((c) => c.path.startsWith("ignored/"))).toBe(false);
  const orphan = report.folders.find((f) => f.folder === "src/Old");
  expect(orphan.removedEntryPointsWithSurvivors).toEqual([
    { entry: "src/Old/index.tsx", remainingFiles: ["src/Old/kept.ts"] },
  ]);
  expect(orphan.convention).toBe("src/AGENTS.md");
  expect(orphan.fileCount).toBe(1);
});

test("counts the settled level, includes unchanged siblings and nearest entry-point owner", () => {
  const files = {
    "Inspector/index.tsx": "export {};",
    "Inspector/Panel/index.tsx": "export {};",
    "Inspector/Panel/deep/logic.ts": "export {};",
  };
  for (let i = 0; i < 32; i++) files[`Inspector/leaf${i}.ts`] = "export {};";
  const r = repo(files);
  r.write("Inspector/leaf0.ts", "// changed");
  r.write("Inspector/Panel/deep/logic.ts", "// changed");
  const folders = r.scan().folders;
  const inspector = folders.find((f) => f.folder === "Inspector");
  expect(inspector.fileCount).toBe(33);
  expect(inspector.childFolders).toEqual(["Panel"]);
  expect(folders.some((f) => f.folder === "Inspector/Panel")).toBe(true);
});

test("reports Git rename endpoints and preserves unstaged moves as deletion plus untracked", () => {
  const r = repo({
    "Owner/moved.ts": "export const moved = 123456;",
    "Owner/sibling.ts": "export {};",
  });
  fs.mkdirSync(path.join(r.cwd, "Shared"));
  r.git("mv", "Owner/moved.ts", "Shared/moved.ts");
  const report = r.scan();
  expect(report.folders.find((f) => f.folder === "Owner").movedOut).toEqual([
    { from: "Owner/moved.ts", to: "Shared/moved.ts" },
  ]);
  expect(report.folders.some((f) => f.folder === "Shared")).toBe(true);
  fs.renameSync(path.join(r.cwd, "Owner/sibling.ts"), path.join(r.cwd, "Shared/sibling.ts"));
  const unstaged = r.scan();
  expect(unstaged.changes).toContainEqual({ status: "D", path: "Owner/sibling.ts" });
  expect(unstaged.changes).toContainEqual({ status: "?", path: "Shared/sibling.ts" });
});

test("empty diff is explicit; invalid or omitted base fails", () => {
  const r = repo({ "a.ts": "export {};" });
  expect(r.scan().folders).toEqual([]);
  for (const args of [[], ["--base", "missing-ref"], ["--base", "--all"]]) {
    const result = spawnSync("node", [cli, ...args], { cwd: r.cwd, encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  }
});

test("does not follow symlinks, and keeps a removed empty owner out of orphan findings", () => {
  const r = repo({ "gone/index.ts": "export {};", "src/a.ts": "export {};" });
  r.git("rm", "gone/index.ts");
  fs.symlinkSync(os.tmpdir(), path.join(r.cwd, "src/link"));
  const report = r.scan();
  expect(report.folders.find((f) => f.folder === "gone").removedEntryPointsWithSurvivors).toEqual(
    [],
  );
  expect(report.skippedFiles).toContain("src/link");
});

test("moves into a child folder still require checking sibling consumers", () => {
  const r = repo({
    "Owner/helper.ts": "export const helper = 5;",
    "Owner/sibling.ts": "export {};",
  });
  fs.mkdirSync(path.join(r.cwd, "Owner/Child"));
  r.git("mv", "Owner/helper.ts", "Owner/Child/helper.ts");
  const before = r.git("status", "--porcelain=v1");
  expect(r.scan().folders.find((f) => f.folder === "Owner").movedOut).toEqual([
    { from: "Owner/helper.ts", to: "Owner/Child/helper.ts" },
  ]);
  expect(r.git("status", "--porcelain=v1")).toBe(before);
});
