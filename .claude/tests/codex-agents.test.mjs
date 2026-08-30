import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyAgentPlan,
  checkAgents,
  checkRuntimeMaps,
  codexAgentName,
  expectedAgentFiles,
  expectedRuntimeMapFiles,
  legacyExpectedAgentFiles,
  listAgentSources,
  planAgentSync,
  renderCodexAgent,
  syncAgents,
} from "../../scripts/sync-codex-agents.mjs";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..");
const PROJECT_AGENTS = path.join(REPO_ROOT, ".codex", "agents");

function markdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
  });
}

describe("Codex agent parity", () => {
  test("ports every canonical Claude agent with a unique Codex name", () => {
    const sources = listAgentSources(REPO_ROOT);
    const outputs = expectedAgentFiles(REPO_ROOT);

    expect(sources.length).toBeGreaterThan(0);
    expect(outputs.size).toBe(sources.length);
    expect(outputs.has("lore_hound__source_fetcher.toml")).toBe(true);
    expect(codexAgentName("linear-devotee", "issue-context")).toBe("linear_devotee__issue_context");
    expect(codexAgentName("a-b", "c")).not.toBe(codexAgentName("a", "b-c"));
    expect(() => codexAgentName("linear_devotee", "issue-context")).toThrow(
      /must use lowercase letters, digits, and single hyphens/,
    );
  });

  test("maps Claude model tiers and preserves inherited models", () => {
    const sources = listAgentSources(REPO_ROOT);
    const byAlias = new Map(sources.map((agent) => [`${agent.plugin}:${agent.name}`, agent]));

    expect(renderCodexAgent(byAlias.get("lore-hound:source-fetcher"))).toContain(
      'model = "gpt-5.6-luna"',
    );
    expect(renderCodexAgent(byAlias.get("lore-hound:claim-verifier"))).toContain(
      'model = "gpt-5.6-terra"',
    );
    expect(renderCodexAgent(byAlias.get("linear-devotee:project-drafter"))).toContain(
      'model = "gpt-5.6-sol"',
    );
    expect(renderCodexAgent(byAlias.get("git-gremlin:pr-drafter"))).not.toContain("\nmodel =");
    expect(renderCodexAgent(byAlias.get("warden:voice"))).toContain(
      "Spawn with isolated task-local context, never a full-history fork.",
    );
  });

  test("assigns sandbox capabilities required by each command-running agent", () => {
    const sources = listAgentSources(REPO_ROOT);
    const byAlias = new Map(sources.map((agent) => [`${agent.plugin}:${agent.name}`, agent]));
    const render = (alias) => renderCodexAgent(byAlias.get(alias));

    expect(render("moon-moth:verify-runner")).toContain('sandbox_mode = "workspace-write"');
    expect(render("moon-moth:verify-runner")).not.toContain(
      "sandbox_workspace_write.network_access",
    );
    expect(render("git-gremlin:commit-drafter")).toContain('sandbox_mode = "workspace-write"');
    expect(render("git-gremlin:pr-drafter")).toContain(
      "sandbox_workspace_write.network_access = true",
    );
    expect(render("stack-golem:platform-scout")).toContain(
      "sandbox_workspace_write.network_access = true",
    );
    expect(render("monkey-maestro:runtime-inspector")).toContain(
      'default_permissions = "maestro-runtime-read-network"',
    );
    expect(render("monkey-maestro:runtime-inspector")).toContain(
      'permissions.maestro-runtime-read-network.extends = ":read-only"',
    );
    expect(render("monkey-maestro:runtime-inspector")).toContain(
      "permissions.maestro-runtime-read-network.network.enabled = true",
    );
    expect(render("monkey-maestro:project-snapshot-loader")).toContain(
      'sandbox_mode = "read-only"',
    );
    expect(render("monkey-maestro:control-loader")).toContain('sandbox_mode = "read-only"');
    expect(render("linear-devotee:project-graph-loader")).toContain('sandbox_mode = "read-only"');
    expect(render("lore-hound:source-fetcher")).toContain('sandbox_mode = "read-only"');
  });

  test("keeps runtime-specific Codex names out of shared skill bodies", () => {
    const sources = listAgentSources(REPO_ROOT);
    const skillBodies = new Map();

    for (const plugin of new Set(sources.map((agent) => agent.plugin))) {
      skillBodies.set(
        plugin,
        markdownFiles(path.join(REPO_ROOT, plugin, "skills"))
          .map((filename) => fs.readFileSync(filename, "utf8"))
          .join("\n"),
      );
    }

    for (const agent of sources) {
      expect(skillBodies.get(agent.plugin)).not.toContain(codexAgentName(agent.plugin, agent.name));
    }
  });

  test("routes every logical skill reference through a generated runtime map", () => {
    const sources = listAgentSources(REPO_ROOT);
    const logicalNames = sources.map((agent) => `${agent.plugin}:${agent.name}`);
    const mapPointer = "${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md";

    for (const entry of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_"))
        continue;
      for (const filename of markdownFiles(path.join(REPO_ROOT, entry.name, "skills"))) {
        const body = fs.readFileSync(filename, "utf8");
        if (logicalNames.some((logicalName) => body.includes(logicalName))) {
          expect(body).toContain(mapPointer);
          const frontmatter = body.match(/^---\n([\s\S]*?)\n---/)?.[1];
          const allowedTools = frontmatter?.match(/^allowed-tools:\s*(.+)$/m)?.[1];
          if (allowedTools) expect(allowedTools.split(/,\s*/)).toContain("Read");
        }
      }
    }

    expect(expectedRuntimeMapFiles(REPO_ROOT).size).toBeGreaterThan(0);
  });

  test("keeps generated project agents synchronized", () => {
    expect(checkAgents(REPO_ROOT, PROJECT_AGENTS)).toEqual([]);
    expect(checkRuntimeMaps(REPO_ROOT)).toEqual([]);
  });

  test("refuses unmanaged conflicts before writing any generated files", () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-codex-conflict-"));
    const conflict = path.join(destination, "lore_hound__source_fetcher.toml");
    fs.writeFileSync(conflict, "# personal agent\n");

    try {
      expect(() => syncAgents(REPO_ROOT, destination)).toThrow(/refusing to overwrite/);
      expect(fs.readFileSync(conflict, "utf8")).toBe("# personal agent\n");
      expect(fs.readdirSync(destination)).toEqual(["lore_hound__source_fetcher.toml"]);
    } finally {
      fs.rmSync(destination, { recursive: true });
    }
  });

  test("refuses a target that appears after planning", () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-codex-stale-plan-"));
    const plan = planAgentSync(REPO_ROOT, destination);
    const conflict = path.join(destination, "lore_hound__source_fetcher.toml");
    fs.writeFileSync(conflict, "# appeared after plan\n");

    try {
      expect(() => applyAgentPlan(plan)).toThrow(/appeared after planning/);
      expect(fs.readFileSync(conflict, "utf8")).toBe("# appeared after plan\n");
      expect(fs.readdirSync(destination)).toEqual(["lore_hound__source_fetcher.toml"]);
    } finally {
      fs.rmSync(destination, { recursive: true });
    }
  });

  test("migrates only exact legacy outputs and preserves unrelated personal agents", () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-codex-migration-"));
    const legacyFiles = legacyExpectedAgentFiles(REPO_ROOT);
    const [legacyFilename, legacyContent] = legacyFiles.entries().next().value;
    const unrelated = path.join(destination, "personal_reviewer.toml");
    const orphan = path.join(destination, "orphaned_nuthouse_agent.toml");
    fs.writeFileSync(path.join(destination, legacyFilename), legacyContent);
    fs.writeFileSync(unrelated, "# personal agent\n");
    fs.writeFileSync(orphan, expectedAgentFiles(REPO_ROOT).values().next().value);

    try {
      expect(syncAgents(REPO_ROOT, destination)).toBe(expectedAgentFiles(REPO_ROOT).size);
      expect(fs.existsSync(path.join(destination, legacyFilename))).toBe(false);
      expect(fs.existsSync(orphan)).toBe(false);
      expect(fs.readFileSync(unrelated, "utf8")).toBe("# personal agent\n");
      expect(checkAgents(REPO_ROOT, destination)).toEqual([]);
    } finally {
      fs.rmSync(destination, { recursive: true });
    }
  });

  test("refuses to remove a locally modified legacy output", () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-codex-legacy-edit-"));
    const [legacyFilename, legacyContent] = legacyExpectedAgentFiles(REPO_ROOT)
      .entries()
      .next().value;
    const legacyTarget = path.join(destination, legacyFilename);
    fs.writeFileSync(legacyTarget, `${legacyContent}# local edit\n`);

    try {
      expect(() => syncAgents(REPO_ROOT, destination)).toThrow(/modified; refusing to remove/);
      expect(fs.readFileSync(legacyTarget, "utf8")).toEndWith("# local edit\n");
      expect(fs.readdirSync(destination)).toEqual([legacyFilename]);
    } finally {
      fs.rmSync(destination, { recursive: true });
    }
  });
});
