import { CAPABILITY_CONSUMERS, resolveCapabilities } from "./capability-resolver.mjs";
import { isWorkflowProfile } from "./configuration.mjs";
import { evaluateRisk } from "./risk-evaluator.mjs";

const CAPABILITY_CONSUMER_SET = new Set(CAPABILITY_CONSUMERS);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneEntries(values) {
  return values.map((value) => (isRecord(value) ? { ...value } : value));
}

function validateConfiguration(configuration) {
  if (
    !isRecord(configuration) ||
    !isWorkflowProfile(configuration.requestedProfile) ||
    !Array.isArray(configuration.configurationSources) ||
    !Array.isArray(configuration.diagnostics)
  ) {
    throw new TypeError(
      "resolveWorkflowPolicy requires an existing resolved workflow configuration.",
    );
  }
}

export function resolveWorkflowPolicy(input) {
  if (!isRecord(input)) {
    throw new TypeError("resolveWorkflowPolicy requires an input object.");
  }

  validateConfiguration(input.configuration);
  if (!CAPABILITY_CONSUMER_SET.has(input.workflow)) {
    throw new TypeError(`workflow must be one of: ${CAPABILITY_CONSUMERS.join(", ")}.`);
  }

  const risk = evaluateRisk({
    requestedProfile: input.configuration.requestedProfile,
    evidence: input.riskEvidence === undefined ? [] : input.riskEvidence,
  });
  const capabilities = resolveCapabilities({
    workflow: input.workflow,
    effectiveProfile: risk.effectiveProfile,
    activeRisks: risk.activeRisks,
    ...(input.capabilities === undefined ? {} : { capabilities: input.capabilities }),
  });

  return {
    workflow: input.workflow,
    requestedProfile: risk.requestedProfile,
    riskFloor: risk.riskFloor,
    effectiveProfile: risk.effectiveProfile,
    configurationSources: cloneEntries(input.configuration.configurationSources),
    configurationDiagnostics: cloneEntries(input.configuration.diagnostics),
    normalizedEvidence: risk.normalizedEvidence,
    activeRisks: risk.activeRisks,
    escalations: risk.escalations,
    enabledCapabilities: capabilities.enabledCapabilities,
    resolvedCapabilities: capabilities.resolvedCapabilities,
    diagnostics: [...risk.diagnostics, ...capabilities.diagnostics],
    blocked:
      input.configuration.blocked === true ||
      risk.blocked === true ||
      capabilities.blocked === true,
  };
}
