import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_MIRRORS = [
  "capability-resolver.mjs",
  "classification.mjs",
  "configuration.mjs",
  "policy-resolution.mjs",
  "risk-evaluator.mjs",
  "worktree-overrides.mjs",
  "index.mjs",
].map((filename) => ({
  source: `_shared/workflow/src/${filename}`,
  mirror: `warden/lib/workflow/${filename}`,
}));

const REQUIRED_PATHS = [
  ...WORKFLOW_MIRRORS.flatMap(({ source, mirror }) => [source, mirror]),
  "linear-devotee/agents/project-graph-loader.md",
  "linear-devotee/lib/project-graph.mjs",
  "linear-devotee/scripts/project-graph.mjs",
  "monkey-maestro/agents/project-snapshot-loader.md",
  "monkey-maestro/agents/runtime-inspector.md",
  "monkey-maestro/claudecode/hooks/intercept-branch.mjs",
  "monkey-maestro/hooks/hooks.json",
  "monkey-maestro/lib/project-lock.mjs",
  "monkey-maestro/lib/reconciliation-state.mjs",
  "monkey-maestro/lib/records.mjs",
  "monkey-maestro/skills/reconcile/SKILL.md",
  "monkey-maestro/skills/spawn/SKILL.md",
  "monkey-maestro/skills/start/SKILL.md",
  "monkey-maestro/skills/stop/SKILL.md",
];

const FORBIDDEN_PATHS = [
  "git-gremlin/claudecode/hooks/branch-detect.mjs",
  "git-gremlin/claudecode/hooks/intercept-branch.mjs",
  "git-gremlin/hooks/hooks.json",
  "git-gremlin/skills/spawn/SKILL.md",
  "monkey-maestro/agents/queue-scout.md",
  "monkey-maestro/shared/pipeline-contract.md",
  "monkey-maestro/skills/advance/SKILL.md",
  "monkey-maestro/skills/halt/SKILL.md",
  "monkey-maestro/skills/run/SKILL.md",
];

const PRODUCTION_ROOTS = [
  "CLAUDE.md",
  "README.md",
  "git-gremlin",
  "linear-devotee",
  "monkey-maestro",
  "moon-moth",
];

const SOURCE_EXTENSIONS = new Set([".json", ".md", ".mjs", ".yaml", ".yml"]);
const EXCLUDED_SEGMENTS = new Set(["assets", "tests"]);
const EXCLUDED_FILES = new Set([
  "scripts/check-workflow-migration.mjs",
  "monkey-maestro/shared/agent-runtime-map.md",
]);

const LEGACY_PATTERNS = [
  ["legacy git spawn", /git-gremlin:spawn/],
  ["legacy git spawn kill switch", /GIT_GREMLIN_SPAWN_DISABLE/],
  ["legacy Maestro run skill", /monkey-maestro:run(?=[\s`<]|$)/],
  ["legacy Maestro advance skill", /monkey-maestro:advance(?=[\s`<]|$)/],
  ["legacy Maestro halt skill", /monkey-maestro:halt(?=[\s`<]|$)/],
  ["legacy Maestro queue scout", /monkey-maestro:queue-scout/],
  ["legacy local relay path", /(?:\.git\/)?nuthouse\/relays/],
  ["legacy local relay flag", /autopilot\.json/],
];

function filesBelow(root, relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [relativePath];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || EXCLUDED_SEGMENTS.has(entry.name)) return [];
    return filesBelow(root, path.posix.join(relativePath, entry.name));
  });
}

function sourceFiles(repoRoot) {
  return PRODUCTION_ROOTS.flatMap((entry) => filesBelow(repoRoot, entry))
    .filter((filename) => SOURCE_EXTENSIONS.has(path.extname(filename)))
    .filter((filename) => !EXCLUDED_FILES.has(filename));
}

function readJson(repoRoot, filename, problems) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, filename), "utf8"));
  } catch (error) {
    problems.push(`${filename}: invalid JSON (${error instanceof Error ? error.message : error})`);
    return undefined;
  }
}

function checkManifestPair(repoRoot, plugin, problems) {
  const claudePath = `${plugin}/.claude-plugin/plugin.json`;
  const codexPath = `${plugin}/.codex-plugin/plugin.json`;
  const claude = readJson(repoRoot, claudePath, problems);
  const codex = readJson(repoRoot, codexPath, problems);
  if (!claude || !codex) return;
  if (claude.version !== codex.version) {
    problems.push(
      `${plugin}: Claude/Codex versions differ (${claude.version} != ${codex.version})`,
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(String(claude.version))) {
    problems.push(`${plugin}: version is not semver (${claude.version})`);
  }
}

function allowedOrchestrateReference(context, section) {
  return (
    section === "Never" ||
    /\b(?:never|no|not|without|outside|independent|does not|do not|neither)\b/i.test(context)
  );
}

export function checkWorkflowMigration(repoRoot) {
  const problems = [];

  for (const filename of REQUIRED_PATHS) {
    if (!fs.existsSync(path.join(repoRoot, filename)))
      problems.push(`missing required ${filename}`);
  }
  for (const filename of FORBIDDEN_PATHS) {
    if (fs.existsSync(path.join(repoRoot, filename)))
      problems.push(`legacy path remains ${filename}`);
  }

  for (const { source, mirror } of WORKFLOW_MIRRORS) {
    const sourcePath = path.join(repoRoot, source);
    const mirrorPath = path.join(repoRoot, mirror);
    if (!fs.existsSync(sourcePath) || !fs.existsSync(mirrorPath)) continue;
    if (!fs.readFileSync(sourcePath).equals(fs.readFileSync(mirrorPath))) {
      problems.push(`stale workflow mirror ${mirror} (differs from ${source})`);
    }
  }

  for (const filename of sourceFiles(repoRoot)) {
    const body = fs.readFileSync(path.join(repoRoot, filename), "utf8");
    for (const [label, pattern] of LEGACY_PATTERNS) {
      if (pattern.test(body)) problems.push(`${filename}: contains ${label}`);
    }
  }

  const maestroFiles = filesBelow(repoRoot, "monkey-maestro")
    .filter((filename) => SOURCE_EXTENSIONS.has(path.extname(filename)))
    .filter((filename) => !filename.includes("/tests/"));
  for (const filename of maestroFiles) {
    const body = fs.readFileSync(path.join(repoRoot, filename), "utf8");
    const lines = body.split("\n");
    let section = "";
    lines.forEach((line, index) => {
      const heading = line.match(/^##+\s+(.+)$/);
      if (heading) section = heading[1];
      const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");
      if (line.includes("superset-orchestrate") && !allowedOrchestrateReference(context, section)) {
        problems.push(`${filename}:${index + 1}: positive superset-orchestrate dependency`);
      }
    });

    if (
      filename.endsWith(".mjs") &&
      filename !== "monkey-maestro/lib/project-lock.mjs" &&
      /\b(?:writeFileSync|mkdirSync|renameSync|unlinkSync|rmdirSync|rmSync)\b/.test(body)
    ) {
      problems.push(`${filename}: unexpected durable local-state mutation`);
    }
    for (const match of body.matchAll(/CLAUDE_PLUGIN_DATA[^\n]*/g)) {
      if (!match[0].includes("/locks")) {
        problems.push(`${filename}: local plugin data used outside the ephemeral lock namespace`);
      }
    }
  }

  const hook = fs.existsSync(path.join(repoRoot, "monkey-maestro/hooks/hooks.json"))
    ? fs.readFileSync(path.join(repoRoot, "monkey-maestro/hooks/hooks.json"), "utf8")
    : "";
  if (!hook.includes("claudecode/hooks/intercept-branch.mjs")) {
    problems.push("Monkey Maestro branch hook is not registered");
  }
  const interceptor = fs.existsSync(
    path.join(repoRoot, "monkey-maestro/claudecode/hooks/intercept-branch.mjs"),
  )
    ? fs.readFileSync(
        path.join(repoRoot, "monkey-maestro/claudecode/hooks/intercept-branch.mjs"),
        "utf8",
      )
    : "";
  if (!interceptor.includes("monkey-maestro:spawn")) {
    problems.push("Monkey Maestro branch guard does not route to monkey-maestro:spawn");
  }
  if (!interceptor.includes("MONKEY_MAESTRO_SPAWN_DISABLE")) {
    problems.push("Monkey Maestro branch guard does not expose its owned kill switch");
  }

  const greetPath = path.join(repoRoot, "linear-devotee/skills/greet/SKILL.md");
  const greet = fs.existsSync(greetPath) ? fs.readFileSync(greetPath, "utf8") : "";
  if (!greet.includes("sole owner of this transition")) {
    problems.push("linear-devotee:greet does not declare sole In Progress ownership");
  }

  for (const plugin of ["git-gremlin", "linear-devotee", "monkey-maestro", "moon-moth", "warden"]) {
    checkManifestPair(repoRoot, plugin, problems);
  }

  const maestroManifest = readJson(repoRoot, "monkey-maestro/.claude-plugin/plugin.json", problems);
  const expectedMaestroAgents = [
    "./agents/project-snapshot-loader.md",
    "./agents/runtime-inspector.md",
  ];
  if (JSON.stringify(maestroManifest?.agents) !== JSON.stringify(expectedMaestroAgents)) {
    problems.push("Monkey Maestro manifest agent inventory is not the reconciler inventory");
  }

  const linearManifest = readJson(repoRoot, "linear-devotee/.claude-plugin/plugin.json", problems);
  if (!linearManifest?.agents?.includes("./agents/project-graph-loader.md")) {
    problems.push("Linear Devotee manifest omits project-graph-loader");
  }

  return [...new Set(problems)].sort();
}

function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const problems = checkWorkflowMigration(repoRoot);
  if (problems.length > 0) {
    console.error(`Workflow migration check failed:\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Workflow migration check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
