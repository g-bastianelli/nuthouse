import { resolveVerificationStrategy } from "./verification-resolution.mjs";

const PROFILES = new Set(["quick", "standard", "strict"]);
const CONTENT_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/u;
const SPEC_OWNER = "acid-prophet:write-spec";
const PLAN_OWNER = "acid-prophet:write-plan";
const MOON_REASONS = new Set([
  "changed",
  "upstream-of-changed",
  "downstream-of-changed",
  "planned",
]);
const NATIVE_SOURCES = new Set(["repository-instructions", "repository-build-metadata"]);
const GIT_OID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const VERIFIED_FILE_TYPES = new Set(["regular-file", "symlink", "deleted"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasControlCharacters(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 31 || codePoint === 127) return true;
  }
  return false;
}

function diagnostic(code, field, message) {
  return { code, source: "direct-task", field, message, blocked: true };
}

function blockedResult(base, diagnostics) {
  return {
    ...base,
    status: "blocked",
    handoffs: [],
    diagnostics,
    blocked: true,
  };
}

function handoffResult(base, handoff) {
  return {
    ...base,
    status: "handoff-required",
    handoffs: [handoff],
    diagnostics: [],
    blocked: true,
  };
}

function isSafeRelativePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    hasControlCharacters(value)
  ) {
    return false;
  }
  const segments = value.split("/");
  return !segments.includes("") && !segments.includes(".") && !segments.includes("..");
}

function pathContains(boundary, candidate) {
  return candidate === boundary || candidate.startsWith(`${boundary}/`);
}

function pathsOverlap(left, right) {
  return pathContains(left, right) || pathContains(right, left);
}

function isSafeAbsolutePath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value === "/" ||
    hasControlCharacters(value)
  ) {
    return false;
  }
  return value
    .split("/")
    .slice(1)
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isNormalizedNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !hasControlCharacters(value)
  );
}

function normalizeUniqueStrings(value, validate) {
  if (!Array.isArray(value)) return null;
  const normalized = [];
  const seen = new Set();
  for (const entry of value) {
    if (!validate(entry) || seen.has(entry)) return null;
    seen.add(entry);
    normalized.push(entry);
  }
  return normalized;
}

function normalizePaths(value, { allowEmpty = true } = {}) {
  const paths = normalizeUniqueStrings(value, isSafeRelativePath);
  if (paths === null || (!allowEmpty && paths.length === 0)) return null;
  return paths;
}

function normalizeNonEmptyStrings(value) {
  return normalizeUniqueStrings(value, isNormalizedNonEmptyString);
}

function sameMembers(left, right) {
  if (left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every((entry) => expected.has(entry));
}

function isInstructionPath(value) {
  if (!isSafeRelativePath(value)) return false;
  const basename = value.split("/").at(-1);
  return basename === "AGENTS.md" || basename === "CLAUDE.md";
}

function normalizeMoonScopeMap(value) {
  if (
    !isRecord(value) ||
    !isSafeAbsolutePath(value.moonRoot) ||
    !isNormalizedNonEmptyString(value.base) ||
    !isNormalizedNonEmptyString(value.summary)
  ) {
    return null;
  }
  const changedFiles = normalizePaths(value.changedFiles);
  const downstream = normalizeNonEmptyStrings(value.downstream);
  if (changedFiles === null || downstream === null || !Array.isArray(value.affected)) {
    return null;
  }

  if (value.summary === "_dark_") {
    if (changedFiles.length !== 0 || value.affected.length !== 0 || downstream.length !== 0) {
      return null;
    }
    return {
      status: "dark",
      map: {
        moonRoot: value.moonRoot,
        base: value.base,
        changedFiles,
        affected: [],
        downstream,
        summary: value.summary,
      },
    };
  }
  if (value.affected.length === 0) return null;

  const affected = [];
  const projectIds = new Set();
  for (const project of value.affected) {
    if (!isRecord(project)) return null;
    const tags = normalizeNonEmptyStrings(project.tags);
    const tasks = normalizeNonEmptyStrings(project.tasks);
    const validSource = project.source === "." || isSafeRelativePath(project.source);
    if (
      !isNormalizedNonEmptyString(project.id) ||
      projectIds.has(project.id) ||
      !validSource ||
      !isNormalizedNonEmptyString(project.layer) ||
      !isNormalizedNonEmptyString(project.stack) ||
      tags === null ||
      tasks === null ||
      !MOON_REASONS.has(project.reason)
    ) {
      return null;
    }
    projectIds.add(project.id);
    affected.push({
      id: project.id,
      source: project.source,
      layer: project.layer,
      stack: project.stack,
      tags,
      tasks,
      reason: project.reason,
    });
  }

  const planned = affected.some((project) => project.reason === "planned");
  if (
    (planned &&
      (value.base !== "planned-paths" ||
        changedFiles.length !== 0 ||
        affected.some((project) => project.reason !== "planned"))) ||
    (!planned && changedFiles.length === 0)
  ) {
    return null;
  }

  return {
    status: "ready",
    map: {
      moonRoot: value.moonRoot,
      base: value.base,
      changedFiles,
      affected,
      downstream,
      summary: value.summary,
    },
  };
}

function pathIsInsideProject(path, projectSource) {
  return projectSource === "." || path === projectSource || path.startsWith(`${projectSource}/`);
}

function normalizeHandoff(value) {
  const manifestSegments =
    isRecord(value) && typeof value.path === "string" ? value.path.split("/") : [];
  if (
    !isRecord(value) ||
    typeof value.run_id !== "string" ||
    !SAFE_ID_PATTERN.test(value.run_id) ||
    typeof value.path !== "string" ||
    !value.path.startsWith("/") ||
    hasControlCharacters(value.path) ||
    manifestSegments
      .slice(1)
      .some((segment) => segment === "" || segment === "." || segment === "..") ||
    !CONTENT_HASH_PATTERN.test(value.content_hash)
  ) {
    return null;
  }
  return {
    run_id: value.run_id,
    path: value.path,
    content_hash: value.content_hash,
  };
}

function sameHandoff(left, right) {
  return (
    left !== null &&
    right !== null &&
    left.run_id === right.run_id &&
    left.path === right.path &&
    left.content_hash === right.content_hash
  );
}

function normalizeScope(value) {
  if (!isRecord(value) || typeof value.moonWorkspace !== "boolean") return null;
  const approvedPaths = normalizePaths(value.approvedPaths, { allowEmpty: false });
  const protectedPaths = normalizePaths(value.protectedPaths ?? []);
  if (approvedPaths === null || protectedPaths === null) return null;
  if (
    approvedPaths.some((approved) =>
      protectedPaths.some((protectedPath) => pathsOverlap(approved, protectedPath)),
    )
  ) {
    return null;
  }

  const normalized = {
    approvedPaths,
    protectedPaths,
    moonWorkspace: value.moonWorkspace,
  };
  if (!value.moonWorkspace) return { status: "ready", scope: normalized };
  if (value.moon === undefined) return { status: "handoff", scope: normalized };
  const moonResult = normalizeMoonScopeMap(value.moon);
  if (moonResult === null) {
    return { status: "blocked", scope: normalized, code: "moon-scope-invalid" };
  }
  if (moonResult.status === "dark") {
    return {
      status: "planned-handoff",
      scope: { ...normalized, moon: moonResult.map },
    };
  }
  const moon = moonResult.map;
  if (
    approvedPaths.some(
      (entry) => !moon.affected.some((project) => pathIsInsideProject(entry, project.source)),
    )
  ) {
    return { status: "blocked", scope: normalized, code: "scope-outside-moon-graph" };
  }

  return {
    status: "ready",
    scope: {
      ...normalized,
      moon,
    },
    affectedProjectIds: [
      ...new Set([...moon.affected.map((project) => project.id), ...moon.downstream]),
    ],
  };
}

function hasReliableNativeProvenance(verification) {
  if (
    !isRecord(verification) ||
    verification.status !== "ready" ||
    verification.strategy !== "native" ||
    verification.verifier !== "repository-owned" ||
    !Array.isArray(verification.provenance)
  ) {
    return false;
  }
  const commands = normalizeNonEmptyStrings(verification.commands);
  if (
    commands === null ||
    commands.length === 0 ||
    verification.provenance.length !== commands.length
  ) {
    return false;
  }
  return verification.provenance.every((entry, index) => {
    if (
      !isRecord(entry) ||
      entry.command !== commands[index] ||
      !NATIVE_SOURCES.has(entry.source) ||
      !isSafeRelativePath(entry.path)
    ) {
      return false;
    }
    return entry.source !== "repository-instructions" || isInstructionPath(entry.path);
  });
}

function hasReliableMoonVerification(verification, affectedProjectIds) {
  if (
    !isRecord(verification) ||
    verification.status !== "ready" ||
    verification.strategy !== "specialized" ||
    verification.verifier !== "moon-moth:verify" ||
    !Array.isArray(verification.provenance) ||
    verification.provenance.length !== 0
  ) {
    return false;
  }
  const commands = normalizeNonEmptyStrings(verification.commands);
  const targets = normalizeNonEmptyStrings(verification.targets);
  return (
    commands !== null &&
    commands.length > 0 &&
    targets !== null &&
    sameMembers(targets, affectedProjectIds)
  );
}

function validateDecision(value) {
  if (!isRecord(value)) return "invalid-direct-task-decision";
  if (value.workflow !== "direct-task") return "invalid-direct-task-workflow";
  if (value.blocked !== false) return "blocked-direct-task-decision";
  if (!PROFILES.has(value.effectiveProfile)) return "invalid-direct-task-profile";
  if (
    !Array.isArray(value.enabledCapabilities) ||
    !value.enabledCapabilities.includes("verification")
  ) {
    return "missing-verification-gate";
  }
  return null;
}

function normalizeCompactPlan(value, scope, commands) {
  if (!isRecord(value)) return null;
  const affectedPaths = normalizePaths(value.affectedPaths, { allowEmpty: false });
  const steps = normalizeNonEmptyStrings(value.steps);
  const verificationCommands = normalizeNonEmptyStrings(value.verificationCommands);
  const risks = normalizeNonEmptyStrings(value.risks);
  if (
    affectedPaths === null ||
    steps === null ||
    steps.length === 0 ||
    verificationCommands === null ||
    risks === null ||
    risks.length === 0
  ) {
    return null;
  }
  const affectedSet = new Set(affectedPaths);
  const commandSet = new Set(verificationCommands);
  if (
    affectedPaths.length !== scope.approvedPaths.length ||
    !scope.approvedPaths.every((entry) => affectedSet.has(entry)) ||
    verificationCommands.length !== commands.length ||
    !commands.every((entry) => commandSet.has(entry))
  ) {
    return null;
  }
  return { affectedPaths, steps, verificationCommands, risks };
}

function artifactState(value, expected) {
  if (value === undefined) return "missing";
  if (!isRecord(value)) return "invalid";
  const handoff = normalizeHandoff(value.decisionHandoff);
  if (handoff === null || !sameHandoff(handoff, expected.decisionHandoff)) return "mismatch";
  if (
    typeof value.id !== "string" ||
    !SAFE_ID_PATTERN.test(value.id) ||
    !isSafeRelativePath(value.path) ||
    !CONTENT_HASH_PATTERN.test(value.contentHash) ||
    value.owner !== expected.owner ||
    value.status !== expected.status ||
    value.audited !== true
  ) {
    return "invalid";
  }
  return "ready";
}

function normalizeArtifact(value) {
  return {
    id: value.id,
    path: value.path,
    contentHash: value.contentHash,
    status: value.status,
    audited: value.audited,
    owner: value.owner,
    decisionHandoff: normalizeHandoff(value.decisionHandoff),
  };
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => keys.includes(key));
}

function directTaskReturnTarget() {
  return { kind: "current-turn", name: "direct-task" };
}

function moonScopeHandoff(scopedBase, mode) {
  return {
    skill: "moon-moth:scope",
    artifact: mode === "planned-paths" ? "planned-affected-scope" : "affected-scope",
    decisionHandoff: scopedBase.decisionHandoff,
    input: {
      schemaVersion: 1,
      workflow: "direct-task",
      mode,
      approvedPaths: scopedBase.scope.approvedPaths,
      decisionHandoff: scopedBase.decisionHandoff,
      returnTarget: directTaskReturnTarget(),
    },
  };
}

function strictOwnerHandoff(strictBase, skill, artifact, upstreamArtifacts = []) {
  return {
    skill,
    artifact,
    decisionHandoff: strictBase.decisionHandoff,
    input: {
      schemaVersion: 1,
      workflow: "direct-task",
      effectiveProfile: "strict",
      task: strictBase.task,
      scope: strictBase.scope,
      verification: strictBase.verification,
      decisionHandoff: strictBase.decisionHandoff,
      upstreamArtifacts,
      returnTarget: directTaskReturnTarget(),
    },
  };
}

export function prepareDirectTask(input = {}) {
  const emptyBase = {
    workflow: "direct-task",
    profile: null,
    task: null,
    decisionHandoff: null,
    scope: null,
    preparation: null,
    requiredArtifacts: [],
    artifacts: null,
    verification: null,
  };
  if (!isRecord(input)) {
    return blockedResult(emptyBase, [
      diagnostic("invalid-direct-task-input", "$", "Direct-task input must be an object."),
    ]);
  }
  emptyBase.profile = isRecord(input.decision) ? input.decision.effectiveProfile : null;

  if (!isNormalizedNonEmptyString(input.task)) {
    return blockedResult(emptyBase, [
      diagnostic(
        "invalid-direct-task-request",
        "$.task",
        "Direct-task preparation requires the exact non-empty task request.",
      ),
    ]);
  }
  emptyBase.task = input.task;

  const decisionError = validateDecision(input.decision);
  if (decisionError !== null) {
    return blockedResult(emptyBase, [
      diagnostic(
        decisionError,
        "$.decision",
        "A valid non-blocked direct-task decision is required.",
      ),
    ]);
  }
  const decisionHandoff = normalizeHandoff(input.decisionHandoff);
  const base = { ...emptyBase, profile: input.decision.effectiveProfile, decisionHandoff };
  if (decisionHandoff === null) {
    return blockedResult(base, [
      diagnostic(
        "invalid-decision-handoff",
        "$.decisionHandoff",
        "A valid run id, absolute manifest path, and content hash are required.",
      ),
    ]);
  }

  const scopeResult = normalizeScope(input.scope);
  if (scopeResult === null) {
    return blockedResult(base, [
      diagnostic(
        "invalid-direct-task-scope",
        "$.scope",
        "Scope requires non-empty approved paths and a disjoint protected path set.",
      ),
    ]);
  }
  const scopedBase = { ...base, scope: scopeResult.scope };
  if (scopeResult.status === "handoff") {
    return handoffResult(scopedBase, moonScopeHandoff(scopedBase, "affected-or-planned"));
  }
  if (scopeResult.status === "planned-handoff") {
    return handoffResult(scopedBase, moonScopeHandoff(scopedBase, "planned-paths"));
  }
  if (scopeResult.status === "blocked") {
    return blockedResult(scopedBase, [
      diagnostic(scopeResult.code, "$.scope.moon", "Moon affected scope is missing or invalid."),
    ]);
  }

  const verification = resolveVerificationStrategy({
    moonWorkspace: scopeResult.scope.moonWorkspace,
    specializedVerifier: input.specializedVerifier,
    nativeVerification: input.nativeVerification,
  });
  const verifiedBase = { ...scopedBase, verification };
  if (verification.blocked) return blockedResult(verifiedBase, verification.diagnostics);
  if (
    scopeResult.scope.moonWorkspace &&
    !hasReliableMoonVerification(verification, scopeResult.affectedProjectIds)
  ) {
    return blockedResult(verifiedBase, [
      diagnostic(
        "moon-verifier-target-mismatch",
        "$.specializedVerifier.targets",
        "Moon verification targets must match every project in the affected scope map.",
      ),
    ]);
  }
  if (!scopeResult.scope.moonWorkspace && !hasReliableNativeProvenance(verification)) {
    return blockedResult(verifiedBase, [
      diagnostic(
        "native-verification-provenance-required",
        "$.nativeVerification.sources",
        "Native verification requires repository-owned source paths for every command.",
      ),
    ]);
  }

  const artifacts = isRecord(input.artifacts) ? input.artifacts : {};
  if (input.decision.effectiveProfile === "quick") {
    return {
      ...verifiedBase,
      status: "ready",
      preparation: "ephemeral-scope",
      requiredArtifacts: [],
      artifacts: {},
      handoffs: [],
      diagnostics: [],
      blocked: false,
    };
  }

  if (input.decision.effectiveProfile === "standard") {
    const compactPlan = normalizeCompactPlan(
      artifacts.compactPlan,
      scopeResult.scope,
      verification.commands,
    );
    if (compactPlan === null) {
      return blockedResult(
        { ...verifiedBase, preparation: "compact-plan", requiredArtifacts: ["compact-plan"] },
        [
          diagnostic(
            "compact-plan-required",
            "$.artifacts.compactPlan",
            "Standard direct tasks require a compact plan covering scope, steps, checks, and risks.",
          ),
        ],
      );
    }
    return {
      ...verifiedBase,
      status: "ready",
      preparation: "compact-plan",
      requiredArtifacts: ["compact-plan"],
      artifacts: { compactPlan },
      handoffs: [],
      diagnostics: [],
      blocked: false,
    };
  }

  const strictBase = {
    ...verifiedBase,
    preparation: "audited-artifacts",
    requiredArtifacts: ["spec", "plan"],
  };
  const specState = artifactState(artifacts.spec, {
    owner: SPEC_OWNER,
    status: "ratified",
    decisionHandoff,
  });
  if (specState === "mismatch") {
    return blockedResult(strictBase, [
      diagnostic(
        "artifact-handoff-mismatch",
        "$.artifacts.spec.decisionHandoff",
        "The strict spec must preserve the direct-task decision identity.",
      ),
    ]);
  }
  if (specState !== "ready") {
    return handoffResult(strictBase, strictOwnerHandoff(strictBase, SPEC_OWNER, "spec"));
  }

  const planState = artifactState(artifacts.plan, {
    owner: PLAN_OWNER,
    status: "validated",
    decisionHandoff,
  });
  if (planState === "mismatch") {
    return blockedResult(strictBase, [
      diagnostic(
        "artifact-handoff-mismatch",
        "$.artifacts.plan.decisionHandoff",
        "The strict plan must preserve the direct-task decision identity.",
      ),
    ]);
  }
  if (planState !== "ready") {
    return handoffResult(
      strictBase,
      strictOwnerHandoff(strictBase, PLAN_OWNER, "plan", [normalizeArtifact(artifacts.spec)]),
    );
  }

  return {
    ...strictBase,
    status: "ready",
    artifacts: {
      spec: normalizeArtifact(artifacts.spec),
      plan: normalizeArtifact(artifacts.plan),
    },
    handoffs: [],
    diagnostics: [],
    blocked: false,
  };
}

function normalizeVerificationResults(value) {
  if (!Array.isArray(value)) return null;
  const results = [];
  const seen = new Set();
  for (const entry of value) {
    if (!isRecord(entry) || seen.has(entry.command)) return null;
    const targets = normalizeNonEmptyStrings(entry.targets);
    if (
      typeof entry.command !== "string" ||
      entry.command.trim() !== entry.command ||
      entry.command.length === 0 ||
      targets === null ||
      targets.length === 0 ||
      !Number.isSafeInteger(entry.exitStatus) ||
      entry.exitStatus < 0 ||
      typeof entry.summary !== "string" ||
      entry.summary.trim().length === 0 ||
      entry.summary.length > 2000 ||
      entry.summary.includes("\0")
    ) {
      return null;
    }
    seen.add(entry.command);
    results.push({
      command: entry.command,
      targets,
      exitStatus: entry.exitStatus,
      summary: entry.summary,
    });
  }
  return results;
}

function normalizeVerifiedFiles(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const files = [];
  const seen = new Set();
  for (const entry of value) {
    if (!isRecord(entry) || !isSafeRelativePath(entry.path) || seen.has(entry.path)) return null;
    const deleted = entry.type === "deleted";
    const validMode =
      (entry.type === "regular-file" && (entry.mode === "0644" || entry.mode === "0755")) ||
      (entry.type === "symlink" && entry.mode === "120000") ||
      (deleted && entry.mode === null);
    const validContentHash = deleted
      ? entry.verified_content_hash === null
      : CONTENT_HASH_PATTERN.test(entry.verified_content_hash);
    if (
      !VERIFIED_FILE_TYPES.has(entry.type) ||
      !validMode ||
      !validContentHash ||
      !(
        entry.before_hash === null ||
        (typeof entry.before_hash === "string" && CONTENT_HASH_PATTERN.test(entry.before_hash))
      )
    ) {
      return null;
    }
    seen.add(entry.path);
    files.push({
      path: entry.path,
      type: entry.type,
      mode: entry.mode,
      before_hash: entry.before_hash,
      verified_content_hash: entry.verified_content_hash,
    });
  }
  return files;
}

function normalizeSnapshot(value) {
  if (
    !isRecord(value) ||
    typeof value.head_oid !== "string" ||
    !GIT_OID_PATTERN.test(value.head_oid) ||
    typeof value.worktree_snapshot_hash !== "string" ||
    !CONTENT_HASH_PATTERN.test(value.worktree_snapshot_hash)
  ) {
    return null;
  }
  const changedPaths = normalizePaths(value.changed_paths, { allowEmpty: false });
  const verifiedFiles = normalizeVerifiedFiles(value.verified_files);
  if (
    changedPaths === null ||
    verifiedFiles === null ||
    changedPaths.some((changedPath) => !verifiedFiles.some((file) => file.path === changedPath))
  ) {
    return null;
  }
  return {
    head_oid: value.head_oid,
    worktree_snapshot_hash: value.worktree_snapshot_hash,
    changed_paths: changedPaths,
    verified_files: verifiedFiles,
  };
}

function normalizeEvidence(value) {
  if (
    !isRecord(value) ||
    typeof value.run_id !== "string" ||
    !SAFE_ID_PATTERN.test(value.run_id) ||
    typeof value.decision_content_hash !== "string" ||
    !CONTENT_HASH_PATTERN.test(value.decision_content_hash)
  ) {
    return null;
  }
  const snapshot = normalizeSnapshot(value);
  const results = normalizeVerificationResults(value.results);
  if (snapshot === null || results === null) return null;
  return {
    run_id: value.run_id,
    decision_content_hash: value.decision_content_hash,
    ...snapshot,
    results,
  };
}

function sameVerifiedFiles(left, right) {
  if (left.length !== right.length) return false;
  const expected = new Map(right.map((entry) => [entry.path, entry]));
  return left.every((entry) => {
    const match = expected.get(entry.path);
    return (
      match !== undefined &&
      entry.type === match.type &&
      entry.mode === match.mode &&
      entry.before_hash === match.before_hash &&
      entry.verified_content_hash === match.verified_content_hash
    );
  });
}

function validateReadyPreparation(value) {
  if (!isRecord(value)) return null;
  const decisionHandoff = normalizeHandoff(value.decisionHandoff);
  if (
    value.status !== "ready" ||
    value.blocked !== false ||
    value.workflow !== "direct-task" ||
    !PROFILES.has(value.profile) ||
    !isNormalizedNonEmptyString(value.task) ||
    decisionHandoff === null ||
    !Array.isArray(value.handoffs) ||
    value.handoffs.length !== 0 ||
    !Array.isArray(value.diagnostics) ||
    value.diagnostics.length !== 0
  ) {
    return null;
  }
  const requiredArtifacts = normalizeNonEmptyStrings(value.requiredArtifacts);
  const expectedPreparation = {
    quick: { preparation: "ephemeral-scope", requiredArtifacts: [] },
    standard: { preparation: "compact-plan", requiredArtifacts: ["compact-plan"] },
    strict: { preparation: "audited-artifacts", requiredArtifacts: ["spec", "plan"] },
  }[value.profile];
  if (
    requiredArtifacts === null ||
    value.preparation !== expectedPreparation.preparation ||
    !sameMembers(requiredArtifacts, expectedPreparation.requiredArtifacts)
  ) {
    return null;
  }

  const scopeResult = normalizeScope(value.scope);
  if (scopeResult === null || scopeResult.status !== "ready") return null;
  const verification = value.verification;
  const commands = isRecord(verification) ? normalizeNonEmptyStrings(verification.commands) : null;
  const targets = isRecord(verification) ? normalizeNonEmptyStrings(verification.targets) : null;
  if (
    !isRecord(verification) ||
    verification.blocked !== false ||
    !Array.isArray(verification.diagnostics) ||
    verification.diagnostics.length !== 0 ||
    commands === null ||
    commands.length === 0 ||
    targets === null ||
    targets.length === 0
  ) {
    return null;
  }

  const reliable = scopeResult.scope.moonWorkspace
    ? hasReliableMoonVerification(verification, scopeResult.affectedProjectIds)
    : hasReliableNativeProvenance(verification) && sameMembers(targets, ["repository"]);
  if (!reliable) return null;

  if (value.profile === "quick" && !hasExactKeys(value.artifacts, [])) return null;
  if (
    value.profile === "standard" &&
    (!hasExactKeys(value.artifacts, ["compactPlan"]) ||
      normalizeCompactPlan(value.artifacts.compactPlan, scopeResult.scope, commands) === null)
  ) {
    return null;
  }
  if (
    value.profile === "strict" &&
    (!hasExactKeys(value.artifacts, ["spec", "plan"]) ||
      artifactState(value.artifacts.spec, {
        owner: SPEC_OWNER,
        status: "ratified",
        decisionHandoff,
      }) !== "ready" ||
      artifactState(value.artifacts.plan, {
        owner: PLAN_OWNER,
        status: "validated",
        decisionHandoff,
      }) !== "ready")
  ) {
    return null;
  }
  return { decisionHandoff, scope: scopeResult.scope, commands, targets };
}

export function evaluateDirectTaskCompletion(input = {}) {
  const base = { status: "blocked", evidence: null, diagnostics: [], blocked: true };
  if (!isRecord(input) || !isRecord(input.preparation) || input.preparation.status !== "ready") {
    return {
      ...base,
      diagnostics: [
        diagnostic(
          "direct-task-not-prepared",
          "$.preparation",
          "Completion requires a ready direct-task preparation result.",
        ),
      ],
    };
  }
  const preparation = validateReadyPreparation(input.preparation);
  if (preparation === null) {
    return {
      ...base,
      diagnostics: [
        diagnostic(
          "invalid-direct-task-preparation",
          "$.preparation",
          "The ready direct-task preparation is malformed or lacks a reliable verification strategy.",
        ),
      ],
    };
  }

  const changedPaths = normalizePaths(input.changedPaths ?? [], { allowEmpty: false });
  if (changedPaths === null) {
    return {
      ...base,
      diagnostics: [
        diagnostic(
          "invalid-changed-paths",
          "$.changedPaths",
          "Completion requires at least one normalized changed path.",
        ),
      ],
    };
  }
  if (
    changedPaths.some(
      (entry) =>
        !preparation.scope.approvedPaths.some((boundary) => pathContains(boundary, entry)) ||
        preparation.scope.protectedPaths.some((boundary) => pathsOverlap(boundary, entry)),
    )
  ) {
    return {
      ...base,
      diagnostics: [
        diagnostic(
          "implementation-scope-expanded",
          "$.changedPaths",
          "Implementation changed a path outside the approved boundary or inside protected context.",
        ),
      ],
    };
  }

  const evidence = normalizeEvidence(input.evidence);
  if (evidence === null) {
    return {
      ...base,
      diagnostics: [
        diagnostic(
          "invalid-verification-evidence",
          "$.evidence",
          "Verification evidence must record unique commands, targets, exit status, and a bounded summary.",
        ),
      ],
    };
  }
  const currentSnapshot = normalizeSnapshot(input.currentSnapshot);
  const snapshotPaths =
    currentSnapshot === null ? [] : currentSnapshot.verified_files.map((file) => file.path);
  if (
    currentSnapshot === null ||
    evidence.run_id !== preparation.decisionHandoff.run_id ||
    evidence.decision_content_hash !== preparation.decisionHandoff.content_hash ||
    evidence.head_oid !== currentSnapshot.head_oid ||
    evidence.worktree_snapshot_hash !== currentSnapshot.worktree_snapshot_hash ||
    !sameMembers(evidence.changed_paths, currentSnapshot.changed_paths) ||
    !sameMembers(currentSnapshot.changed_paths, snapshotPaths) ||
    changedPaths.some((path) => !currentSnapshot.changed_paths.includes(path)) ||
    currentSnapshot.changed_paths.some(
      (path) =>
        !changedPaths.includes(path) &&
        !preparation.scope.protectedPaths.some((boundary) => pathContains(boundary, path)),
    ) ||
    !sameVerifiedFiles(evidence.verified_files, currentSnapshot.verified_files)
  ) {
    return {
      ...base,
      evidence,
      diagnostics: [
        diagnostic(
          "verification-snapshot-mismatch",
          "$.currentSnapshot",
          "Verification evidence must bind the same workflow run and exact current Git snapshot.",
        ),
      ],
    };
  }
  const expectedCommands = preparation.commands;
  const expectedTargets = preparation.targets;
  const byCommand = new Map(evidence.results.map((entry) => [entry.command, entry]));
  const complete =
    evidence.results.length === expectedCommands.length &&
    expectedCommands.every((command) => {
      const entry = byCommand.get(command);
      return entry !== undefined && sameMembers(entry.targets, expectedTargets);
    });
  if (!complete) {
    return {
      ...base,
      evidence,
      diagnostics: [
        diagnostic(
          "verification-evidence-incomplete",
          "$.evidence",
          "Evidence must match every selected command and affected target exactly.",
        ),
      ],
    };
  }

  if (evidence.results.some((entry) => entry.exitStatus !== 0)) {
    return {
      ...base,
      evidence,
      diagnostics: [
        diagnostic(
          "verification-command-failed",
          "$.evidence",
          "At least one required verification command failed.",
        ),
      ],
    };
  }

  return { status: "completed", evidence, diagnostics: [], blocked: false };
}
