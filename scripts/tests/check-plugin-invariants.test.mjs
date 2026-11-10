import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkPluginInvariants } from "../check-plugin-invariants.mjs";

const roots = [];
const REGISTRIES = {
  claude: ".claude-plugin/marketplace.json",
  codex: ".agents/plugins/marketplace.json",
};

function writeJson(root, filename, value) {
  const target = path.join(root, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value));
}

function fixture({ codex = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-registry-"));
  roots.push(root);
  const entry = { name: "shell-wisp", source: { source: "git-subdir", path: "shell-wisp" } };
  writeJson(root, REGISTRIES.claude, { plugins: [entry] });
  writeJson(root, REGISTRIES.codex, { plugins: codex ? [entry] : [] });
  const manifest = { name: entry.name, version: "1.0.0" };
  writeJson(root, "shell-wisp/.claude-plugin/plugin.json", manifest);
  if (codex) writeJson(root, "shell-wisp/.codex-plugin/plugin.json", manifest);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

describe("plugin registry coherence", () => {
  test("accepts declared runtimes without requiring a fixed plugin inventory", () => {
    expect(checkPluginInvariants(fixture())).toEqual([]);
    expect(checkPluginInvariants(fixture({ codex: false }))).toEqual([]);
    const root = fixture();
    fs.rmSync(path.join(root, "shell-wisp/.claude-plugin/plugin.json"));
    expect(checkPluginInvariants(root)).toEqual([]);
  });

  test("detects a Codex manifest omitted from its registry", () => {
    const root = fixture();
    writeJson(root, REGISTRIES.codex, { plugins: [] });
    expect(checkPluginInvariants(root).join("\n")).toContain(
      "shell-wisp: missing Codex registry entry",
    );
  });

  test("detects a cross-runtime plugin omitted from the Claude registry", () => {
    const root = fixture();
    writeJson(root, REGISTRIES.claude, { plugins: [] });
    expect(checkPluginInvariants(root).join("\n")).toContain(
      "shell-wisp: missing Claude registry entry",
    );
  });

  test("detects registry paths that do not resolve to the declared plugin", () => {
    const root = fixture();
    writeJson(root, REGISTRIES.codex, {
      plugins: [{ name: "shell-wisp", source: { source: "git-subdir", path: "./missing" } }],
    });
    expect(checkPluginInvariants(root).join("\n")).toContain("shell-wisp: Codex registry path");
  });

  test("detects conflicting names, duplicate entries and version drift", () => {
    const root = fixture();
    writeJson(root, "shell-wisp/.codex-plugin/plugin.json", {
      name: "other-wisp",
      version: "1.0.1",
    });
    const entry = { name: "shell-wisp", source: "./shell-wisp" };
    writeJson(root, REGISTRIES.claude, { plugins: [entry, entry] });
    const problems = checkPluginInvariants(root).join("\n");
    expect(problems).toContain("manifest names differ");
    expect(problems).toContain("duplicate plugin name shell-wisp");
    expect(problems).toContain("versions differ");
  });

  test("reports malformed registries without crashing", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, REGISTRIES.codex), "{");
    expect(checkPluginInvariants(root).join("\n")).toContain("invalid JSON");
    writeJson(root, REGISTRIES.codex, { plugins: [null] });
    expect(checkPluginInvariants(root).join("\n")).toContain("plugin entry has no name");
    for (const value of [null, false, 0, []]) {
      writeJson(root, REGISTRIES.codex, value);
      expect(checkPluginInvariants(root).join("\n")).toContain("expected JSON object");
    }
  });

  test("permits complete plugin removal without a frozen inventory", () => {
    const root = fixture();
    writeJson(root, REGISTRIES.claude, { plugins: [] });
    writeJson(root, REGISTRIES.codex, { plugins: [] });
    fs.rmSync(path.join(root, "shell-wisp"), { recursive: true });
    expect(checkPluginInvariants(root)).toEqual([]);
  });
});
