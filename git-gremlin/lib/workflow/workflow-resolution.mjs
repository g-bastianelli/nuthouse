import { CAPABILITY_CONSUMERS } from "./capability-resolver.mjs";
import { writeDecisionManifest } from "./manifest-store.mjs";
import { resolveWorkflowPolicy } from "./policy-resolution.mjs";

const SUCCESSFUL_WORKFLOWS = new Set(CAPABILITY_CONSUMERS);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolutionError(code, message, details = {}) {
  return new WorkflowDecisionError(message, { code, ...details });
}

function assertSuccessfulDecision(decision) {
  if (!isRecord(decision)) {
    throw resolutionError(
      "invalid-workflow-resolution",
      "The workflow policy resolver returned an invalid decision.",
    );
  }
  if (decision.workflow === "ambiguous") {
    throw resolutionError(
      "workflow-resolution-ambiguous",
      "The workflow decision is ambiguous and cannot be persisted.",
      { decision },
    );
  }
  if (!SUCCESSFUL_WORKFLOWS.has(decision.workflow)) {
    throw resolutionError(
      "invalid-workflow-resolution",
      "The workflow policy resolver returned an invalid decision.",
      { decision },
    );
  }
  if (decision.blocked === true) {
    throw resolutionError(
      "workflow-resolution-blocked",
      "The workflow decision is blocked and cannot be persisted.",
      { decision },
    );
  }
  return decision;
}

export class WorkflowDecisionError extends Error {
  constructor(message, { code, decision } = {}) {
    super(message);
    this.name = "WorkflowDecisionError";
    this.code = code ?? "invalid-workflow-resolution";
    this.blocked = true;
    if (decision !== undefined) this.decision = decision;
  }
}

export function resolveWorkflowDecision(input, dependencies = {}) {
  if (!isRecord(input) || !isRecord(input.policyInput)) {
    throw new TypeError("resolveWorkflowDecision requires an input with policyInput.");
  }

  const resolvePolicy = dependencies.resolvePolicy ?? resolveWorkflowPolicy;
  const writeManifest = dependencies.writeManifest ?? writeDecisionManifest;
  if (typeof resolvePolicy !== "function" || typeof writeManifest !== "function") {
    throw new TypeError("resolveWorkflowDecision dependencies must be functions.");
  }

  if (input.policyInput.workflow === "ambiguous") {
    throw resolutionError(
      "workflow-resolution-ambiguous",
      "The workflow decision is ambiguous and cannot be persisted.",
    );
  }
  if (!SUCCESSFUL_WORKFLOWS.has(input.policyInput.workflow)) {
    throw resolutionError(
      "invalid-workflow-resolution",
      "The workflow policy input contains an invalid workflow.",
    );
  }

  const decision = assertSuccessfulDecision(resolvePolicy(input.policyInput));
  const manifestInput = {
    runId: input.runId,
    policy: decision,
    policyHash: input.policyHash,
    expiresAt: input.expiresAt,
    ...(input.artifacts === undefined ? {} : { artifacts: input.artifacts }),
  };
  const writeOptions = {
    expectedRevision: input.expectedRevision ?? 0,
    ...(input.now === undefined ? {} : { now: input.now }),
    ...(input.observedContentHash === undefined
      ? {}
      : { observedContentHash: input.observedContentHash }),
  };
  const persisted = writeManifest(input.gitContext, manifestInput, writeOptions);

  if (
    !isRecord(persisted) ||
    !isRecord(persisted.manifest) ||
    !isRecord(persisted.handoff) ||
    typeof persisted.path !== "string" ||
    typeof persisted.contentHash !== "string"
  ) {
    throw resolutionError(
      "manifest-persistence-failed",
      "The manifest store did not return a persisted workflow decision.",
    );
  }

  return { ...persisted, decision: persisted.manifest.decision };
}
