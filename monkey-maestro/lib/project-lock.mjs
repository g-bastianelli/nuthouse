import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function lockPath(directory, projectId) {
  const key = createHash("sha256").update(String(projectId)).digest("hex").slice(0, 24);
  return path.join(directory, `project-${key}.lock`);
}

function ownerPath(directory, projectId) {
  return path.join(lockPath(directory, projectId), "owner.json");
}

function transitionPath(directory, projectId) {
  return `${lockPath(directory, projectId)}.transition`;
}

function readOwner(directory, projectId) {
  try {
    return JSON.parse(fs.readFileSync(ownerPath(directory, projectId), "utf8"));
  } catch {
    return undefined;
  }
}

function removeExactLock(directory, projectId) {
  const target = lockPath(directory, projectId);
  try {
    fs.unlinkSync(path.join(target, "owner.json"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  fs.rmdirSync(target);
}

function acquireTransition(directory, projectId) {
  const target = transitionPath(directory, projectId);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
    return { acquired: true, path: target };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return { acquired: false, path: target };
  }
}

function releaseTransition(transition) {
  fs.rmdirSync(transition.path);
}

export function acquireProjectLock({
  directory,
  projectId,
  runId,
  terminalId,
  now = new Date().toISOString(),
  processId = process.pid,
}) {
  if (!directory || !projectId || !runId)
    throw new Error("directory, projectId, and runId are required");
  fs.mkdirSync(directory, { recursive: true });
  const transition = acquireTransition(directory, projectId);
  if (!transition.acquired) {
    return {
      acquired: false,
      reason: "LOCK_TRANSITION",
      path: lockPath(directory, projectId),
      transitionPath: transition.path,
    };
  }
  const target = lockPath(directory, projectId);
  try {
    try {
      fs.mkdirSync(target);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      return {
        acquired: false,
        reason: "LOCK_HELD",
        path: target,
        owner: readOwner(directory, projectId),
      };
    }

    const token = randomUUID();
    const owner = {
      schemaVersion: 1,
      projectId,
      runId,
      token,
      processId,
      acquiredAt: now,
      ...(terminalId ? { terminalId } : {}),
    };
    try {
      fs.writeFileSync(path.join(target, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      try {
        fs.rmdirSync(target);
      } catch {}
      throw error;
    }
    return { acquired: true, directory, projectId, path: target, token, owner };
  } finally {
    releaseTransition(transition);
  }
}

export function inspectProjectLock({
  directory,
  projectId,
  now = new Date().toISOString(),
  staleAfterMs = 15 * 60 * 1000,
}) {
  const target = lockPath(directory, projectId);
  const transitioning = fs.existsSync(transitionPath(directory, projectId));
  if (!fs.existsSync(target)) return { held: false, path: target, transitioning };
  const owner = readOwner(directory, projectId);
  const acquiredAt = owner?.acquiredAt ? Date.parse(owner.acquiredAt) : Number.NaN;
  const ageMs = Number.isNaN(acquiredAt) ? undefined : Math.max(0, Date.parse(now) - acquiredAt);
  return {
    held: true,
    path: target,
    transitioning,
    owner,
    ...(ageMs === undefined ? {} : { ageMs }),
    staleCandidate: ageMs === undefined || ageMs >= staleAfterMs,
  };
}

export function releaseProjectLock(handle, { onValidated } = {}) {
  if (!handle?.directory || !handle.projectId || !handle.token) {
    return { released: false, reason: "INVALID_HANDLE" };
  }
  const transition = acquireTransition(handle.directory, handle.projectId);
  if (!transition.acquired) return { released: false, reason: "LOCK_TRANSITION" };
  try {
    const owner = readOwner(handle.directory, handle.projectId);
    if (!owner) return { released: false, reason: "LOCK_MISSING_OR_UNREADABLE" };
    if (owner.token !== handle.token) return { released: false, reason: "TOKEN_MISMATCH" };
    onValidated?.();
    removeExactLock(handle.directory, handle.projectId);
    return { released: true };
  } finally {
    releaseTransition(transition);
  }
}

export function recoverProjectLock({
  directory,
  projectId,
  expectedToken,
  ownerTerminalExists,
  now = new Date().toISOString(),
  staleAfterMs = 15 * 60 * 1000,
}) {
  const transition = acquireTransition(directory, projectId);
  if (!transition.acquired) return { recovered: false, reason: "LOCK_TRANSITION" };
  try {
    const inspection = inspectProjectLock({ directory, projectId, now, staleAfterMs });
    const owner = inspection.owner;
    if (!owner) return { recovered: false, reason: "LOCK_MISSING_OR_UNREADABLE" };
    if (owner.token !== expectedToken) return { recovered: false, reason: "TOKEN_MISMATCH" };
    if (!inspection.staleCandidate) return { recovered: false, reason: "LOCK_NOT_STALE" };
    if (ownerTerminalExists !== false) {
      return { recovered: false, reason: "OWNER_STILL_EXISTS" };
    }
    removeExactLock(directory, projectId);
    return { recovered: true };
  } finally {
    releaseTransition(transition);
  }
}
