import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_LEASE_DURATION_MS = 15 * 60 * 1000;
const LEGACY_OWNER_FILENAME = "owner.json";
const OWNER_PREFIX = "owner-";
const OWNER_SUFFIX = ".json";
const PENDING_OWNER_PREFIX = ".pending-owner-";

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function instant(value, label) {
  const milliseconds = Date.parse(requiredString(value, label));
  if (Number.isNaN(milliseconds)) throw new Error(`${label} must be ISO-8601`);
  return milliseconds;
}

function duration(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function lockPath(directory, projectId) {
  const key = createHash("sha256").update(String(projectId)).digest("hex").slice(0, 24);
  return path.join(directory, `project-${key}.lock`);
}

function legacyTransitionPath(directory, projectId) {
  return `${lockPath(directory, projectId)}.transition`;
}

function ownerFilename(token) {
  const key = createHash("sha256").update(token).digest("hex");
  return `${OWNER_PREFIX}${key}${OWNER_SUFFIX}`;
}

function ownerPath(directory, projectId, token) {
  return path.join(lockPath(directory, projectId), ownerFilename(token));
}

function pendingOwnerPath(directory, projectId, token) {
  return path.join(
    lockPath(directory, projectId),
    `${PENDING_OWNER_PREFIX}${ownerFilename(token)}`,
  );
}

function normalizeOwner(value, expectedProjectId) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  if (value.schemaVersion !== 2) return undefined;
  try {
    const projectId = requiredString(value.projectId, "owner.projectId");
    if (projectId !== expectedProjectId) return undefined;
    const hostId = requiredString(value.hostId, "owner.hostId");
    const token = requiredString(value.token, "owner.token");
    const createdAtMs = instant(value.createdAt, "owner.createdAt");
    const expiresAtMs = instant(value.expiresAt, "owner.expiresAt");
    if (expiresAtMs <= createdAtMs) return undefined;
    return {
      schemaVersion: 2,
      projectId,
      hostId,
      token,
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  } catch {
    return undefined;
  }
}

function parseJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

function readOwnerSnapshot(directory, projectId) {
  const target = lockPath(directory, projectId);
  let entries;
  try {
    entries = fs.readdirSync(target, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return { kind: "missing", path: target };
    throw error;
  }

  const ownerEntries = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.startsWith(OWNER_PREFIX) && entry.name.endsWith(OWNER_SUFFIX),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const legacyEntry = entries.find(
    (entry) => entry.isFile() && entry.name === LEGACY_OWNER_FILENAME,
  );
  const pendingEntries = entries.filter(
    (entry) => entry.isFile() && entry.name.startsWith(PENDING_OWNER_PREFIX),
  );

  if (ownerEntries.length === 1 && legacyEntry === undefined) {
    const filePath = path.join(target, ownerEntries[0].name);
    const raw = parseJsonFile(filePath);
    const owner = normalizeOwner(raw, projectId);
    if (owner && ownerEntries[0].name === ownerFilename(owner.token)) {
      return { kind: "owner", path: target, ownerPath: filePath, owner };
    }
    return { kind: "empty", path: target, recoverablePath: filePath, entries };
  }

  if (ownerEntries.length === 0 && legacyEntry !== undefined) {
    const filePath = path.join(target, LEGACY_OWNER_FILENAME);
    const raw = parseJsonFile(filePath);
    const owner = normalizeOwner(raw, projectId);
    if (owner) return { kind: "owner", path: target, ownerPath: filePath, owner };
    if (
      raw?.schemaVersion === 1 &&
      raw.projectId === projectId &&
      typeof raw.token === "string" &&
      raw.token.length > 0 &&
      typeof raw.acquiredAt === "string" &&
      !Number.isNaN(Date.parse(raw.acquiredAt))
    ) {
      return { kind: "legacy-owner", path: target, ownerPath: filePath, owner: raw };
    }
    return { kind: "empty", path: target, recoverablePath: filePath, entries };
  }

  if (ownerEntries.length === 0 && legacyEntry === undefined && pendingEntries.length === 1) {
    return {
      kind: "empty",
      path: target,
      recoverablePath: path.join(target, pendingEntries[0].name),
      entries,
    };
  }

  if (entries.length === 0) return { kind: "empty", path: target, entries };
  return { kind: "empty", path: target, entries };
}

function inspectLegacyTransition(directory, projectId, nowMs, staleAfterMs) {
  const target = legacyTransitionPath(directory, projectId);
  try {
    const stat = fs.statSync(target);
    const ageMs = Math.max(0, nowMs - stat.mtimeMs);
    return { exists: true, path: target, ageMs, recoverable: ageMs >= staleAfterMs };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, path: target };
    throw error;
  }
}

function inspectOwnerLock({ directory, projectId, nowMs, staleAfterMs }) {
  const snapshot = readOwnerSnapshot(directory, projectId);
  if (snapshot.kind === "missing") {
    return { state: "free", held: false, path: snapshot.path, snapshot };
  }
  if (snapshot.kind === "empty") {
    return {
      state: "empty",
      held: true,
      path: snapshot.path,
      recoverable: snapshot.recoverablePath !== undefined || snapshot.entries.length === 0,
      snapshot,
    };
  }

  if (snapshot.kind === "legacy-owner") {
    const createdAtMs = Date.parse(snapshot.owner.acquiredAt);
    const ageMs = Math.max(0, nowMs - createdAtMs);
    return {
      state: ageMs >= staleAfterMs ? "stale" : "held",
      held: true,
      path: snapshot.path,
      legacyOwner: snapshot.owner,
      ageMs,
      recoverable: ageMs >= staleAfterMs,
      snapshot,
    };
  }

  const createdAtMs = Date.parse(snapshot.owner.createdAt);
  const expiresAtMs = Date.parse(snapshot.owner.expiresAt);
  const ageMs = Math.max(0, nowMs - createdAtMs);
  const stale = nowMs >= expiresAtMs;
  return {
    state: stale ? "stale" : "held",
    held: true,
    path: snapshot.path,
    owner: snapshot.owner,
    ageMs,
    recoverable: stale,
    snapshot,
  };
}

function acquisitionFailure(inspection) {
  const reasons = {
    held: "LOCK_HELD",
    stale: "LOCK_STALE",
    empty: "LOCK_EMPTY",
    "legacy-transition": "LEGACY_TRANSITION",
  };
  const { snapshot: _snapshot, ...publicInspection } = inspection;
  return { acquired: false, reason: reasons[inspection.state], ...publicInspection };
}

export function acquireProjectLock({
  directory,
  projectId,
  hostId,
  now = new Date().toISOString(),
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  onDirectoryCreated,
  onOwnerPrepared,
  onOwnerPublished,
}) {
  const normalizedDirectory = requiredString(directory, "directory");
  const normalizedProjectId = requiredString(projectId, "projectId");
  const normalizedHostId = requiredString(hostId, "hostId");
  const nowMs = instant(now, "now");
  const normalizedDuration = duration(leaseDurationMs, "leaseDurationMs");
  fs.mkdirSync(normalizedDirectory, { recursive: true });

  const legacyTransition = inspectLegacyTransition(
    normalizedDirectory,
    normalizedProjectId,
    nowMs,
    normalizedDuration,
  );
  if (legacyTransition.exists) {
    return acquisitionFailure({
      state: "legacy-transition",
      held: true,
      path: lockPath(normalizedDirectory, normalizedProjectId),
      transitionPath: legacyTransition.path,
      ageMs: legacyTransition.ageMs,
      recoverable: legacyTransition.recoverable,
    });
  }

  const target = lockPath(normalizedDirectory, normalizedProjectId);
  try {
    fs.mkdirSync(target, { mode: 0o700 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return acquisitionFailure(
      inspectOwnerLock({
        directory: normalizedDirectory,
        projectId: normalizedProjectId,
        nowMs,
        staleAfterMs: normalizedDuration,
      }),
    );
  }

  onDirectoryCreated?.();
  const token = randomUUID();
  const owner = {
    schemaVersion: 2,
    projectId: normalizedProjectId,
    hostId: normalizedHostId,
    token,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + normalizedDuration).toISOString(),
  };
  const pendingPath = pendingOwnerPath(normalizedDirectory, normalizedProjectId, token);
  fs.writeFileSync(pendingPath, JSON.stringify(owner), { flag: "wx", mode: 0o600 });
  onOwnerPrepared?.();
  fs.renameSync(pendingPath, ownerPath(normalizedDirectory, normalizedProjectId, token));
  onOwnerPublished?.();
  return {
    acquired: true,
    directory: normalizedDirectory,
    projectId: normalizedProjectId,
    path: target,
    token,
    owner,
  };
}

export function inspectProjectLock({
  directory,
  projectId,
  now = new Date().toISOString(),
  staleAfterMs = DEFAULT_LEASE_DURATION_MS,
}) {
  const normalizedDirectory = requiredString(directory, "directory");
  const normalizedProjectId = requiredString(projectId, "projectId");
  const nowMs = instant(now, "now");
  const normalizedStaleAfterMs = duration(staleAfterMs, "staleAfterMs");
  const transition = inspectLegacyTransition(
    normalizedDirectory,
    normalizedProjectId,
    nowMs,
    normalizedStaleAfterMs,
  );
  if (transition.exists) {
    return {
      state: "legacy-transition",
      held: true,
      path: lockPath(normalizedDirectory, normalizedProjectId),
      transitionPath: transition.path,
      ageMs: transition.ageMs,
      recoverable: transition.recoverable,
    };
  }
  const inspection = inspectOwnerLock({
    directory: normalizedDirectory,
    projectId: normalizedProjectId,
    nowMs,
    staleAfterMs: normalizedStaleAfterMs,
  });
  const { snapshot: _snapshot, ...publicInspection } = inspection;
  return publicInspection;
}

export function verifyProjectLock(handle, { now = new Date().toISOString() } = {}) {
  if (
    !handle ||
    typeof handle !== "object" ||
    Array.isArray(handle) ||
    !handle.directory ||
    !handle.projectId ||
    !handle.token ||
    !handle.owner
  ) {
    return { verified: false, reason: "INVALID_HANDLE" };
  }
  let directory;
  let projectId;
  let token;
  let nowMs;
  try {
    directory = requiredString(handle.directory, "directory");
    projectId = requiredString(handle.projectId, "projectId");
    token = requiredString(handle.token, "token");
    nowMs = instant(now, "now");
  } catch {
    return { verified: false, reason: "INVALID_HANDLE" };
  }
  const expectedOwner = normalizeOwner(handle.owner, projectId);
  if (!expectedOwner || expectedOwner.token !== token) {
    return { verified: false, reason: "INVALID_HANDLE" };
  }
  const owner = normalizeOwner(parseJsonFile(ownerPath(directory, projectId, token)), projectId);
  if (!owner) {
    const inspection = inspectProjectLock({ directory, projectId, now });
    return {
      verified: false,
      reason: inspection.state === "free" ? "LOCK_MISSING" : "LOCK_CHANGED",
    };
  }
  if (
    owner.token !== expectedOwner.token ||
    owner.hostId !== expectedOwner.hostId ||
    owner.createdAt !== expectedOwner.createdAt ||
    owner.expiresAt !== expectedOwner.expiresAt
  ) {
    return { verified: false, reason: "LOCK_CHANGED" };
  }
  if (nowMs >= Date.parse(owner.expiresAt)) {
    return { verified: false, reason: "LOCK_EXPIRED", expiresAt: owner.expiresAt };
  }
  return {
    verified: true,
    verification: {
      directory,
      projectId,
      hostId: owner.hostId,
      token,
      verifiedAt: new Date(nowMs).toISOString(),
      expiresAt: owner.expiresAt,
    },
  };
}

export function releaseProjectLock(handle, { onValidated, onOwnerRemoved } = {}) {
  if (!handle?.directory || !handle.projectId || !handle.token) {
    return { released: false, reason: "INVALID_HANDLE" };
  }
  const exactOwnerPath = ownerPath(handle.directory, handle.projectId, handle.token);
  const owner = normalizeOwner(parseJsonFile(exactOwnerPath), handle.projectId);
  if (!owner || owner.token !== handle.token) {
    const inspection = inspectProjectLock({
      directory: handle.directory,
      projectId: handle.projectId,
    });
    return {
      released: false,
      reason: inspection.state === "free" ? "LOCK_MISSING" : "TOKEN_MISMATCH",
    };
  }

  onValidated?.();
  try {
    fs.unlinkSync(exactOwnerPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { released: false, reason: "LOCK_CHANGED" };
    throw error;
  }
  onOwnerRemoved?.();
  try {
    fs.rmdirSync(lockPath(handle.directory, handle.projectId));
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY" && error?.code !== "EEXIST") {
      throw error;
    }
  }
  return { released: true };
}

function recoverEmptyLock(snapshot, projectId) {
  if (snapshot.recoverablePath !== undefined) {
    const raw = parseJsonFile(snapshot.recoverablePath);
    const filename = path.basename(snapshot.recoverablePath);
    const owner = normalizeOwner(raw, projectId);
    const pending = filename.startsWith(PENDING_OWNER_PREFIX);
    if (!pending && (owner || (raw?.schemaVersion === 1 && typeof raw.token === "string"))) {
      return { recovered: false, reason: "LOCK_CHANGED" };
    }
    if (
      filename !== LEGACY_OWNER_FILENAME &&
      !filename.startsWith(OWNER_PREFIX) &&
      !filename.startsWith(PENDING_OWNER_PREFIX)
    ) {
      return { recovered: false, reason: "LOCK_UNREADABLE" };
    }
    try {
      fs.unlinkSync(snapshot.recoverablePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return { recovered: false, reason: "LOCK_CHANGED" };
    }
  } else if (snapshot.entries.length > 0) {
    return { recovered: false, reason: "LOCK_UNREADABLE" };
  }

  try {
    fs.rmdirSync(snapshot.path);
    return { recovered: true };
  } catch (error) {
    if (error?.code === "ENOENT") return { recovered: false, reason: "LOCK_CHANGED" };
    if (error?.code === "ENOTEMPTY" || error?.code === "EEXIST") {
      return { recovered: false, reason: "LOCK_CHANGED" };
    }
    throw error;
  }
}

function recoverStaleOwner(snapshot, expectedToken) {
  if (typeof expectedToken !== "string" || expectedToken.length === 0) {
    return { recovered: false, reason: "EXPECTED_TOKEN_REQUIRED" };
  }
  if (snapshot.owner.token !== expectedToken) {
    return { recovered: false, reason: "TOKEN_MISMATCH" };
  }

  const current = parseJsonFile(snapshot.ownerPath);
  if (current?.token !== expectedToken) {
    return { recovered: false, reason: "LOCK_CHANGED" };
  }
  try {
    fs.unlinkSync(snapshot.ownerPath);
  } catch (error) {
    if (error?.code === "ENOENT") return { recovered: false, reason: "LOCK_CHANGED" };
    throw error;
  }
  try {
    fs.rmdirSync(snapshot.path);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY" && error?.code !== "EEXIST") {
      throw error;
    }
  }
  return { recovered: true };
}

export function recoverProjectLock({
  directory,
  projectId,
  expectedToken,
  now = new Date().toISOString(),
  staleAfterMs = DEFAULT_LEASE_DURATION_MS,
  onLegacyTransitionRemoved,
  onOwnerRemoved,
}) {
  const normalizedDirectory = requiredString(directory, "directory");
  const normalizedProjectId = requiredString(projectId, "projectId");
  const nowMs = instant(now, "now");
  const normalizedStaleAfterMs = duration(staleAfterMs, "staleAfterMs");
  const artifacts = [];

  const transition = inspectLegacyTransition(
    normalizedDirectory,
    normalizedProjectId,
    nowMs,
    normalizedStaleAfterMs,
  );
  if (transition.exists) {
    if (!transition.recoverable) {
      return { recovered: false, reason: "LEGACY_TRANSITION_NOT_STALE" };
    }
    try {
      fs.rmdirSync(transition.path);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { recovered: false, reason: "LOCK_CHANGED" };
      }
      if (error?.code === "ENOTEMPTY" || error?.code === "EEXIST") {
        return { recovered: false, reason: "LEGACY_TRANSITION_NOT_EMPTY" };
      }
      throw error;
    }
    artifacts.push("legacy-transition");
    onLegacyTransitionRemoved?.();
  }

  const inspection = inspectOwnerLock({
    directory: normalizedDirectory,
    projectId: normalizedProjectId,
    nowMs,
    staleAfterMs: normalizedStaleAfterMs,
  });
  if (inspection.state === "free") {
    return artifacts.length > 0
      ? { recovered: true, state: "free", artifacts }
      : { recovered: false, reason: "LOCK_MISSING" };
  }
  if (inspection.state === "held") {
    return {
      recovered: false,
      reason: "LOCK_NOT_STALE",
      ...(artifacts.length > 0 ? { recoveredArtifacts: artifacts } : {}),
    };
  }

  const result =
    inspection.state === "empty"
      ? recoverEmptyLock(inspection.snapshot, normalizedProjectId)
      : recoverStaleOwner(inspection.snapshot, expectedToken);
  if (!result.recovered) {
    return {
      ...result,
      ...(artifacts.length > 0 ? { recoveredArtifacts: artifacts } : {}),
    };
  }
  onOwnerRemoved?.();
  return {
    recovered: true,
    state: "free",
    artifacts: [...artifacts, inspection.state],
  };
}
