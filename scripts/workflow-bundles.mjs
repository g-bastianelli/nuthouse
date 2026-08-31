import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const WORKFLOW_BUNDLE_SCHEMA_VERSION = 1;
export const PARTICIPATING_WORKFLOW_PLUGINS = Object.freeze([
  "acid-prophet",
  "linear-devotee",
  "moon-moth",
  "git-gremlin",
  "monkey-maestro",
  "warden",
]);

const METADATA_FILENAME = "bundle.json";
let temporaryFileSequence = 0;

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function filesBelow(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() || entry.isSymbolicLink())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

function relativePosix(root, filename) {
  return path.relative(root, filename).split(path.sep).join(path.posix.sep);
}

function canonicalFilesBelow(root, destinationPrefix, extension) {
  return filesBelow(root)
    .filter((filename) => path.extname(filename) === extension)
    .map((filename) => {
      if (!fs.lstatSync(filename).isFile()) {
        throw new Error(`Canonical workflow entries must be regular files: ${filename}`);
      }
      return {
        path: path.posix.join(destinationPrefix, relativePosix(root, filename)),
        content: fs.readFileSync(filename),
      };
    });
}

export function canonicalWorkflowEntries(repoRoot) {
  const workflowRoot = path.join(repoRoot, "_shared", "workflow");
  const readmePath = path.join(workflowRoot, "README.md");
  if (!fs.existsSync(readmePath)) {
    throw new Error("Canonical workflow README is missing: _shared/workflow/README.md");
  }

  const sources = canonicalFilesBelow(path.join(workflowRoot, "src"), "", ".mjs");
  const fixtures = canonicalFilesBelow(path.join(workflowRoot, "fixtures"), "fixtures", ".json");
  if (sources.length === 0) throw new Error("Canonical workflow source inventory is empty.");
  if (fixtures.length === 0) throw new Error("Canonical workflow fixture inventory is empty.");

  return [
    ...sources,
    ...fixtures,
    { path: "README.md", content: fs.readFileSync(readmePath) },
  ].sort((left, right) => left.path.localeCompare(right.path));
}

export function computeWorkflowSourceHash(entries) {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    const pathBytes = Buffer.from(entry.path, "utf8");
    const content = Buffer.from(entry.content);
    hash.update(String(pathBytes.length));
    hash.update(":");
    hash.update(pathBytes);
    hash.update("\0");
    hash.update(String(content.length));
    hash.update(":");
    hash.update(content);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function bundleMetadata(entries, sourceHash) {
  return {
    schemaVersion: WORKFLOW_BUNDLE_SCHEMA_VERSION,
    sourceHash,
    files: entries.map((entry) => ({ path: entry.path, hash: sha256(entry.content) })),
  };
}

function serializeMetadata(metadata) {
  return Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function atomicWrite(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  temporaryFileSequence += 1;
  const temporaryPath = `${filePath}.${process.pid}.${temporaryFileSequence}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o644);
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }
}

function removeEmptyDirectories(root, current = root) {
  if (!fs.existsSync(current)) return;
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(root, path.join(current, entry.name));
  }
  if (current !== root && fs.readdirSync(current).length === 0) fs.rmdirSync(current);
}

function removeObsoleteFiles(bundleRoot, expectedPaths) {
  for (const filename of filesBelow(bundleRoot)) {
    const relative = relativePosix(bundleRoot, filename);
    if (!expectedPaths.has(relative)) fs.unlinkSync(filename);
  }
  removeEmptyDirectories(bundleRoot);
}

function normalizedPlugins(value) {
  const plugins = value ?? PARTICIPATING_WORKFLOW_PLUGINS;
  if (
    !Array.isArray(plugins) ||
    plugins.length === 0 ||
    plugins.some(
      (plugin) => typeof plugin !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(plugin),
    ) ||
    new Set(plugins).size !== plugins.length
  ) {
    throw new TypeError("plugins must contain unique lowercase kebab-case plugin names.");
  }
  return [...plugins];
}

export function buildWorkflowBundles(repoRoot, options = {}) {
  const plugins = normalizedPlugins(options.plugins);
  const entries = canonicalWorkflowEntries(repoRoot);
  const sourceHash = computeWorkflowSourceHash(entries);
  const metadata = bundleMetadata(entries, sourceHash);
  const metadataContent = serializeMetadata(metadata);
  const expectedPaths = new Set([...entries.map((entry) => entry.path), METADATA_FILENAME]);

  for (const plugin of plugins) {
    const bundleRoot = path.join(repoRoot, plugin, "lib", "workflow");
    for (const entry of entries) {
      atomicWrite(path.join(bundleRoot, ...entry.path.split("/")), entry.content);
    }
    removeObsoleteFiles(bundleRoot, expectedPaths);
    atomicWrite(path.join(bundleRoot, METADATA_FILENAME), metadataContent);
  }

  return { plugins, sourceHash, files: metadata.files };
}

function readMetadata(filename) {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8"));
  } catch {
    return null;
  }
}

function importSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}

function forbiddenRuntimeImport(filename, source) {
  for (const specifier of importSpecifiers(source)) {
    const segments = specifier.split(/[\\/]/);
    if (segments.includes("_shared")) return specifier;
    if (path.isAbsolute(specifier)) return specifier;
    if (specifier.startsWith(".")) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier));
      if (target === ".." || target.startsWith("../")) return specifier;
      continue;
    }
    if (!specifier.startsWith("node:")) return specifier;
  }
  return null;
}

export function checkWorkflowBundles(repoRoot, options = {}) {
  const plugins = normalizedPlugins(options.plugins);
  const entries = canonicalWorkflowEntries(repoRoot);
  const sourceHash = computeWorkflowSourceHash(entries);
  const expectedMetadata = bundleMetadata(entries, sourceHash);
  const expectedPaths = new Set([...entries.map((entry) => entry.path), METADATA_FILENAME]);
  const problems = [];

  for (const plugin of plugins) {
    const bundleRoot = path.join(repoRoot, plugin, "lib", "workflow");
    const metadataPath = path.join(bundleRoot, METADATA_FILENAME);
    const metadata = readMetadata(metadataPath);

    if (metadata === null) {
      problems.push(`${plugin}: missing or invalid bundle metadata ${METADATA_FILENAME}`);
    } else {
      if (metadata.schemaVersion !== WORKFLOW_BUNDLE_SCHEMA_VERSION) {
        problems.push(`${plugin}: invalid bundle metadata schema version`);
      }
      if (metadata.sourceHash !== sourceHash) {
        problems.push(
          `${plugin}: stale source hash (${String(metadata.sourceHash)} != ${sourceHash})`,
        );
      }
      if (JSON.stringify(metadata.files) !== JSON.stringify(expectedMetadata.files)) {
        problems.push(`${plugin}: stale bundle metadata file inventory`);
      }
    }

    for (const entry of entries) {
      const target = path.join(bundleRoot, ...entry.path.split("/"));
      if (!fs.existsSync(target)) {
        problems.push(`${plugin}: missing generated file ${entry.path}`);
        continue;
      }
      if (!fs.lstatSync(target).isFile()) {
        problems.push(`${plugin}: generated file is not regular ${entry.path}`);
        continue;
      }
      const actual = fs.readFileSync(target);
      if (!actual.equals(entry.content)) {
        problems.push(`${plugin}: stale generated file ${entry.path}`);
      }
      if (entry.path.endsWith(".mjs")) {
        const forbidden = forbiddenRuntimeImport(entry.path, actual.toString("utf8"));
        if (forbidden !== null) {
          problems.push(
            `${plugin}: forbidden repository-parent runtime import in ${entry.path}: ${forbidden}`,
          );
        }
      }
    }

    for (const filename of filesBelow(bundleRoot)) {
      const relative = relativePosix(bundleRoot, filename);
      if (!expectedPaths.has(relative))
        problems.push(`${plugin}: extra generated file ${relative}`);
    }
  }

  return [...new Set(problems)].sort();
}
