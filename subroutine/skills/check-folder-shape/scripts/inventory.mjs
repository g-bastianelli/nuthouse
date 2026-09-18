#!/usr/bin/env node
// Read-only facts for the folder-shape review. Deliberately no import parser.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--base" || !args[1] || args[1].startsWith("-")) {
    throw new Error("Usage: node inventory.mjs --base <task-start-commit-or-merge-base>");
  }
  let cwd = process.cwd();
  const git = (...argv) =>
    execFileSync("git", argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  cwd = git("rev-parse", "--show-toplevel").trim();
  const base = git("rev-parse", "--verify", "--end-of-options", `${args[1]}^{commit}`).trim();
  const split = (text) => text.split("\0").filter(Boolean);
  const tokens = split(git("diff", "--name-status", "-z", "--find-renames", base, "--"));
  const changes = [];
  for (let i = 0; i < tokens.length; ) {
    const status = tokens[i++];
    const first = tokens[i++];
    changes.push(
      /^[RC]/.test(status) ? { status, from: first, path: tokens[i++] } : { status, path: first },
    );
  }
  const untracked = split(git("ls-files", "--others", "--exclude-standard", "-z"));
  changes.push(...untracked.map((file) => ({ status: "?", path: file })));
  const files = [];
  const skippedFiles = [];
  for (const file of [
    ...new Set(split(git("ls-files", "--cached", "-z")).concat(untracked)),
  ].sort()) {
    let current = cwd;
    let stat;
    for (const part of file.split("/")) {
      current = path.join(current, part);
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        stat = null;
        break;
      }
      if (stat.isSymbolicLink()) break;
    }
    if (!stat) continue; // Removed tracked files are absent from the settled tree.
    if (stat.isFile()) files.push(file);
    else skippedFiles.push(file); // No symlink traversal or submodule scan.
  }
  const fileSet = new Set(files);
  const owners = new Set();
  for (const change of changes) {
    for (const file of [change.from, change.path].filter(Boolean)) {
      let folder = path.posix.dirname(file);
      owners.add(folder);
      // Inspect the containing owner as well as the folder directly edited.
      while (folder !== ".") {
        folder = path.posix.dirname(folder);
        if (
          ["index.ts", "index.tsx"].some((index) => fileSet.has(path.posix.join(folder, index)))
        ) {
          owners.add(folder);
          break;
        }
      }
    }
  }
  const folders = [...owners].sort().map((folder) => {
    const descendants = files.filter((file) => folder === "." || file.startsWith(`${folder}/`));
    const directFiles = descendants.filter((file) => path.posix.dirname(file) === folder);
    let current = folder;
    let convention = null;
    for (;;) {
      const agents = path.posix.join(current, "AGENTS.md");
      if (fileSet.has(agents)) {
        convention = agents;
        break;
      }
      if (current === ".") break;
      current = path.posix.dirname(current);
    }
    const removedEntries = changes
      .filter(
        (c) =>
          (c.status === "D" || c.status.startsWith("R")) &&
          /(?:^|\/)index\.tsx?$/.test(c.from ?? c.path) &&
          path.posix.dirname(c.from ?? c.path) === folder &&
          !fileSet.has(c.from ?? c.path),
      )
      .map((c) => c.from ?? c.path);
    return {
      folder,
      convention,
      fileCount: directFiles.length,
      files: directFiles,
      childFolders: [
        ...new Set(
          descendants
            .filter((file) => !directFiles.includes(file))
            .map((file) => path.posix.relative(folder, file).split("/")[0]),
        ),
      ].sort(),
      removedEntryPointsWithSurvivors: descendants.length
        ? removedEntries.map((entry) => ({ entry, remainingFiles: descendants }))
        : [],
      movedOut: changes
        .filter(
          (c) =>
            c.status.startsWith("R") &&
            path.posix.dirname(c.from) === folder &&
            path.posix.dirname(c.path) !== folder,
        )
        .map((c) => ({ from: c.from, to: c.path })),
    };
  });
  process.stdout.write(
    `${JSON.stringify({ base, root: cwd, folders, changes, skippedFiles }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(`subroutine: folder inventory failed: ${error.message}\n`);
  process.exitCode = 1;
}
