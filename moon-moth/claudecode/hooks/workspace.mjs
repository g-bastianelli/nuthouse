import fs from "node:fs";
import path from "node:path";

const WORKSPACE_DIRECTORIES = [[".moon"], [".config", "moon"]];
const WORKSPACE_EXTENSIONS = ["json", "jsonc", "hcl", "pkl", "toml", "yml", "yaml"];

function isFile(filename) {
  try {
    return fs.statSync(filename).isFile();
  } catch {
    return false;
  }
}

function hasWorkspaceConfig(directory) {
  return WORKSPACE_DIRECTORIES.some((configDirectory) =>
    WORKSPACE_EXTENSIONS.some((extension) =>
      isFile(path.join(directory, ...configDirectory, `workspace.${extension}`)),
    ),
  );
}

/** Walk up from `start` to find the nearest configured moon workspace. */
export function findMoonRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  while (true) {
    if (hasWorkspaceConfig(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
