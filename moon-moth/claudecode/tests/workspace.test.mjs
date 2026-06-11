import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findMoonRoot } from "../hooks/workspace.mjs";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moon-moth-test-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("findMoonRoot", () => {
  test("finds the nearest ancestor containing .moon/", () => {
    const root = path.join(tmp, "repo");
    const nested = path.join(root, "apps", "atlas", "api");
    fs.mkdirSync(path.join(root, ".moon"), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    expect(findMoonRoot(nested)).toBe(root);
  });

  test("returns null when no .moon/ exists up-tree", () => {
    const nested = path.join(tmp, "plain", "deep");
    fs.mkdirSync(nested, { recursive: true });
    expect(findMoonRoot(nested)).toBeNull();
  });
});
