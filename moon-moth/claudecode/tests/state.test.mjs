import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cleanupOldStates,
  findMoonRoot,
  readState,
  statePath,
  writeState,
} from "../hooks/state.mjs";

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "moon-moth-test-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("state round-trip", () => {
  test("writeState then readState returns the same object", () => {
    writeState(tmp, "sess1", { in_moon: true, changed_files: 3 });
    expect(readState(tmp, "sess1")).toEqual({ in_moon: true, changed_files: 3 });
  });

  test("readState returns null for an unknown session", () => {
    expect(readState(tmp, "nope")).toBeNull();
  });

  test("statePath nests under claudecode/data", () => {
    expect(statePath(tmp, "sess1")).toBe(path.join(tmp, "claudecode", "data", "state-sess1.json"));
  });
});

describe("cleanupOldStates", () => {
  test("removes state files older than the cutoff, keeps fresh ones", () => {
    writeState(tmp, "old", { a: 1 });
    writeState(tmp, "fresh", { a: 2 });
    const oldFile = statePath(tmp, "old");
    const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldFile, eightDaysAgo, eightDaysAgo);

    cleanupOldStates(tmp, 7);

    expect(readState(tmp, "old")).toBeNull();
    expect(readState(tmp, "fresh")).toEqual({ a: 2 });
  });

  test("is a no-op when the data dir does not exist", () => {
    expect(() => cleanupOldStates(path.join(tmp, "absent"), 7)).not.toThrow();
  });
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
