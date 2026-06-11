import { describe, expect, test } from "bun:test";
import { bumpPatch, decideBump, planBumps } from "../bump-plugin-versions.mjs";

describe("bumpPatch", () => {
  test("bumps the patch segment", () => {
    expect(bumpPatch("1.0.1")).toBe("1.0.2");
    expect(bumpPatch("2.0.0")).toBe("2.0.1");
    expect(bumpPatch("0.9.19")).toBe("0.9.20");
  });

  test("rejects non-semver strings", () => {
    expect(() => bumpPatch("1.0")).toThrow();
    expect(() => bumpPatch("v1.0.0")).toThrow();
    expect(() => bumpPatch("")).toThrow();
  });
});

describe("decideBump", () => {
  test("bumps when content changed and version untouched since pin", () => {
    expect(decideBump({ changed: true, pinnedVersion: "1.0.1", currentVersion: "1.0.1" })).toEqual({
      action: "bump",
      nextVersion: "1.0.2",
    });
  });

  test("skips when content unchanged", () => {
    expect(decideBump({ changed: false, pinnedVersion: "1.0.1", currentVersion: "1.0.1" })).toEqual(
      { action: "skip", reason: "unchanged" },
    );
  });

  test("skips when version already bumped past the pin", () => {
    expect(decideBump({ changed: true, pinnedVersion: "1.0.1", currentVersion: "1.0.2" })).toEqual({
      action: "skip",
      reason: "already-bumped",
    });
  });

  test("bumps from current version when no pinned version exists (new plugin)", () => {
    expect(decideBump({ changed: true, pinnedVersion: null, currentVersion: "1.0.0" })).toEqual({
      action: "skip",
      reason: "already-bumped",
    });
  });
});

describe("planBumps", () => {
  const manifest = {
    plugins: [
      { name: "local-one", source: "./local-one" },
      {
        name: "alpha",
        source: { source: "git-subdir", path: "alpha", sha: "a".repeat(40) },
      },
      {
        name: "beta",
        source: { source: "git-subdir", path: "beta", sha: "b".repeat(40) },
      },
    ],
  };

  test("plans bumps only for changed git-subdir plugins with untouched versions", () => {
    const plan = planBumps(manifest, {
      isChanged: (path) => path === "alpha",
      readCurrentVersion: () => "1.0.0",
      readPinnedVersion: () => "1.0.0",
    });
    expect(plan).toEqual([{ name: "alpha", path: "alpha", from: "1.0.0", to: "1.0.1" }]);
  });

  test("ignores local-path plugins and already-bumped plugins", () => {
    const plan = planBumps(manifest, {
      isChanged: () => true,
      readCurrentVersion: (path) => (path === "alpha" ? "1.1.0" : "1.0.0"),
      readPinnedVersion: () => "1.0.0",
    });
    expect(plan).toEqual([{ name: "beta", path: "beta", from: "1.0.0", to: "1.0.1" }]);
  });

  test("returns an empty plan when nothing changed", () => {
    const plan = planBumps(manifest, {
      isChanged: () => false,
      readCurrentVersion: () => "1.0.0",
      readPinnedVersion: () => "1.0.0",
    });
    expect(plan).toEqual([]);
  });
});
