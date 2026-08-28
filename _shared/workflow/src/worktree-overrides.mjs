import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKFLOW_PROFILES, isWorkflowProfile } from "./configuration.mjs";

export const WORKTREE_OVERRIDE_SCHEMA_VERSION = 1;
export const MAX_WORKTREE_OVERRIDE_AGE_MS = 24 * 60 * 60 * 1000;

const OVERRIDE_FIELDS = new Set([
  "schemaVersion",
  "worktreeId",
  "profile",
  "createdAt",
  "expiresAt",
]);
const WORKTREE_ID_PATTERN = /^[a-f0-9]{64}$/;
const WORKTREE_LOCK_WAIT_TIMEOUT_MS = 5_000;
const WORKTREE_LOCK_RETRY_INTERVAL_MS = 10;
const WORKTREE_LOCK_SLEEP_STATE = new Int32Array(new SharedArrayBuffer(4));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validationDiagnostic(code, field, message) {
  return { code, field, message };
}

function worktreeWarning(diagnostic, overridePath) {
  return {
    ...diagnostic,
    source: "worktree",
    path: overridePath,
    severity: "warning",
    fallback: "repository",
  };
}

function parseCanonicalTimestamp(value) {
  if (typeof value !== "string") return null;
  const epochMilliseconds = Date.parse(value);
  if (!Number.isFinite(epochMilliseconds)) return null;
  try {
    if (new Date(epochMilliseconds).toISOString() !== value) return null;
  } catch {
    return null;
  }
  return epochMilliseconds;
}

function normalizeNow(value) {
  const epochMilliseconds = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(epochMilliseconds)) {
    throw new WorktreeOverrideValidationError([
      validationDiagnostic("invalid-timestamp", "$.now", "The injected clock is invalid."),
    ]);
  }
  return epochMilliseconds;
}

function resolveGitPath(cwd, value) {
  return fs.realpathSync(path.isAbsolute(value) ? value : path.resolve(cwd, value));
}

function gitRevParse(cwd, argument) {
  return execFileSync("git", ["-C", cwd, "rev-parse", "--path-format=absolute", argument], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function atomicWriteJson(filePath, value) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }
}

function withWorktreeOverrideLock(gitContext, operation) {
  const overridePath = getWorktreeOverridePath(gitContext);
  const lockPath = `${overridePath}.lock`;
  const lockToken = `${process.pid}:${randomUUID()}\n`;
  const deadline = Date.now() + WORKTREE_LOCK_WAIT_TIMEOUT_MS;

  fs.mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 });
  while (true) {
    try {
      fs.writeFileSync(lockPath, lockToken, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        const timeout = new Error(`Timed out waiting for the worktree override lock: ${lockPath}.`);
        timeout.name = "WorktreeOverrideLockError";
        timeout.code = "worktree-override-lock-timeout";
        timeout.path = lockPath;
        throw timeout;
      }
      Atomics.wait(WORKTREE_LOCK_SLEEP_STATE, 0, 0, WORKTREE_LOCK_RETRY_INTERVAL_MS);
    }
  }

  try {
    return operation();
  } finally {
    fs.unlinkSync(lockPath);
  }
}

export class GitContextError extends Error {
  constructor(cwd, cause) {
    super(`Could not discover a Git worktree from ${cwd}.`, { cause });
    this.name = "GitContextError";
    this.code = "git-context-unavailable";
    this.cwd = cwd;
  }
}

export class WorktreeOverrideValidationError extends Error {
  constructor(diagnostics) {
    super(`Invalid worktree override at ${diagnostics[0]?.field ?? "$"}.`);
    this.name = "WorktreeOverrideValidationError";
    this.code = "invalid-worktree-override";
    this.source = "worktree";
    this.field = diagnostics[0]?.field ?? "$";
    this.diagnostics = diagnostics;
    this.blocked = true;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      source: this.source,
      field: this.field,
      diagnostics: this.diagnostics,
      blocked: this.blocked,
    };
  }
}

export function deriveWorktreeId(worktreeRoot) {
  const canonicalRoot = fs.realpathSync(worktreeRoot);
  return createHash("sha256").update(canonicalRoot).digest("hex");
}

export function discoverGitContext(cwd = process.cwd()) {
  try {
    const worktreeRoot = resolveGitPath(cwd, gitRevParse(cwd, "--show-toplevel"));
    const gitCommonDir = resolveGitPath(cwd, gitRevParse(cwd, "--git-common-dir"));
    return {
      worktreeRoot,
      gitCommonDir,
      worktreeId: deriveWorktreeId(worktreeRoot),
    };
  } catch (error) {
    throw new GitContextError(cwd, error);
  }
}

export function getWorktreeOverridePath(gitContext) {
  return path.join(
    gitContext.gitCommonDir,
    "nuthouse",
    "workflow",
    "worktrees",
    `${gitContext.worktreeId}.json`,
  );
}

export function validateWorktreeOverride(value, { expectedWorktreeId } = {}) {
  if (!isRecord(value)) {
    return {
      ok: false,
      diagnostics: [
        validationDiagnostic(
          "invalid-type",
          "$",
          "Expected the worktree override to be an object.",
        ),
      ],
    };
  }

  const diagnostics = [];
  const unknownFields = Object.keys(value)
    .filter((field) => !OVERRIDE_FIELDS.has(field))
    .sort();

  for (const field of unknownFields) {
    diagnostics.push(
      validationDiagnostic("unknown-field", `$.${field}`, `Unknown override field: ${field}.`),
    );
  }

  if (!Object.hasOwn(value, "schemaVersion")) {
    diagnostics.push(
      validationDiagnostic(
        "missing-field",
        "$.schemaVersion",
        "The schemaVersion field is required.",
      ),
    );
  } else if (value.schemaVersion !== WORKTREE_OVERRIDE_SCHEMA_VERSION) {
    diagnostics.push(
      validationDiagnostic(
        "unsupported-schema-version",
        "$.schemaVersion",
        `Expected schemaVersion ${WORKTREE_OVERRIDE_SCHEMA_VERSION}.`,
      ),
    );
  }

  if (!Object.hasOwn(value, "worktreeId")) {
    diagnostics.push(
      validationDiagnostic("missing-field", "$.worktreeId", "The worktreeId field is required."),
    );
  } else if (typeof value.worktreeId !== "string" || !WORKTREE_ID_PATTERN.test(value.worktreeId)) {
    diagnostics.push(
      validationDiagnostic(
        "invalid-worktree-id",
        "$.worktreeId",
        "Expected worktreeId to be a lowercase SHA-256 digest.",
      ),
    );
  } else if (expectedWorktreeId !== undefined && value.worktreeId !== expectedWorktreeId) {
    diagnostics.push(
      validationDiagnostic(
        "worktree-mismatch",
        "$.worktreeId",
        "The override belongs to a different worktree.",
      ),
    );
  }

  if (!Object.hasOwn(value, "profile")) {
    diagnostics.push(
      validationDiagnostic("missing-field", "$.profile", "The profile field is required."),
    );
  } else if (!isWorkflowProfile(value.profile)) {
    diagnostics.push(
      validationDiagnostic(
        "invalid-profile",
        "$.profile",
        `Expected profile to be one of ${WORKFLOW_PROFILES.join(", ")}.`,
      ),
    );
  }

  let createdAt = null;
  if (!Object.hasOwn(value, "createdAt")) {
    diagnostics.push(
      validationDiagnostic("missing-field", "$.createdAt", "The createdAt field is required."),
    );
  } else {
    createdAt = parseCanonicalTimestamp(value.createdAt);
    if (createdAt === null) {
      diagnostics.push(
        validationDiagnostic(
          "invalid-timestamp",
          "$.createdAt",
          "Expected createdAt to be a canonical ISO timestamp.",
        ),
      );
    }
  }

  let expiresAt = null;
  if (!Object.hasOwn(value, "expiresAt")) {
    diagnostics.push(
      validationDiagnostic("missing-field", "$.expiresAt", "The expiresAt field is required."),
    );
  } else {
    expiresAt = parseCanonicalTimestamp(value.expiresAt);
    if (expiresAt === null) {
      diagnostics.push(
        validationDiagnostic(
          "invalid-timestamp",
          "$.expiresAt",
          "Expected expiresAt to be a canonical ISO timestamp.",
        ),
      );
    }
  }

  if (createdAt !== null && expiresAt !== null) {
    const lifetime = expiresAt - createdAt;
    if (lifetime <= 0) {
      diagnostics.push(
        validationDiagnostic(
          "invalid-lifetime",
          "$.expiresAt",
          "expiresAt must be later than createdAt.",
        ),
      );
    } else if (lifetime > MAX_WORKTREE_OVERRIDE_AGE_MS) {
      diagnostics.push(
        validationDiagnostic(
          "maximum-lifetime-exceeded",
          "$.expiresAt",
          "A worktree override cannot live longer than 24 hours.",
        ),
      );
    }
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return {
    ok: true,
    value: {
      schemaVersion: WORKTREE_OVERRIDE_SCHEMA_VERSION,
      worktreeId: value.worktreeId,
      profile: value.profile,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
    },
    diagnostics: [],
  };
}

export function writeWorktreeOverride(gitContext, profile, options = {}) {
  const now = normalizeNow(options.now ?? Date.now());
  const durationMs = options.durationMs ?? MAX_WORKTREE_OVERRIDE_AGE_MS;
  if (
    !Number.isInteger(durationMs) ||
    durationMs <= 0 ||
    durationMs > MAX_WORKTREE_OVERRIDE_AGE_MS
  ) {
    throw new WorktreeOverrideValidationError([
      validationDiagnostic(
        "invalid-lifetime",
        "$.expiresAt",
        "The override lifetime must be a positive integer no longer than 24 hours.",
      ),
    ]);
  }

  const override = {
    schemaVersion: WORKTREE_OVERRIDE_SCHEMA_VERSION,
    worktreeId: gitContext.worktreeId,
    profile,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + durationMs).toISOString(),
  };
  const validation = validateWorktreeOverride(override, {
    expectedWorktreeId: gitContext.worktreeId,
  });
  if (!validation.ok) throw new WorktreeOverrideValidationError(validation.diagnostics);

  return withWorktreeOverrideLock(gitContext, () => {
    atomicWriteJson(getWorktreeOverridePath(gitContext), validation.value);
    return validation.value;
  });
}

function readWorktreeOverrideUnlocked(gitContext, options) {
  const overridePath = getWorktreeOverridePath(gitContext);
  let contents;
  try {
    contents = fs.readFileSync(overridePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { override: null, diagnostics: [], cleanedUp: false };
    }
    return {
      override: null,
      diagnostics: [
        worktreeWarning(
          validationDiagnostic(
            "read-failed",
            "$",
            `Could not read the worktree override: ${error instanceof Error ? error.message : String(error)}.`,
          ),
          overridePath,
        ),
      ],
      cleanedUp: false,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return {
      override: null,
      diagnostics: [
        worktreeWarning(
          validationDiagnostic("invalid-json", "$", "The worktree override is not valid JSON."),
          overridePath,
        ),
      ],
      cleanedUp: false,
    };
  }

  const validation = validateWorktreeOverride(parsed, {
    expectedWorktreeId: gitContext.worktreeId,
  });
  if (!validation.ok) {
    return {
      override: null,
      diagnostics: validation.diagnostics.map((diagnostic) =>
        worktreeWarning(diagnostic, overridePath),
      ),
      cleanedUp: false,
    };
  }

  const now = normalizeNow(options.now ?? Date.now());
  if (now < Date.parse(validation.value.expiresAt)) {
    return { override: validation.value, diagnostics: [], cleanedUp: false };
  }

  const diagnostics = [
    worktreeWarning(
      validationDiagnostic(
        "expired-worktree-override",
        "$.expiresAt",
        "The worktree override has expired.",
      ),
      overridePath,
    ),
  ];
  let cleanedUp = false;
  if (options.repositoryValidated === true) {
    try {
      fs.unlinkSync(overridePath);
      cleanedUp = true;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        diagnostics.push(
          worktreeWarning(
            validationDiagnostic(
              "cleanup-failed",
              "$",
              `Could not remove the expired override: ${error instanceof Error ? error.message : String(error)}.`,
            ),
            overridePath,
          ),
        );
      }
    }
  }

  return { override: null, diagnostics, cleanedUp };
}

export function readWorktreeOverride(gitContext, options = {}) {
  const overridePath = getWorktreeOverridePath(gitContext);
  if (!fs.existsSync(overridePath)) {
    return { override: null, diagnostics: [], cleanedUp: false };
  }

  return withWorktreeOverrideLock(gitContext, () =>
    readWorktreeOverrideUnlocked(gitContext, options),
  );
}

export function resetWorktreeOverride(gitContext) {
  const overridePath = getWorktreeOverridePath(gitContext);
  if (!fs.existsSync(overridePath)) return false;

  return withWorktreeOverrideLock(gitContext, () => {
    try {
      fs.unlinkSync(overridePath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  });
}
