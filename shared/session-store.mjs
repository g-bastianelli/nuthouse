import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Keys whose freshness depends on git HEAD sha — tracked separately in _meta._shas
// so a later merge (e.g. write-spec writing handoff_spec) does not clobber the sha
// that was recorded when these keys were first written (by greet / react-monkey:implement).
const SHA_TRACKED_KEYS = new Set(["relevant_files", "react-monkey.explorer_report"]);

export function storePath(sessionId, projectRoot) {
  // path.basename strips any accidental path separators in the session id.
  return path.join(
    projectRoot,
    ".claude",
    "nuthouse",
    "sessions",
    `${path.basename(sessionId)}.json`,
  );
}

function getHeadSha(projectRoot) {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function atomicWriteJson(filePath, value) {
  ensureParent(filePath);
  const tmp = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw err;
  }
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof out[k] === "object" &&
      out[k] !== null
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Collect dotted key paths from a patch that appear in the given tracked-keys set.
function shaTrackedInPatch(patch, trackedKeys, prefix = "") {
  const found = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === "_meta") continue;
    const full = prefix ? `${prefix}.${k}` : k;
    if (trackedKeys.has(full)) found.push(full);
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      found.push(...shaTrackedInPatch(v, trackedKeys, full));
    }
  }
  return found;
}

/**
 * Read the session store for the given session.
 * Returns null when sessionId is falsy, the file is absent, or the JSON is corrupt.
 */
export function read(sessionId, projectRoot) {
  if (!sessionId) return null;
  try {
    return JSON.parse(fs.readFileSync(storePath(sessionId, projectRoot), "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return null;
    throw err;
  }
}

/**
 * Write a full session record (replacing the existing file).
 * Injects / updates _meta automatically.
 * No-op when sessionId is falsy.
 *
 * Note: git_sha reflects the sha at the time of this write, not the sha at which
 * each individual key was populated. Per-key population shas live in _meta._shas
 * and are managed by merge() — write() preserves them verbatim from the incoming data.
 */
export function write(sessionId, projectRoot, data) {
  if (!sessionId) return;
  const sha = getHeadSha(projectRoot);
  const { _meta: existingMeta = {}, ...rest } = data;
  const record = {
    ...rest,
    _meta: {
      ...existingMeta,
      session_id: sessionId,
      git_sha: sha ?? "",
      written_at: new Date().toISOString(),
    },
  };
  atomicWriteJson(storePath(sessionId, projectRoot), record);
}

/**
 * Deep-merge patch into the existing session and write back.
 * Per-key sha tracking: keys in SHA_TRACKED_KEYS (plus any extra keys in
 * options.shasKeys) get their own _meta._shas entry so that a later merge
 * that does NOT include those keys preserves their original sha.
 *
 * @param {object} [options]
 * @param {string[]} [options.shasKeys] - Additional dotted keys to sha-track beyond SHA_TRACKED_KEYS.
 *
 * Returns the resulting session (or patch when sessionId is falsy).
 */
export function merge(sessionId, projectRoot, patch, options = {}) {
  if (!sessionId) return patch;

  const { shasKeys = [] } = options;
  const trackedKeys =
    shasKeys.length > 0 ? new Set([...SHA_TRACKED_KEYS, ...shasKeys]) : SHA_TRACKED_KEYS;

  const sha = getHeadSha(projectRoot);
  const now = new Date().toISOString();
  const existing = read(sessionId, projectRoot) ?? {};

  const { _meta: _ignoredPatchMeta, ...patchData } = patch;
  const merged = deepMerge(existing, patchData);

  const prevShas = existing._meta?._shas ?? {};
  const newShas = { ...prevShas };
  for (const k of shaTrackedInPatch(patchData, trackedKeys)) {
    newShas[k] = sha ?? "";
  }

  merged._meta = {
    ...existing._meta,
    session_id: sessionId,
    git_sha: sha ?? "",
    written_at: now,
    _shas: newShas,
  };

  atomicWriteJson(storePath(sessionId, projectRoot), merged);
  return merged;
}

/**
 * Returns true when the named key should be re-fetched.
 *
 * @param {object|null} session  - Full parsed session (already read).
 * @param {string}      key      - Field name within namespace (or top-level key when namespace is null).
 * @param {string|null} namespace - Plugin namespace, e.g. 'acid-prophet', or null for common keys.
 * @param {string}      projectRoot - Needed for file-existence and git-sha checks.
 */
export function isStale(session, key, namespace, projectRoot) {
  if (!session) return true;

  const fileGone = (p) => Boolean(p) && !fs.existsSync(p);

  const shaChanged = (shasKey) => {
    const stored = session._meta?._shas?.[shasKey] ?? session._meta?.git_sha;
    if (!stored) return true;
    const current = getHeadSha(projectRoot);
    return current === null || current !== stored;
  };

  if (!namespace) {
    switch (key) {
      case "spec_path":
        return fileGone(session.spec_path);
      case "relevant_files":
        return shaChanged("relevant_files");
      default:
        return false;
    }
  }

  switch (`${namespace}.${key}`) {
    case "linear-devotee.issue":
      return true;
    case "linear-devotee.plan_path":
      return fileGone(session["linear-devotee"]?.plan_path);
    case "acid-prophet.handoff_spec": {
      const storedPath = session["acid-prophet"]?._handoff_spec_path;
      return storedPath !== session.spec_path;
    }
    case "react-monkey.explorer_report":
      return shaChanged("react-monkey.explorer_report");
    default:
      return false;
  }
}

/**
 * Remove a key (or namespace.key) from the session file.
 * No-op when sessionId is falsy or the session file does not exist.
 */
export function invalidate(sessionId, projectRoot, key, namespace) {
  if (!sessionId) return;
  const session = read(sessionId, projectRoot);
  if (!session) return;

  let patched;
  if (namespace) {
    if (!session[namespace]) return;
    const ns = { ...session[namespace] };
    delete ns[key];
    patched = { ...session, [namespace]: ns };
  } else {
    patched = { ...session };
    delete patched[key];
  }

  write(sessionId, projectRoot, patched);
}
