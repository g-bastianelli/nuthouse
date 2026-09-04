import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findMoonRoot } from "../hooks/workspace.mjs";

let tmp;
const hookPath = fileURLToPath(new URL("../hooks/session-start.mjs", import.meta.url));
const workspaceExtensions = ["json", "jsonc", "hcl", "pkl", "toml", "yml", "yaml"];

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moon-moth-test-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("findMoonRoot", () => {
  test("finds every supported moon workspace config extension", () => {
    for (const extension of workspaceExtensions) {
      const root = path.join(tmp, extension);
      const nested = path.join(root, "apps", "atlas", "api");
      fs.mkdirSync(path.join(root, ".moon"), { recursive: true });
      fs.writeFileSync(path.join(root, ".moon", `workspace.${extension}`), "projects = {}\n");
      fs.mkdirSync(nested, { recursive: true });
      expect(findMoonRoot(nested)).toBe(root);
    }
  });

  test("supports workspace config under .config/moon", () => {
    const root = path.join(tmp, "repo");
    const nested = path.join(root, "packages", "core");
    fs.mkdirSync(path.join(root, ".config", "moon"), { recursive: true });
    fs.writeFileSync(path.join(root, ".config", "moon", "workspace.yml"), "projects: {}\n");
    fs.mkdirSync(nested, { recursive: true });
    expect(findMoonRoot(nested)).toBe(root);
  });

  test("ignores a .moon directory without workspace config", () => {
    const root = path.join(tmp, "repo");
    const nested = path.join(root, "apps", "atlas");
    fs.mkdirSync(path.join(root, ".moon"), { recursive: true });
    fs.writeFileSync(path.join(root, ".moon", "id"), "global-cache-id\n");
    fs.mkdirSync(nested, { recursive: true });
    expect(findMoonRoot(nested)).toBeNull();
  });

  test("ignores a directory named like a workspace config", () => {
    const root = path.join(tmp, "repo");
    const nested = path.join(root, "apps", "atlas");
    fs.mkdirSync(path.join(root, ".moon", "workspace.yml"), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    expect(findMoonRoot(nested)).toBeNull();
  });

  test("returns null when no .moon/ exists up-tree", () => {
    const nested = path.join(tmp, "plain", "deep");
    fs.mkdirSync(nested, { recursive: true });
    expect(findMoonRoot(nested)).toBeNull();
  });
});

describe("session-start", () => {
  test("stays silent outside a configured moon workspace", () => {
    const nested = path.join(tmp, "repo", "apps", "atlas");
    fs.mkdirSync(path.join(tmp, "repo", ".moon"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "repo", ".moon", "id"), "global-cache-id\n");
    fs.mkdirSync(nested, { recursive: true });

    const result = spawnSync(process.execPath, [hookPath], { cwd: nested, encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  test("emits one short reminder inside a configured moon workspace", () => {
    const root = path.join(tmp, "repo");
    const nested = path.join(root, "apps", "atlas");
    fs.mkdirSync(path.join(root, ".moon"), { recursive: true });
    fs.writeFileSync(path.join(root, ".moon", "workspace.yml"), "projects: {}\n");
    fs.mkdirSync(nested, { recursive: true });

    const result = spawnSync(process.execPath, [hookPath], { cwd: nested, encoding: "utf8" });
    const output = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(output.hookSpecificOutput.additionalContext).toContain(
      `Moon workspace: ${fs.realpathSync(root)}`,
    );
    expect(output.hookSpecificOutput.additionalContext).not.toContain("changed file(s)");
  });
});
