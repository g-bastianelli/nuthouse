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

const RUNTIMES = [
  {
    name: "Claude",
    manifest: ".claude-plugin/plugin.json",
    registry: ".claude-plugin/marketplace.json",
  },
  {
    name: "Codex",
    manifest: ".codex-plugin/plugin.json",
    registry: ".agents/plugins/marketplace.json",
  },
];

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
    const value = JSON.parse(fs.readFileSync(path.join(repoRoot, filename), "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      problems.push(`${filename}: expected JSON object`);
      return undefined;
    }
    return value;
  } catch (error) {
    problems.push(`${filename}: invalid JSON (${error instanceof Error ? error.message : error})`);
    return undefined;
  }
}

// Discover install units from manifests, so an omitted registry entry cannot hide itself.
function checkRegistries(repoRoot, problems) {
  const plugins = new Map();
  for (const entry of fs.readdirSync(repoRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const manifests = new Map();
    for (const runtime of RUNTIMES) {
      const filename = `${entry.name}/${runtime.manifest}`;
      if (!fs.existsSync(path.join(repoRoot, filename))) continue;
      const manifest = readJson(repoRoot, filename, problems);
      if (!manifest) continue;
      manifests.set(runtime.name, manifest);
      if (typeof manifest.name !== "string" || !manifest.name)
        problems.push(`${filename}: missing name`);
      if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version)))
        problems.push(`${filename}: version is not semver (${manifest.version})`);
    }
    if (manifests.size) plugins.set(path.resolve(repoRoot, entry.name), manifests);
  }

  for (const runtime of RUNTIMES) {
    const registry = readJson(repoRoot, runtime.registry, problems);
    if (!registry) continue;
    if (!Array.isArray(registry.plugins)) {
      problems.push(`${runtime.registry}: plugins must be an array`);
      continue;
    }
    const registered = new Set();
    const names = new Set();
    for (const entry of registry.plugins) {
      if (!entry || typeof entry.name !== "string" || !entry.name) {
        problems.push(`${runtime.registry}: plugin entry has no name`);
        continue;
      }
      if (names.has(entry.name))
        problems.push(`${runtime.registry}: duplicate plugin name ${entry.name}`);
      names.add(entry.name);
      const sourcePath = typeof entry.source === "string" ? entry.source : entry.source?.path;
      const target =
        typeof sourcePath === "string" ? path.resolve(repoRoot, sourcePath) : undefined;
      const manifests = plugins.get(target);
      const manifest =
        manifests?.get(runtime.name) ??
        (runtime.name === "Claude" ? manifests?.get("Codex") : undefined);
      if (!manifest) {
        problems.push(
          `${entry.name}: ${runtime.name} registry path ${sourcePath} has no matching plugin manifest`,
        );
      } else if (entry.name !== manifest.name) {
        problems.push(
          `${runtime.registry}: ${entry.name} does not match manifest name ${manifest.name}`,
        );
      } else {
        registered.add(target);
      }
    }
    for (const [target, manifests] of plugins) {
      if ((runtime.name === "Claude" || manifests.has(runtime.name)) && !registered.has(target)) {
        problems.push(`${path.basename(target)}: missing ${runtime.name} registry entry`);
      }
    }
  }

  for (const [target, manifests] of plugins) {
    const claude = manifests.get("Claude");
    const codex = manifests.get("Codex");
    if (!claude || !codex) continue;
    if (claude.name !== codex.name)
      problems.push(`${path.basename(target)}: Claude/Codex manifest names differ`);
    if (claude.version !== codex.version)
      problems.push(
        `${path.basename(target)}: Claude/Codex versions differ (${claude.version} != ${codex.version})`,
      );
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

  const maestroFiles = filesBelow(repoRoot, "monkey-maestro").filter((filename) =>
    SOURCE_EXTENSIONS.has(path.extname(filename)),
  );

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

    // Linear stays the only scheduling truth, so Maestro scripts never persist local state.
    if (
      filename.endsWith(".mjs") &&
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

  checkRegistries(repoRoot, problems);

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
