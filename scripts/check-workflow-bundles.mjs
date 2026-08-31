import path from "node:path";
import { pathToFileURL } from "node:url";

import { checkWorkflowBundles } from "./workflow-bundles.mjs";

export function checkAllWorkflowBundles(repoRoot = path.resolve(import.meta.dirname, "..")) {
  return checkWorkflowBundles(repoRoot);
}

function main() {
  const problems = checkAllWorkflowBundles();
  if (problems.length > 0) {
    console.error(`Workflow bundle check failed:\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Workflow bundle check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
