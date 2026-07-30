#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";
const SHA_PATTERN = /^[a-f0-9]{40}$/;

export function resolvePluginSha(ref, pluginPath, execute = execFileSync) {
  return execute(
    "git",
    ["log", "-1", "--format=%H", "--end-of-options", ref, "--", `${pluginPath}/`],
    { encoding: "utf8" },
  ).trim();
}

export function updateMarketplaceShas(manifest, resolveSha) {
  const changes = [];

  for (const plugin of manifest.plugins) {
    if (typeof plugin.source !== "object" || plugin.source.source !== "git-subdir") {
      continue;
    }
    const path = plugin.source.path;
    if (!path) {
      throw new Error(`Plugin ${plugin.name} has git-subdir source without a path`);
    }
    const sha = resolveSha(path);
    if (!SHA_PATTERN.test(sha)) {
      throw new Error(`Invalid sha resolved for ${plugin.name}: ${sha}`);
    }
    const previous = plugin.source.sha;
    if (previous !== sha) {
      changes.push({ plugin: plugin.name, from: previous ?? "(none)", to: sha });
      plugin.source.sha = sha;
    }
  }

  return changes;
}

function main() {
  const ref = process.env.BUMP_REF ?? "origin/main";
  const raw = readFileSync(MARKETPLACE_PATH, "utf8");
  const manifest = JSON.parse(raw);
  const changes = updateMarketplaceShas(manifest, (pluginPath) =>
    resolvePluginSha(ref, pluginPath),
  );

  if (changes.length === 0) {
    console.log(`No sha changes — marketplace.json already up-to-date against ${ref}.`);
    return;
  }

  writeFileSync(MARKETPLACE_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Updated ${changes.length} sha(s) against ${ref}:`);
  for (const change of changes) {
    console.log(`  ${change.plugin}: ${change.from.slice(0, 12)} → ${change.to.slice(0, 12)}`);
  }
  console.log(`\nReview the diff and commit: ${MARKETPLACE_PATH}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
