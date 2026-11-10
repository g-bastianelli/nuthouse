import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  applyAgentPlan,
  checkAgents,
  checkRuntimeMaps,
  codexAgentName,
  expectedAgentFiles,
  expectedRuntimeMapFiles,
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
  test("preserves a scaffolded agent's tool allowlist in the Codex instructions", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-agent-template-"));
    const tools = ["Read", "Glob"];
    const template = fs.readFileSync(path.join(REPO_ROOT, "_templates/agent/AGENT.md"), "utf8");
    const source = template
      .replace(/^<!-- template-meta[\s\S]*?-->\s*/, "")
      .replaceAll("{{agent}}", "context-reader")
      .replaceAll("{{description}}", "Read bounded repository context.")
      .replaceAll("{{tools}}", tools.map((tool) => `  - ${tool}`).join("\n"));
    const directory = path.join(root, "test-plugin", "agents");
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "context-reader.md"), source);
      const [agent] = listAgentSources(root);
      expect(agent.tools).toEqual(tools);
      const generated = expectedAgentFiles(root).get("test_plugin__context_reader.toml");
      expect(generated).toContain("Claude capabilities: Read, Glob.");
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

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
    expect(renderCodexAgent(byAlias.get("acid-prophet:spec-auditor"))).toContain(
      "Spawn with isolated task-local context, never a full-history fork.",
    );
  });

  test("customizes agents without promising a separate permission policy", () => {
    for (const agent of listAgentSources(REPO_ROOT)) {
      const rendered = renderCodexAgent(agent);
      const settings = rendered.split("developer_instructions =")[0];
      expect(settings).not.toMatch(
        /^(?:sandbox_mode|sandbox_workspace_write|approval_policy|default_permissions|permissions)[ .=]/m,
      );
      expect(rendered).toContain("Inherit the parent session's sandbox and approval policy");
    }
  });

  test("previews exact personal changes under CODEX_HOME without writing them", () => {
    const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-codex-home-"));
    const destination = path.join(codexHome, "agents");
    const orphan = path.join(destination, "orphaned_nuthouse_agent.toml");
    const [filename, content] = expectedAgentFiles(REPO_ROOT).entries().next().value;
    fs.mkdirSync(destination);
    fs.writeFileSync(orphan, content);
    try {
      const output = execFileSync(
        process.execPath,
        [path.join(REPO_ROOT, "scripts/sync-codex-agents.mjs"), "--install", "--dry-run"],
        { encoding: "utf8", env: { ...process.env, CODEX_HOME: codexHome } },
      );
      expect(output).toContain(`write ${path.join(destination, filename)} (missing)`);
      expect(output).toContain(`remove ${orphan} (orphaned)`);
      expect(fs.readdirSync(destination)).toEqual([path.basename(orphan)]);
      expect(fs.readFileSync(orphan, "utf8")).toBe(content);
    } finally {
      fs.rmSync(codexHome, { recursive: true });
    }
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

  test("removes orphaned managed agents and preserves unrelated personal agents", () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-codex-cleanup-"));
    const unrelated = path.join(destination, "personal_reviewer.toml");
    const orphan = path.join(destination, "orphaned_nuthouse_agent.toml");
    fs.writeFileSync(unrelated, "# personal agent\n");
    fs.writeFileSync(orphan, expectedAgentFiles(REPO_ROOT).values().next().value);

    try {
      expect(syncAgents(REPO_ROOT, destination)).toBe(expectedAgentFiles(REPO_ROOT).size);
      expect(fs.existsSync(orphan)).toBe(false);
      expect(fs.readFileSync(unrelated, "utf8")).toBe("# personal agent\n");
      expect(checkAgents(REPO_ROOT, destination)).toEqual([]);
    } finally {
      fs.rmSync(destination, { recursive: true });
    }
  });
});
