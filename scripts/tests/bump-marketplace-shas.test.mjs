import { describe, expect, test } from "bun:test";
import { resolvePluginSha, updateMarketplaceShas } from "../bump-marketplace-shas.mjs";

describe("resolvePluginSha", () => {
  test("passes refs and paths to Git as literal arguments", () => {
    const calls = [];
    const execute = (command, args, options) => {
      calls.push({ command, args, options });
      return `${"a".repeat(40)}\n`;
    };

    expect(resolvePluginSha("main; touch ref-pwned", "plugin; touch path-pwned", execute)).toBe(
      "a".repeat(40),
    );
    expect(calls).toEqual([
      {
        command: "git",
        args: [
          "log",
          "-1",
          "--format=%H",
          "--end-of-options",
          "main; touch ref-pwned",
          "--",
          "plugin; touch path-pwned/",
        ],
        options: { encoding: "utf8" },
      },
    ]);
  });
});

describe("updateMarketplaceShas", () => {
  test("updates only git-subdir entries", () => {
    const manifest = {
      plugins: [
        {
          name: "local",
          source: "./local",
        },
        {
          name: "external",
          source: { source: "github", repo: "owner/repo", sha: "b".repeat(40) },
        },
        {
          name: "subdir",
          source: { source: "git-subdir", path: "subdir", sha: "b".repeat(40) },
        },
      ],
    };

    expect(updateMarketplaceShas(manifest, () => "a".repeat(40))).toEqual([
      { plugin: "subdir", from: "b".repeat(40), to: "a".repeat(40) },
    ]);
    expect(manifest.plugins[2].source.sha).toBe("a".repeat(40));
    expect(manifest.plugins[1].source.sha).toBe("b".repeat(40));
  });

  test("rejects invalid resolved commit ids", () => {
    const manifest = {
      plugins: [{ name: "subdir", source: { source: "git-subdir", path: "subdir" } }],
    };

    expect(() => updateMarketplaceShas(manifest, () => "not-a-sha")).toThrow(
      "Invalid sha resolved for subdir",
    );
  });
});
