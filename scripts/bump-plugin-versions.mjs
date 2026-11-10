#!/usr/bin/env node
// Bumps the patch version of every git-subdir plugin whose content changed
// since its marketplace sha pin. A content change without a version bump is
// invisible to existing installs: Claude Code keys the plugin cache by
// version (`cache/<marketplace>/<plugin>/<version>/`), so update and even
// reinstall reuse the stale directory. See _adr/0004.
import { execFileSync } from "node:child_process";
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

const VERSION_KEY = /("version"\s*:\s*")[^"]+(")/;

// Rewrites the version in place instead of re-serializing the parsed object:
// JSON.stringify would expand short inline arrays and fail oxfmt --check.
export function replaceVersion(source, nextVersion) {
  if (!VERSION_KEY.test(source)) {
    throw new Error('No "version" key found in manifest');
  }
  return source.replace(VERSION_KEY, (_match, open, close) => open + nextVersion + close);
}

export function decideBump({ changed, pinnedVersion, currentVersion }) {
  if (!changed) {
    return { action: "skip", reason: "unchanged" };
  }
  if (pinnedVersion === null) {
    return { action: "skip", reason: "new-plugin" };
  }
  if (pinnedVersion !== currentVersion) {
    return { action: "skip", reason: "already-bumped" };
  }
  return { action: "bump", nextVersion: bumpPatch(currentVersion) };
}

export function planRelease(manifest, { isChanged, readCurrentVersion, readPinnedVersion }) {
  const plan = [];
  for (const plugin of manifest.plugins) {
    if (typeof plugin.source !== "object" || plugin.source.source !== "git-subdir") {
      continue;
    }
    const { path, sha } = plugin.source;
    if (!isChanged(path, sha)) continue;
    const currentVersion = readCurrentVersion(path);
    const decision = decideBump({
      changed: true,
      pinnedVersion: readPinnedVersion(path, sha),
      currentVersion,
    });
    plan.push({ name: plugin.name, path, version: currentVersion, ...decision });
  }
  return plan;
}

function git(args, execute = execFileSync) {
  return execute("git", args, { encoding: "utf8" }).trim();
}

export function isPluginChanged(pluginPath, ref, pinnedSha, execute = execFileSync) {
  if (git(["status", "--porcelain", "--", `${pluginPath}/`], execute) !== "") {
    return true;
  }
  const latestSha = git(
    ["log", "-1", "--format=%H", "--end-of-options", ref, "--", `${pluginPath}/`],
    execute,
  );
  return latestSha !== pinnedSha;
}

export function readPinnedPluginVersion(pluginPath, sha, execute = execFileSync) {
  if (!sha) {
    return null;
  }
  try {
    const manifest = git(
      ["show", "--end-of-options", `${sha}:${pluginPath}/.claude-plugin/plugin.json`],
      execute,
    );
    const version = JSON.parse(manifest).version;
    bumpPatch(version); // Validate the published version before deciding whether it changed.
    return version;
  } catch (cause) {
    throw new Error(`Cannot read pinned version for ${pluginPath} at ${sha}`, { cause });
  }
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ref = process.env.BUMP_REF ?? "HEAD";
  const manifest = JSON.parse(readFileSync(MARKETPLACE_PATH, "utf8"));

  const plan = planRelease(manifest, {
    isChanged: (path, sha) => isPluginChanged(path, ref, sha),
    readCurrentVersion: (path) => {
      const json = JSON.parse(readFileSync(`${path}/.claude-plugin/plugin.json`, "utf8"));
      return json.version;
    },
    readPinnedVersion: (path, sha) => readPinnedPluginVersion(path, sha),
  });

  if (plan.length === 0) {
    console.log("Nothing to release — plugin content matches the marketplace pins.");
    return;
  }

  for (const { name, path, version, action, nextVersion, reason } of plan) {
    if (action !== "bump") {
      console.log(`  ${name}@${version}: ${reason}; include in release verification`);
      continue;
    }
    console.log(`  ${name}: ${version} → ${nextVersion}${dryRun ? " (dry-run)" : ""}`);
    if (dryRun) {
      continue;
    }
    for (const manifestFile of MANIFEST_FILES) {
      const filePath = `${path}/${manifestFile}`;
      if (!existsSync(filePath)) {
        continue;
      }
      writeFileSync(filePath, replaceVersion(readFileSync(filePath, "utf8"), nextVersion));
    }
  }

  if (!dryRun) {
    const bumped = plan.filter(({ action }) => action === "bump").length;
    console.log(
      `\nBumped ${bumped} of ${plan.length} release plugin(s). Verify the complete release set, review the diff, commit, merge, then run: bun run bump:shas`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
