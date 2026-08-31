import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildWorkflowBundles } from "./workflow-bundles.mjs";

export function buildAllWorkflowBundles(repoRoot = path.resolve(import.meta.dirname, "..")) {
  return buildWorkflowBundles(repoRoot);
}

function main() {
  const result = buildAllWorkflowBundles();
  console.log(
    `Built ${result.plugins.length} workflow bundles at canonical source hash ${result.sourceHash}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
