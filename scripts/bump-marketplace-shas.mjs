#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MARKETPLACE_PATH = ".claude-plugin/marketplace.json";
const REF = process.env.BUMP_REF ?? "origin/main";

const raw = readFileSync(MARKETPLACE_PATH, "utf8");
const manifest = JSON.parse(raw);

const changes = [];
let touched = false;

for (const plugin of manifest.plugins) {
  if (typeof plugin.source !== "object" || plugin.source.source !== "git-subdir") {
    continue;
  }
  const path = plugin.source.path;
  if (!path) {
    throw new Error(`Plugin ${plugin.name} has git-subdir source without a path`);
  }
  const sha = execSync(`git log -1 --format=%H ${REF} -- ${path}/`, { encoding: "utf8" }).trim();
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(`Invalid sha resolved for ${plugin.name}: ${sha}`);
  }
  const previous = plugin.source.sha;
  if (previous !== sha) {
    changes.push({ plugin: plugin.name, from: previous ?? "(none)", to: sha });
    plugin.source.sha = sha;
    touched = true;
  }
}

if (!touched) {
  console.log(`No sha changes — marketplace.json already up-to-date against ${REF}.`);
  process.exit(0);
}

writeFileSync(MARKETPLACE_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Updated ${changes.length} sha(s) against ${REF}:`);
for (const c of changes) {
  console.log(`  ${c.plugin}: ${c.from.slice(0, 12)} → ${c.to.slice(0, 12)}`);
}
console.log(`\nReview the diff and commit: ${MARKETPLACE_PATH}`);
