#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TEXT_EXTENSIONS = new Set([".md", ".mdc", ".txt", ".json", ".toml", ".yaml", ".yml"]);

const WALK_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".moon",
]);

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${result.status}): ${result.stderr.trim()}`);
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trimEnd(),
    stderr: result.stderr.trimEnd(),
  };
}

function git(args, options = {}) {
  return run("git", args, options);
}

function gh(args, options = {}) {
  return run("gh", args, { ...options, allowFailure: true });
}

export function parseArgs(argv) {
  const parsed = { format: "markdown", staged: false, base: null, cwd: process.cwd() };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.format = "json";
    else if (arg === "--markdown") parsed.format = "markdown";
    else if (arg === "--staged") parsed.staged = true;
    else if (arg === "--base") {
      parsed.base = argv[index + 1];
      index += 1;
    } else if (arg === "--cwd") {
      parsed.cwd = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    }
  }

  return parsed;
}

export function parseNameStatus(output) {
  if (!output.trim()) return [];

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0];
      if (status.startsWith("R") || status.startsWith("C")) {
        return { status, path: parts[2], previousPath: parts[1] };
      }
      return { status, path: parts[1] };
    });
}

function parseShortStatus(output) {
  if (!output.trim()) return [];

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2),
      path: line.slice(3),
    }));
}

function appendUntrackedFiles(changedFiles, statusEntries) {
  const seen = new Set(changedFiles.map((file) => file.path));
  const merged = [...changedFiles];

  for (const entry of statusEntries) {
    if (entry.status !== "??" || seen.has(entry.path)) continue;
    merged.push({ status: "??", path: entry.path });
    seen.add(entry.path);
  }

  return merged;
}

function hasDiff(cwd, args) {
  const result = git(["diff", "--quiet", ...args], { cwd, allowFailure: true });
  return result.status === 1;
}

function refExists(cwd, ref) {
  if (!ref) return false;
  return git(["rev-parse", "--verify", "--quiet", ref], { cwd, allowFailure: true }).status === 0;
}

function detectBaseRef(cwd) {
  const prBase = gh(["pr", "view", "--json", "baseRefName", "--jq", ".baseRefName"], {
    cwd,
  });
  if (prBase.status === 0 && prBase.stdout) {
    const remoteBase = `origin/${prBase.stdout}`;
    if (refExists(cwd, remoteBase)) return remoteBase;
    if (refExists(cwd, prBase.stdout)) return prBase.stdout;
  }

  const remoteHead = git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], {
    cwd,
    allowFailure: true,
  });
  if (remoteHead.status === 0 && remoteHead.stdout) return remoteHead.stdout;

  for (const candidate of ["origin/main", "main", "origin/master", "master"]) {
    if (refExists(cwd, candidate)) return candidate;
  }

  return null;
}

function detectReviewTarget(cwd, options) {
  const status = parseShortStatus(
    git(["status", "--short", "--untracked-files=all"], { cwd }).stdout,
  );
  const hasDirty = status.length > 0;
  const baseRef = options.base || detectBaseRef(cwd);

  if (options.staged) {
    return {
      kind: "staged",
      baseRef,
      diffArgs: ["--cached"],
      nameStatusArgs: ["diff", "--cached", "--name-status"],
      statArgs: ["diff", "--cached", "--stat"],
      diffCommand: "git diff --cached",
      status,
    };
  }

  if (baseRef && refExists(cwd, baseRef) && hasDiff(cwd, [`${baseRef}...HEAD`])) {
    return {
      kind: "branch",
      baseRef,
      diffArgs: [`${baseRef}...HEAD`],
      nameStatusArgs: ["diff", "--name-status", `${baseRef}...HEAD`],
      statArgs: ["diff", "--stat", `${baseRef}...HEAD`],
      diffCommand: `git diff ${baseRef}...HEAD`,
      status,
      warnings: hasDirty
        ? ["Working tree has local changes not included in the branch diff target."]
        : [],
    };
  }

  if (hasDirty) {
    return {
      kind: "worktree",
      baseRef,
      diffArgs: ["HEAD"],
      nameStatusArgs: ["diff", "--name-status", "HEAD"],
      statArgs: ["diff", "--stat", "HEAD"],
      diffCommand: "git diff HEAD",
      status,
    };
  }

  return {
    kind: "empty",
    baseRef,
    diffArgs: [],
    nameStatusArgs: ["diff", "--name-status"],
    statArgs: ["diff", "--stat"],
    diffCommand: "git diff",
    status,
    warnings: ["No branch, staged, or worktree diff was detected."],
  };
}

function readMaybe(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseFrontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end === -1) return {};

  const result = {};
  const body = text.slice(4, end).split("\n");
  for (const line of body) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    result[match[1]] = value;
  }
  return result;
}

function extractGlobs(filePath) {
  const text = readMaybe(filePath);
  const frontmatter = parseFrontmatter(text);
  const raw = frontmatter.applyTo || frontmatter.globs || frontmatter.paths || "";
  if (!raw) return [];

  return raw
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function globToRegExp(glob) {
  let pattern = glob.trim();
  if (!pattern) return /^$/;
  pattern = pattern.replace(/^\//, "");

  const hasSlash = pattern.includes("/");
  let regex = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "*" && next === "*") {
      regex += ".*";
      index += 1;
    } else if (char === "*") {
      regex += "[^/]*";
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }

  return new RegExp(hasSlash ? `^${regex}$` : `(^|.*/)${regex}$`);
}

function globsMatch(globs, changedFiles) {
  if (globs.length === 0) return [];
  const regexes = globs.map(globToRegExp);
  return changedFiles.filter((file) => regexes.some((regex) => regex.test(file.path)));
}

function walkFiles(root, options = {}) {
  const files = [];
  const maxDepth = options.maxDepth ?? 8;

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (WALK_SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(current, entry.name), depth + 1);
        continue;
      }
      if (entry.isFile()) files.push(path.join(current, entry.name));
    }
  }

  walk(root, 0);
  return files;
}

function sourceType(relativePath, basename) {
  if (basename === "AGENTS.md") return "agents";
  if (basename === "CLAUDE.md" || basename === "CLAUDE.local.md") return "claude";
  if (basename === "CODEX.md") return "codex";
  if (relativePath === ".github/copilot-instructions.md") return "copilot";
  if (relativePath.startsWith(".github/instructions/")) return "copilot-path";
  if (relativePath.startsWith(".cursor/rules/") || basename === ".cursorrules") return "cursor";
  if (relativePath.startsWith(".devin/rules/")) return "devin";
  if (basename === ".windsurfrules") return "windsurf";
  if (relativePath.startsWith(".codex/")) return "codex-rules";
  if (relativePath.startsWith(".agents/")) return "agents-rules";
  return "instruction";
}

function isInstructionCandidate(repoRoot, filePath) {
  const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);
  if (["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md", "CODEX.md"].includes(basename)) return true;
  if ([".cursorrules", ".windsurfrules"].includes(basename)) return true;
  if (relativePath === ".github/copilot-instructions.md") return true;
  if (
    relativePath.startsWith(".github/instructions/") &&
    relativePath.endsWith(".instructions.md")
  ) {
    return true;
  }
  if (relativePath.startsWith(".cursor/rules/")) return TEXT_EXTENSIONS.has(path.extname(filePath));
  if (relativePath.startsWith(".devin/rules/")) return TEXT_EXTENSIONS.has(path.extname(filePath));
  if (relativePath.startsWith(".codex/")) {
    return (
      extension === ".md" ||
      relativePath.startsWith(".codex/rules/") ||
      relativePath.startsWith(".codex/instructions/")
    );
  }
  if (relativePath.startsWith(".agents/")) {
    return (
      extension === ".md" ||
      relativePath.startsWith(".agents/rules/") ||
      relativePath.startsWith(".agents/instructions/")
    );
  }
  return false;
}

function pathScopedMatches(relativePath, changedFiles) {
  const directory = path.dirname(relativePath);
  if (directory === ".") return changedFiles;
  return changedFiles.filter((file) => file.path.startsWith(`${directory}/`));
}

function instructionApplies(repoRoot, filePath, changedFiles) {
  const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
  const basename = path.basename(filePath);
  const globs = extractGlobs(filePath);
  const globMatches = globsMatch(globs, changedFiles);
  if (globs.length > 0) return { applies: globMatches.length > 0, globs, matches: globMatches };

  if (["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md"].includes(basename)) {
    const matches = pathScopedMatches(relativePath, changedFiles);
    return {
      applies: matches.length > 0 || path.dirname(relativePath) === ".",
      globs: [],
      matches,
    };
  }

  return { applies: true, globs: [], matches: changedFiles };
}

function collectInstructionSources(repoRoot, changedFiles) {
  const candidates = walkFiles(repoRoot)
    .filter((filePath) => isInstructionCandidate(repoRoot, filePath))
    .sort((left, right) => left.localeCompare(right));

  return candidates.map((filePath) => {
    const relativePath = path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
    const stats = statSync(filePath);
    const applicability = instructionApplies(repoRoot, filePath, changedFiles);
    return {
      path: relativePath,
      type: sourceType(relativePath, path.basename(filePath)),
      sizeBytes: stats.size,
      large: stats.size > 32768,
      applies: applicability.applies,
      globs: applicability.globs,
      matchedFiles: applicability.matches.map((file) => file.path).slice(0, 8),
    };
  });
}

export function collectReviewContext(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const repoRoot = git(["rev-parse", "--show-toplevel"], { cwd }).stdout;
  const target = detectReviewTarget(cwd, options);
  const nameStatus = git(target.nameStatusArgs, { cwd, allowFailure: true }).stdout;
  const parsedChangedFiles = parseNameStatus(nameStatus);
  const changedFiles =
    target.kind === "worktree"
      ? appendUntrackedFiles(parsedChangedFiles, target.status)
      : parsedChangedFiles;
  const stat = git(target.statArgs, { cwd, allowFailure: true }).stdout;
  const instructions = collectInstructionSources(repoRoot, changedFiles);
  const warnings = [...(target.warnings || [])];

  if (target.status.some((entry) => entry.status === "??")) {
    warnings.push(
      "Untracked files are present; inspect their contents separately from plain git diff.",
    );
  }

  return {
    repoRoot,
    cwd,
    target: {
      kind: target.kind,
      baseRef: target.baseRef,
      diffCommand: target.diffCommand,
    },
    changedFiles,
    dirtyStatus: target.status,
    diffStat: stat,
    instructionSources: instructions,
    warnings,
  };
}

export function formatMarkdown(context) {
  const lines = [];
  lines.push("# Review Context");
  lines.push("");
  lines.push(`Repo: \`${context.repoRoot}\``);
  lines.push(`Target: \`${context.target.kind}\``);
  lines.push(`Diff command: \`${context.target.diffCommand}\``);
  if (context.target.baseRef) lines.push(`Base ref: \`${context.target.baseRef}\``);
  lines.push("");

  lines.push("## Changed Files");
  if (context.changedFiles.length === 0) {
    lines.push("- none detected");
  } else {
    for (const file of context.changedFiles) {
      const previous = file.previousPath ? ` (from \`${file.previousPath}\`)` : "";
      lines.push(`- ${file.status} \`${file.path}\`${previous}`);
    }
  }
  lines.push("");

  lines.push("## Instruction Sources");
  if (context.instructionSources.length === 0) {
    lines.push("- none detected");
  } else {
    for (const source of context.instructionSources) {
      const state = source.applies ? "applies" : "not-applicable";
      const large = source.large ? ", large" : "";
      const globs = source.globs.length ? `, globs: ${source.globs.join(", ")}` : "";
      lines.push(
        `- ${state}: \`${source.path}\` (${source.type}, ${source.sizeBytes} bytes${large}${globs})`,
      );
    }
  }
  lines.push("");

  lines.push("## Diff Stat");
  lines.push(context.diffStat ? `\`\`\`text\n${context.diffStat}\n\`\`\`` : "_none_");
  lines.push("");

  lines.push("## Warnings");
  if (context.warnings.length === 0) {
    lines.push("- none");
  } else {
    for (const warning of context.warnings) lines.push(`- ${warning}`);
  }
  lines.push("");

  lines.push("## Review Passes");
  lines.push("- correctness and behavioral regressions");
  lines.push("- local instruction and convention violations");
  lines.push("- architecture boundaries and dependency direction");
  lines.push("- tests, docs, migrations, and generated artifacts");
  lines.push("- security, privacy, accessibility, and performance when touched");

  return lines.join("\n");
}

function printHelp() {
  console.log(`Usage: node git-gremlin/scripts/review-context.mjs [options]

Options:
  --base <ref>   Review branch diff against an explicit base ref
  --staged       Review staged changes only
  --cwd <path>   Run from another working directory
  --json         Print JSON instead of Markdown
  --markdown     Print Markdown (default)
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const context = collectReviewContext(args);
  if (args.format === "json") {
    console.log(JSON.stringify(context, null, 2));
  } else {
    console.log(formatMarkdown(context));
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
