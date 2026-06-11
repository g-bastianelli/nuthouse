#!/usr/bin/env node
// Bumps the patch version of every git-subdir plugin whose content changed
// since its marketplace sha pin. A content change without a version bump is
// invisible to existing installs: Claude Code keys the plugin cache by
// version (`cache/<marketplace>/<plugin>/<version>/`), so update and even
// reinstall reuse the stale directory. See _adr/0004.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";
const MANIFEST_FILES = [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"];

export function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Not a MAJOR.MINOR.PATCH version: "${version}"`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

export function decideBump({ changed, pinnedVersion, currentVersion }) {
  if (!changed) {
    return { action: "skip", reason: "unchanged" };
  }
  if (pinnedVersion !== currentVersion) {
    return { action: "skip", reason: "already-bumped" };
  }
  return { action: "bump", nextVersion: bumpPatch(currentVersion) };
}

export function planBumps(manifest, { isChanged, readCurrentVersion, readPinnedVersion }) {
  const plan = [];
  for (const plugin of manifest.plugins) {
    if (typeof plugin.source !== "object" || plugin.source.source !== "git-subdir") {
      continue;
    }
    const { path, sha } = plugin.source;
    const currentVersion = readCurrentVersion(path);
    const decision = decideBump({
      changed: isChanged(path, sha),
      pinnedVersion: readPinnedVersion(path, sha),
      currentVersion,
    });
    if (decision.action === "bump") {
      plan.push({ name: plugin.name, path, from: currentVersion, to: decision.nextVersion });
    }
  }
  return plan;
}

function git(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ref = process.env.BUMP_REF ?? "HEAD";
  const manifest = JSON.parse(readFileSync(MARKETPLACE_PATH, "utf8"));

  const plan = planBumps(manifest, {
    isChanged: (path, sha) => {
      if (git(`git status --porcelain -- ${path}/`) !== "") {
        return true;
      }
      return git(`git log -1 --format=%H ${ref} -- ${path}/`) !== sha;
    },
    readCurrentVersion: (path) => {
      const json = JSON.parse(readFileSync(`${path}/.claude-plugin/plugin.json`, "utf8"));
      return json.version;
    },
    readPinnedVersion: (path, sha) => {
      if (!sha) {
        return null;
      }
      try {
        return JSON.parse(git(`git show ${sha}:${path}/.claude-plugin/plugin.json`)).version;
      } catch {
        return null;
      }
    },
  });

  if (plan.length === 0) {
    console.log("No version bumps needed — every changed plugin is already bumped or untouched.");
    return;
  }

  for (const { name, path, from, to } of plan) {
    console.log(`  ${name}: ${from} → ${to}${dryRun ? " (dry-run)" : ""}`);
    if (dryRun) {
      continue;
    }
    for (const manifestFile of MANIFEST_FILES) {
      const filePath = `${path}/${manifestFile}`;
      if (!existsSync(filePath)) {
        continue;
      }
      const json = JSON.parse(readFileSync(filePath, "utf8"));
      json.version = to;
      writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
    }
  }

  if (!dryRun) {
    console.log(
      `\nBumped ${plan.length} plugin(s). Review the diff, commit, merge, then run: bun run bump:shas`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
