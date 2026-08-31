import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  createDecisionManifest,
  createManifestHandoff,
  deriveRepositoryId,
  hashDecisionManifestContent,
  serializeDecisionManifest,
  validateDecisionManifest,
} from "./manifest-schema.mjs";

const RUN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/;
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const IDENTITY_PATTERN = /^[a-f0-9]{64}$/;
const RUN_LOCK_SCHEMA_VERSION = 1;
const RUN_LOCK_STALE_MS = 30_000;
const RUN_LOCK_WAIT_TIMEOUT_MS = 5_000;
const RUN_LOCK_RETRY_INTERVAL_MS = 10;
const RUN_LOCK_SLEEP_STATE = new Int32Array(new SharedArrayBuffer(4));
const PROTECTED_ERROR_DETAIL_KEYS = new Set(["name", "code", "message", "stack"]);
const OUT_OF_SCOPE_DIAGNOSTICS = new Set([
  "run-id-mismatch",
  "repository-mismatch",
  "worktree-mismatch",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function causeOptions(cause) {
  return cause === undefined ? undefined : { cause };
}

export class DecisionManifestStoreError extends Error {
  constructor(message, { code, cause, ...details } = {}) {
    super(message, causeOptions(cause));
    this.name = "DecisionManifestStoreError";
    this.code = code ?? "decision-manifest-store-error";
    for (const [key, value] of Object.entries(details)) {
      if (!PROTECTED_ERROR_DETAIL_KEYS.has(key)) this[key] = value;
    }
  }
}

export class WorkflowStateConflictError extends DecisionManifestStoreError {
  constructor({
    runId,
    manifestPath,
    expectedRevision,
    actualRevision,
    observedContentHash,
    actualContentHash,
  }) {
    super(`Decision manifest state changed before the write for run ${runId}.`, {
      code: "workflow-state-conflict",
      runId,
      path: manifestPath,
      expectedRevision,
      actualRevision,
      observedContentHash: observedContentHash ?? null,
      actualContentHash,
    });
    this.name = "WorkflowStateConflictError";
  }
}

function validateRunId(runId) {
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    throw new DecisionManifestStoreError("The decision manifest run id is unsafe.", {
      code: "invalid-run-id",
      runId,
    });
  }
  return runId;
}

function normalizeGitContext(gitContext) {
  if (
    !isRecord(gitContext) ||
    typeof gitContext.gitCommonDir !== "string" ||
    !IDENTITY_PATTERN.test(gitContext.worktreeId)
  ) {
    throw new DecisionManifestStoreError("A canonical Git context is required.", {
      code: "invalid-git-context",
    });
  }

  try {
    return {
      gitCommonDir: fs.realpathSync(gitContext.gitCommonDir),
      worktreeId: gitContext.worktreeId,
    };
  } catch (cause) {
    throw new DecisionManifestStoreError("The Git common directory is unavailable.", {
      code: "invalid-git-context",
      cause,
    });
  }
}

function pathIsWithin(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function manifestPaths(gitContext, runId) {
  const safeRunId = validateRunId(runId);
  const normalizedContext = normalizeGitContext(gitContext);
  const runsDirectory = path.join(normalizedContext.gitCommonDir, "nuthouse", "workflow", "runs");
  const manifestPath = path.join(runsDirectory, `${safeRunId}.json`);

  if (!pathIsWithin(runsDirectory, manifestPath)) {
    throw new DecisionManifestStoreError("The decision manifest path escapes its run directory.", {
      code: "manifest-path-out-of-scope",
      runId: safeRunId,
      path: manifestPath,
    });
  }

  return { runId: safeRunId, normalizedContext, runsDirectory, manifestPath };
}

export function getDecisionManifestPath(gitContext, runId) {
  return manifestPaths(gitContext, runId).manifestPath;
}

function assertManagedPathComponent(componentPath, gitCommonDir) {
  let stat;
  try {
    stat = fs.lstatSync(componentPath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }

  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new DecisionManifestStoreError(
      "A workflow state directory is not a confined real directory.",
      {
        code: "manifest-path-out-of-scope",
        path: componentPath,
      },
    );
  }
  const canonicalPath = fs.realpathSync(componentPath);
  if (!pathIsWithin(gitCommonDir, canonicalPath)) {
    throw new DecisionManifestStoreError("A workflow state directory escapes Git state.", {
      code: "manifest-path-out-of-scope",
      path: componentPath,
    });
  }
  return true;
}

function managedDirectories(gitCommonDir) {
  const nuthouseDirectory = path.join(gitCommonDir, "nuthouse");
  const workflowDirectory = path.join(nuthouseDirectory, "workflow");
  return [nuthouseDirectory, workflowDirectory, path.join(workflowDirectory, "runs")];
}

function assertExistingPathConfinement(gitCommonDir) {
  for (const directory of managedDirectories(gitCommonDir)) {
    if (!assertManagedPathComponent(directory, gitCommonDir)) return;
  }
}

function ensurePrivateRunDirectory(gitCommonDir) {
  for (const directory of managedDirectories(gitCommonDir)) {
    if (!assertManagedPathComponent(directory, gitCommonDir)) {
      try {
        fs.mkdirSync(directory, { mode: 0o700 });
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
      assertManagedPathComponent(directory, gitCommonDir);
    }
    fs.chmodSync(directory, 0o700);
  }
}

function normalizeNow(value) {
  const epochMilliseconds =
    value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : value;
  try {
    if (!Number.isFinite(epochMilliseconds)) throw new RangeError("Invalid clock");
    const canonicalTimestamp = new Date(epochMilliseconds).toISOString();
    if (typeof value === "string" && canonicalTimestamp !== value) {
      throw new RangeError("Non-canonical clock");
    }
  } catch {
    throw new DecisionManifestStoreError("The injected manifest clock is invalid.", {
      code: "invalid-manifest-clock",
    });
  }
  return epochMilliseconds;
}

function readManifestBytes(manifestPath) {
  let stat;
  try {
    stat = fs.lstatSync(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new DecisionManifestStoreError("Could not inspect the decision manifest.", {
      code: "decision-manifest-read-failed",
      path: manifestPath,
      cause: error,
    });
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new DecisionManifestStoreError("The decision manifest is not a confined regular file.", {
      code: "manifest-path-out-of-scope",
      path: manifestPath,
    });
  }

  try {
    return fs.readFileSync(manifestPath);
  } catch (cause) {
    throw new DecisionManifestStoreError("Could not read the decision manifest.", {
      code: "decision-manifest-read-failed",
      path: manifestPath,
      cause,
    });
  }
}

function invalidJsonDiagnostic() {
  return {
    code: "invalid-json",
    field: "$",
    message: "The decision manifest is not valid JSON.",
  };
}

function inspectionResult({
  status,
  manifestPath,
  contentHash,
  manifest = null,
  handoff = null,
  diagnostics = [],
}) {
  return {
    status,
    path: manifestPath,
    contentHash,
    manifest,
    handoff,
    diagnostics,
  };
}

export function inspectDecisionManifest(gitContext, runId, options = {}) {
  const { normalizedContext, manifestPath } = manifestPaths(gitContext, runId);
  assertExistingPathConfinement(normalizedContext.gitCommonDir);
  const bytes = readManifestBytes(manifestPath);
  if (bytes === null) {
    return inspectionResult({
      status: "missing",
      manifestPath,
      contentHash: null,
    });
  }

  const contentHash = hashDecisionManifestContent(bytes);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return inspectionResult({
      status: "corrupt",
      manifestPath,
      contentHash,
      diagnostics: [invalidJsonDiagnostic()],
    });
  }

  const structuralValidation = validateDecisionManifest(parsed);
  if (!structuralValidation.ok) {
    return inspectionResult({
      status: "invalid",
      manifestPath,
      contentHash,
      diagnostics: structuralValidation.diagnostics,
    });
  }

  const now = normalizeNow(options.now ?? Date.now());
  const scopeValidation = validateDecisionManifest(parsed, {
    now,
    expectedRunId: runId,
    expectedRepositoryId: deriveRepositoryId(normalizedContext.gitCommonDir),
    expectedWorktreeId: normalizedContext.worktreeId,
  });
  if (!scopeValidation.ok) {
    const outOfScope = scopeValidation.diagnostics.some(({ code }) =>
      OUT_OF_SCOPE_DIAGNOSTICS.has(code),
    );
    const expired = scopeValidation.diagnostics.some(({ code }) => code === "expired-manifest");
    return inspectionResult({
      status: outOfScope ? "out-of-scope" : expired ? "expired" : "invalid",
      manifestPath,
      contentHash,
      manifest: structuralValidation.value,
      diagnostics: scopeValidation.diagnostics,
    });
  }

  const manifest = scopeValidation.value;
  const handoff = createManifestHandoff({ runId, path: manifestPath, contentHash });
  return inspectionResult({
    status: "valid",
    manifestPath,
    contentHash,
    manifest,
    handoff,
  });
}

function parseRunLockOwner(contents) {
  try {
    const parsed = JSON.parse(contents);
    if (
      isRecord(parsed) &&
      parsed.schemaVersion === RUN_LOCK_SCHEMA_VERSION &&
      Number.isSafeInteger(parsed.pid) &&
      parsed.pid > 0 &&
      typeof parsed.token === "string" &&
      parsed.token.length > 0
    ) {
      const createdAt = Date.parse(parsed.createdAt);
      return {
        pid: parsed.pid,
        token: parsed.token,
        createdAt: Number.isFinite(createdAt) ? createdAt : null,
      };
    }
  } catch {}
  return null;
}

function readRunLock(lockPath) {
  let stat;
  try {
    stat = fs.lstatSync(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new DecisionManifestStoreError("The decision manifest lock is not a regular file.", {
      code: "decision-manifest-lock-unsafe",
      path: lockPath,
    });
  }

  let contents;
  try {
    contents = fs.readFileSync(lockPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  return {
    contents,
    device: stat.dev,
    inode: stat.ino,
    modifiedAt: stat.mtimeMs,
    owner: parseRunLockOwner(contents),
  };
}

function sameRunLock(left, right) {
  if (!left || !right) return false;
  if (left.owner?.token && right.owner?.token) return left.owner.token === right.owner.token;
  return (
    left.device === right.device && left.inode === right.inode && left.contents === right.contents
  );
}

function processIsAlive(pid) {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function runLockIsAbandoned(lock, now = Date.now()) {
  if (!lock) return false;
  const createdAt = lock.owner?.createdAt ?? lock.modifiedAt;
  const leaseExpired = Number.isFinite(createdAt) && now - createdAt >= RUN_LOCK_STALE_MS;
  const ownerExited = lock.owner !== null && !processIsAlive(lock.owner.pid);
  const malformedAndStale = lock.owner === null && leaseExpired;
  return ownerExited || malformedAndStale;
}

function recoverAbandonedRunLock(lockPath, observedLock) {
  const currentLock = readRunLock(lockPath);
  if (!sameRunLock(observedLock, currentLock) || !runLockIsAbandoned(currentLock)) return false;
  try {
    fs.unlinkSync(lockPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

function releaseRunLock(lockPath, token) {
  const currentLock = readRunLock(lockPath);
  if (currentLock?.owner?.token !== token) {
    throw new DecisionManifestStoreError("Decision manifest lock ownership was lost.", {
      code: "decision-manifest-lock-lost",
      path: lockPath,
    });
  }
  fs.unlinkSync(lockPath);
}

function withRunLock({ normalizedContext, manifestPath }, operation) {
  ensurePrivateRunDirectory(normalizedContext.gitCommonDir);
  const lockPath = `${manifestPath}.lock`;
  const token = randomUUID();
  const owner = {
    schemaVersion: RUN_LOCK_SCHEMA_VERSION,
    pid: process.pid,
    createdAt: new Date().toISOString(),
    token,
  };
  const deadline = Date.now() + RUN_LOCK_WAIT_TIMEOUT_MS;

  while (true) {
    try {
      fs.writeFileSync(lockPath, `${JSON.stringify(owner)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      fs.chmodSync(lockPath, 0o600);
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const observedLock = readRunLock(lockPath);
      if (runLockIsAbandoned(observedLock) && recoverAbandonedRunLock(lockPath, observedLock)) {
        continue;
      }
      if (Date.now() >= deadline) {
        throw new DecisionManifestStoreError(
          `Timed out waiting for the decision manifest lock: ${lockPath}.`,
          {
            code: "decision-manifest-lock-timeout",
            path: lockPath,
          },
        );
      }
      Atomics.wait(RUN_LOCK_SLEEP_STATE, 0, 0, RUN_LOCK_RETRY_INTERVAL_MS);
    }
  }

  let result;
  try {
    result = operation();
  } catch (operationError) {
    try {
      releaseRunLock(lockPath, token);
    } catch {}
    throw operationError;
  }

  releaseRunLock(lockPath, token);
  return result;
}

function readObservedState(manifestPath) {
  const bytes = readManifestBytes(manifestPath);
  if (bytes === null) {
    return {
      kind: "missing",
      contentHash: null,
      manifest: null,
    };
  }

  const contentHash = hashDecisionManifestContent(bytes);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return { kind: "untrusted", contentHash, manifest: null };
  }
  const validation = validateDecisionManifest(parsed);
  if (!validation.ok) return { kind: "untrusted", contentHash, manifest: null };
  return { kind: "versioned", contentHash, manifest: validation.value };
}

function validateWriteOptions(options) {
  if (!Number.isSafeInteger(options.expectedRevision) || options.expectedRevision < 0) {
    throw new DecisionManifestStoreError("expectedRevision must be a non-negative integer.", {
      code: "invalid-expected-revision",
      expectedRevision: options.expectedRevision,
    });
  }
  if (
    options.observedContentHash !== undefined &&
    (typeof options.observedContentHash !== "string" ||
      !CONTENT_HASH_PATTERN.test(options.observedContentHash))
  ) {
    throw new DecisionManifestStoreError("observedContentHash must be a SHA-256 content hash.", {
      code: "invalid-observed-content-hash",
    });
  }
}

function throwStateConflict({ runId, manifestPath, options, observedState }) {
  throw new WorkflowStateConflictError({
    runId,
    manifestPath,
    expectedRevision: options.expectedRevision,
    actualRevision: observedState.manifest?.revision ?? null,
    observedContentHash: options.observedContentHash,
    actualContentHash: observedState.contentHash,
  });
}

function nextManifestVersion({ runId, manifestPath, options, observedState, now }) {
  if (
    options.observedContentHash !== undefined &&
    options.observedContentHash !== observedState.contentHash
  ) {
    throwStateConflict({ runId, manifestPath, options, observedState });
  }

  if (observedState.kind === "missing") {
    if (options.expectedRevision !== 0 || options.observedContentHash !== undefined) {
      throwStateConflict({ runId, manifestPath, options, observedState });
    }
    return { revision: 1, createdAt: new Date(now).toISOString() };
  }

  if (observedState.kind === "untrusted") {
    if (options.expectedRevision !== 0 || options.observedContentHash === undefined) {
      throwStateConflict({ runId, manifestPath, options, observedState });
    }
    return { revision: 1, createdAt: new Date(now).toISOString() };
  }

  if (options.expectedRevision !== observedState.manifest.revision) {
    throwStateConflict({ runId, manifestPath, options, observedState });
  }
  return {
    revision: observedState.manifest.revision + 1,
    createdAt: observedState.manifest.createdAt,
  };
}

function atomicWriteManifest(manifestPath, contents) {
  const directory = path.dirname(manifestPath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(manifestPath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, contents, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, manifestPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }
}

export function writeDecisionManifest(gitContext, input, options = {}) {
  if (!isRecord(input)) {
    throw new DecisionManifestStoreError("A decision manifest write input is required.", {
      code: "invalid-manifest-write-input",
    });
  }
  validateWriteOptions(options);
  const pathContext = manifestPaths(gitContext, input.runId);
  const now = normalizeNow(options.now ?? Date.now());

  return withRunLock(pathContext, () => {
    const observedState = readObservedState(pathContext.manifestPath);
    const version = nextManifestVersion({
      runId: pathContext.runId,
      manifestPath: pathContext.manifestPath,
      options,
      observedState,
      now,
    });
    const manifest = createDecisionManifest({
      runId: pathContext.runId,
      repositoryId: deriveRepositoryId(pathContext.normalizedContext.gitCommonDir),
      worktreeId: pathContext.normalizedContext.worktreeId,
      decision: input.policy,
      artifacts: input.artifacts ?? [],
      policyHash: input.policyHash,
      revision: version.revision,
      createdAt: version.createdAt,
      updatedAt: new Date(now).toISOString(),
      expiresAt: input.expiresAt,
    });
    const contents = serializeDecisionManifest(manifest);
    atomicWriteManifest(pathContext.manifestPath, contents);
    const persistedBytes = fs.readFileSync(pathContext.manifestPath);
    if (!persistedBytes.equals(Buffer.from(contents, "utf8"))) {
      throw new DecisionManifestStoreError("Decision manifest bytes changed during persistence.", {
        code: "decision-manifest-write-verification-failed",
        path: pathContext.manifestPath,
      });
    }
    const contentHash = hashDecisionManifestContent(persistedBytes);
    return {
      manifest,
      path: pathContext.manifestPath,
      contentHash,
      handoff: createManifestHandoff({
        runId: pathContext.runId,
        path: pathContext.manifestPath,
        contentHash,
      }),
    };
  });
}
