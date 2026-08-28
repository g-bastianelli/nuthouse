import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_CONFIG_FILES = [
  "classification.mjs",
  "configuration.mjs",
  "worktree-overrides.mjs",
  "index.mjs",
];

export function buildWorkflowConfig(repoRoot = path.resolve(import.meta.dirname, "..")) {
  const sourceRoot = path.join(repoRoot, "_shared", "workflow", "src");
  const destinationRoot = path.join(repoRoot, "warden", "lib", "workflow");

  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const filename of WORKFLOW_CONFIG_FILES) {
    fs.copyFileSync(path.join(sourceRoot, filename), path.join(destinationRoot, filename));
  }
}

function main() {
  buildWorkflowConfig();
  console.log("Warden workflow configuration bundle built.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
