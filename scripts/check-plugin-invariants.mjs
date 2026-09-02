// Repository gate for invariants a reader cannot see by opening one file.
//
// Scope rule: this gate asserts *properties*, never inventory. It must not require a
// given skill/agent/hook to exist, forbid a retired path, or scan for retired names.
// Nobody installs this marketplace but its author, so a removal only has to be complete
// — it never has to be defended against reintroduction. Gates that freeze the current
// architecture make the next refactor harder than the code it guards.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MANIFEST_PLUGINS = ["git-gremlin", "linear-devotee", "monkey-maestro", "moon-moth", "warden"];

const SOURCE_EXTENSIONS = new Set([".json", ".md", ".mjs", ".yaml", ".yml"]);
const EXCLUDED_SEGMENTS = new Set(["assets", "tests"]);

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

function readJson(repoRoot, filename, problems) {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, filename), "utf8"));
  } catch (error) {
    problems.push(`${filename}: invalid JSON (${error instanceof Error ? error.message : error})`);
    return undefined;
  }
}

// The Claude and Codex manifests are separate files keyed by the same version. Bumping one
// and forgetting the other is invisible on read and silently breaks installed updates
// (see _adr/0004-plugin-version-bump-on-release.md).
function checkManifestPair(repoRoot, plugin, problems) {
  const claude = readJson(repoRoot, `${plugin}/.claude-plugin/plugin.json`, problems);
  const codex = readJson(repoRoot, `${plugin}/.codex-plugin/plugin.json`, problems);
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

export function checkPluginInvariants(repoRoot) {
  const problems = [];

  const maestroFiles = filesBelow(repoRoot, "monkey-maestro")
    .filter((filename) => SOURCE_EXTENSIONS.has(path.extname(filename)))
    .filter((filename) => !filename.includes("/lib/workflow/"));

  for (const filename of maestroFiles) {
    const body = fs.readFileSync(path.join(repoRoot, filename), "utf8");
    const lines = body.split("\n");
    let section = "";

    // Maestro must not grow a positive dependency on the external superset-orchestrate.
    lines.forEach((line, index) => {
      const heading = line.match(/^##+\s+(.+)$/);
      if (heading) section = heading[1];
      const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");
      if (line.includes("superset-orchestrate") && !allowedOrchestrateReference(context, section)) {
        problems.push(`${filename}:${index + 1}: positive superset-orchestrate dependency`);
      }
    });

    // "No private queue or hidden daemon" is a property, not a file list: Linear stays the
    // only scheduling truth, so nothing outside the ephemeral lock may persist local state.
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

  for (const plugin of MANIFEST_PLUGINS) checkManifestPair(repoRoot, plugin, problems);

  return [...new Set(problems)].sort();
}

function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const problems = checkPluginInvariants(repoRoot);
  if (problems.length > 0) {
    console.error(`Plugin invariant check failed:\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Plugin invariant check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
