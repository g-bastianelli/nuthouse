import { isDeepStrictEqual } from "node:util";

import { validateManifestHandoff } from "./manifest-schema.mjs";
import {
  getDecisionManifestPath,
  inspectDecisionManifest,
  writeDecisionManifest,
} from "./manifest-store.mjs";

const SUCCESSFUL_WORKFLOWS = new Set(["project-creation", "issue-delivery", "direct-task"]);
const DECISION_FIELDS = [
  "workflow",
  "requestedProfile",
  "riskFloor",
  "effectiveProfile",
  "normalizedEvidence",
  "activeRisks",
  "escalations",
  "enabledCapabilities",
];
const RECOVERABLE_STATUSES = new Set(["missing", "expired", "corrupt", "invalid", "out-of-scope"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function handoffError(code, message, details = {}) {
  return new ManifestHandoffError(message, { code, ...details });
}

function runtimeDrift(producerPolicyHash, consumerPolicyHash) {
  return handoffError(
    "runtime-drift",
    "The manifest producer and consumer use different workflow policy hashes.",
    { producerPolicyHash, consumerPolicyHash },
  );
}

function projectDecision(decision) {
  if (!isRecord(decision)) return null;
  return Object.fromEntries(DECISION_FIELDS.map((field) => [field, decision[field]]));
}

function assertAuthoritativeDecision(decision) {
  if (!isRecord(decision)) {
    throw handoffError(
      "invalid-workflow-resolution",
      "The authoritative resolver returned an invalid workflow decision.",
    );
  }
  if (decision.workflow === "ambiguous") {
    throw handoffError(
      "workflow-resolution-ambiguous",
      "The authoritative workflow resolution remained ambiguous.",
    );
  }
  if (!SUCCESSFUL_WORKFLOWS.has(decision.workflow)) {
    throw handoffError(
      "invalid-workflow-resolution",
      "The authoritative resolver returned an invalid workflow decision.",
    );
  }
  if (decision.blocked === true) {
    throw handoffError(
      "workflow-resolution-blocked",
      "The authoritative workflow resolution is blocked.",
    );
  }
  return decision;
}

function requireInspection(value) {
  if (!isRecord(value) || typeof value.status !== "string") {
    throw handoffError(
      "manifest-inspection-failed",
      "The manifest store returned an invalid inspection result.",
    );
  }
  return value;
}

function persistedResult(inspection, reused) {
  return {
    decision: inspection.manifest.decision,
    manifest: inspection.manifest,
    path: inspection.path,
    contentHash: inspection.contentHash,
    handoff: inspection.handoff,
    reused,
  };
}

function verifyPersistedReplacement({
  inspection,
  persisted,
  decision,
  policyHash,
  expectedPath,
  expectedRunId,
}) {
  if (
    inspection.status !== "valid" ||
    !isRecord(inspection.manifest) ||
    !isRecord(inspection.handoff) ||
    inspection.path !== expectedPath ||
    inspection.contentHash !== persisted.contentHash ||
    inspection.handoff.run_id !== expectedRunId ||
    inspection.handoff.path !== expectedPath ||
    inspection.handoff.content_hash !== persisted.contentHash
  ) {
    throw handoffError(
      "manifest-recovery-failed",
      "The replacement manifest could not be reopened and verified.",
      { status: inspection.status },
    );
  }
  if (inspection.manifest.policyHash !== policyHash) {
    throw runtimeDrift(inspection.manifest.policyHash, policyHash);
  }
  if (!isDeepStrictEqual(inspection.manifest.decision, projectDecision(decision))) {
    throw handoffError(
      "workflow-decision-disagreement",
      "The persisted replacement disagrees with the authoritative workflow decision.",
    );
  }
}

export class ManifestHandoffError extends Error {
  constructor(
    message,
    {
      code = "invalid-manifest-handoff",
      diagnostics,
      status,
      producerPolicyHash,
      consumerPolicyHash,
      cause,
    } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ManifestHandoffError";
    this.code = code;
    this.blocked = true;
    if (diagnostics !== undefined) this.diagnostics = diagnostics;
    if (status !== undefined) this.status = status;
    if (producerPolicyHash !== undefined) this.producerPolicyHash = producerPolicyHash;
    if (consumerPolicyHash !== undefined) this.consumerPolicyHash = consumerPolicyHash;
  }
}

export function consumeManifestHandoff(input, dependencies = {}) {
  if (!isRecord(input)) {
    throw new TypeError("consumeManifestHandoff requires an input object.");
  }

  const validateHandoff = dependencies.validateHandoff ?? validateManifestHandoff;
  const getManifestPath = dependencies.getManifestPath ?? getDecisionManifestPath;
  const inspectManifest = dependencies.inspectManifest ?? inspectDecisionManifest;
  const writeManifest = dependencies.writeManifest ?? writeDecisionManifest;
  const resolveAuthoritatively = dependencies.resolveAuthoritatively;

  for (const [name, dependency] of [
    ["validateHandoff", validateHandoff],
    ["getManifestPath", getManifestPath],
    ["inspectManifest", inspectManifest],
    ["writeManifest", writeManifest],
  ]) {
    if (typeof dependency !== "function") {
      throw new TypeError(`consumeManifestHandoff dependency ${name} must be a function.`);
    }
  }

  const validation = validateHandoff(input.handoff);
  if (!isRecord(validation) || validation.ok !== true) {
    throw handoffError("invalid-manifest-handoff", "The manifest handoff is invalid.", {
      diagnostics: validation?.diagnostics ?? [],
    });
  }
  const descriptor = validation.value;
  const expectedPath = getManifestPath(input.gitContext, descriptor.run_id);
  if (descriptor.path !== expectedPath) {
    throw handoffError(
      "manifest-handoff-out-of-scope",
      "The manifest handoff path does not match the current repository and run.",
    );
  }

  const inspection = requireInspection(
    inspectManifest(input.gitContext, descriptor.run_id, { now: input.now }),
  );

  if (isRecord(inspection.manifest) && inspection.manifest.policyHash !== input.policyHash) {
    throw runtimeDrift(inspection.manifest.policyHash, input.policyHash);
  }

  const contentHashMatches = inspection.contentHash === descriptor.content_hash;
  if (
    inspection.status === "valid" &&
    contentHashMatches &&
    isRecord(inspection.manifest) &&
    isRecord(inspection.handoff)
  ) {
    return persistedResult(inspection, true);
  }

  const recoveryReason =
    inspection.status === "valid" && !contentHashMatches
      ? "content-hash-mismatch"
      : inspection.status;
  if (!RECOVERABLE_STATUSES.has(inspection.status) && recoveryReason !== "content-hash-mismatch") {
    throw handoffError(
      "manifest-handoff-rejected",
      `The manifest handoff cannot be recovered from status ${inspection.status}.`,
      { status: inspection.status },
    );
  }
  if (typeof resolveAuthoritatively !== "function") {
    throw handoffError(
      "authoritative-resolution-required",
      "The invalid manifest requires one authoritative local workflow resolution.",
      { status: recoveryReason },
    );
  }

  const writeOptions = {
    expectedRevision: inspection.manifest?.revision ?? 0,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(inspection.contentHash === null || inspection.contentHash === undefined
      ? {}
      : { observedContentHash: inspection.contentHash }),
  };
  const replacement = input.replacement ?? {};
  const authoritativeResult = resolveAuthoritatively({
    reason: recoveryReason,
    runId: descriptor.run_id,
    gitContext: input.gitContext,
    policyHash: input.policyHash,
    currentManifest: inspection.manifest,
    expectedRevision: writeOptions.expectedRevision,
    observedContentHash: writeOptions.observedContentHash,
    now: input.now,
    replacement,
  });
  if (authoritativeResult instanceof Promise) {
    throw handoffError(
      "invalid-workflow-resolution",
      "The authoritative resolver must return a workflow decision synchronously.",
    );
  }

  const decision = assertAuthoritativeDecision(authoritativeResult);
  if (
    isRecord(inspection.manifest?.decision) &&
    !isDeepStrictEqual(inspection.manifest.decision, projectDecision(decision))
  ) {
    throw handoffError(
      "workflow-decision-disagreement",
      "The authoritative workflow decision disagrees with the prior manifest.",
      { status: recoveryReason },
    );
  }

  const persisted = writeManifest(
    input.gitContext,
    {
      runId: descriptor.run_id,
      policy: decision,
      policyHash: input.policyHash,
      artifacts: replacement.artifacts ?? [],
      expiresAt: replacement.expiresAt,
    },
    writeOptions,
  );
  if (
    !isRecord(persisted) ||
    !isRecord(persisted.manifest) ||
    !isRecord(persisted.handoff) ||
    persisted.path !== expectedPath ||
    persisted.handoff.run_id !== descriptor.run_id ||
    persisted.handoff.path !== expectedPath ||
    typeof persisted.contentHash !== "string" ||
    persisted.handoff.content_hash !== persisted.contentHash
  ) {
    throw handoffError(
      "manifest-recovery-failed",
      "The manifest store did not persist the authoritative replacement.",
    );
  }

  const reopened = requireInspection(
    inspectManifest(input.gitContext, descriptor.run_id, { now: input.now }),
  );
  verifyPersistedReplacement({
    inspection: reopened,
    persisted,
    decision,
    policyHash: input.policyHash,
    expectedPath,
    expectedRunId: descriptor.run_id,
  });
  return persistedResult(reopened, false);
}
