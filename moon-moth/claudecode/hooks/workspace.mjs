import fs from "node:fs";
import path from "node:path";

/**
 * Walk up from `start` to find the moon workspace root (the dir containing
 * `.moon/`). Returns the root path, or null if not inside a moon workspace.
 */
export function findMoonRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, ".moon"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
