import { classifyWorkflow, isWorkflowClassification } from "./classification.mjs";
import { isWorkflowProfile, resolveConfiguration } from "./configuration.mjs";
import { resolveWorkflowPolicy } from "./policy-resolution.mjs";

export const WORKFLOW_RUNTIME_ADAPTERS = Object.freeze(["claude-code", "codex"]);

const RUNTIME_ADAPTER_SET = new Set(WORKFLOW_RUNTIME_ADAPTERS);
const DECISION_ARRAY_FIELDS = [
  "configurationSources",
  "configurationDiagnostics",
  "normalizedEvidence",
  "activeRisks",
  "escalations",
  "enabledCapabilities",
  "resolvedCapabilities",
  "diagnostics",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function configurationInput(runtime, value) {
  const configuration = isRecord(value) ? value : {};
  if (runtime === "claude-code") {
    return {
      ...(configuration.projectRoot === undefined
        ? {}
        : { projectRoot: configuration.projectRoot }),
      ...(configuration.personalConfigPath === undefined
        ? {}
        : { personalConfigPath: configuration.personalConfigPath }),
      ...(configuration.repositoryConfigPath === undefined
        ? {}
        : { repositoryConfigPath: configuration.repositoryConfigPath }),
      ...(configuration.invocationProfile === undefined
        ? {}
        : { invocationProfile: configuration.invocationProfile }),
      ...(configuration.worktreeOverride === undefined
        ? {}
        : { worktreeOverride: configuration.worktreeOverride }),
      ...(configuration.now === undefined ? {} : { now: configuration.now }),
    };
  }

  return {
    ...(configuration.project_root === undefined
      ? {}
      : { projectRoot: configuration.project_root }),
    ...(configuration.personal_config_path === undefined
      ? {}
      : { personalConfigPath: configuration.personal_config_path }),
    ...(configuration.repository_config_path === undefined
      ? {}
      : { repositoryConfigPath: configuration.repository_config_path }),
    ...(configuration.invocation_profile === undefined
      ? {}
      : { invocationProfile: configuration.invocation_profile }),
    ...(configuration.worktree_override === undefined
      ? {}
      : { worktreeOverride: configuration.worktree_override }),
    ...(configuration.now === undefined ? {} : { now: configuration.now }),
  };
}

export function normalizeRuntimeWorkflowInput(runtime, input) {
  if (!RUNTIME_ADAPTER_SET.has(runtime)) {
    throw new TypeError(`runtime must be one of: ${WORKFLOW_RUNTIME_ADAPTERS.join(", ")}.`);
  }
  if (!isRecord(input)) throw new TypeError("Runtime workflow input must be an object.");

  if (runtime === "claude-code") {
    return {
      projectIntent: input.projectIntent,
      request: input.request ?? "",
      branch: input.branch ?? "",
      linearTeamKeys: isRecord(input.linear) ? input.linear.teamKeys : null,
      configuration: configurationInput(runtime, input.configuration),
      riskEvidence: input.riskEvidence ?? [],
      ...(input.capabilities === undefined ? {} : { capabilities: input.capabilities }),
    };
  }

  return {
    projectIntent: input.project_intent,
    request: input.prompt ?? "",
    branch: isRecord(input.git) ? (input.git.branch ?? "") : "",
    linearTeamKeys: isRecord(input.linear) ? input.linear.team_keys : null,
    configuration: configurationInput(runtime, input.configuration),
    riskEvidence: input.risk_evidence ?? [],
    ...(input.capabilities === undefined ? {} : { capabilities: input.capabilities }),
  };
}

export function normalizeWorkflowDecision(value) {
  if (!isRecord(value) || !isWorkflowClassification(value.workflow)) {
    throw new TypeError("Workflow decision has an invalid workflow.");
  }
  for (const field of ["requestedProfile", "riskFloor", "effectiveProfile"]) {
    if (!isWorkflowProfile(value[field])) {
      throw new TypeError(`Workflow decision has an invalid ${field}.`);
    }
  }
  for (const field of DECISION_ARRAY_FIELDS) {
    if (!Array.isArray(value[field])) {
      throw new TypeError(`Workflow decision has an invalid ${field}.`);
    }
  }
  if (typeof value.blocked !== "boolean") {
    throw new TypeError("Workflow decision has an invalid blocked field.");
  }

  return {
    workflow: value.workflow,
    requestedProfile: value.requestedProfile,
    riskFloor: value.riskFloor,
    effectiveProfile: value.effectiveProfile,
    configurationSources: cloneJsonValue(value.configurationSources),
    configurationDiagnostics: cloneJsonValue(value.configurationDiagnostics),
    normalizedEvidence: cloneJsonValue(value.normalizedEvidence),
    activeRisks: cloneJsonValue(value.activeRisks),
    escalations: cloneJsonValue(value.escalations),
    enabledCapabilities: cloneJsonValue(value.enabledCapabilities),
    resolvedCapabilities: cloneJsonValue(value.resolvedCapabilities),
    diagnostics: cloneJsonValue(value.diagnostics),
    blocked: value.blocked,
  };
}

export function normalizeDecisionJson(value) {
  const decision = isRecord(value) && Object.hasOwn(value, "decision") ? value.decision : value;
  return JSON.stringify(normalizeWorkflowDecision(decision));
}

export function resolveRuntimeWorkflow(runtime, input, dependencies = {}) {
  const normalized = normalizeRuntimeWorkflowInput(runtime, input);
  const resolveWorkflowConfiguration = dependencies.resolveConfiguration ?? resolveConfiguration;
  const resolvePolicy = dependencies.resolveWorkflowPolicy ?? resolveWorkflowPolicy;
  const classify = dependencies.classifyWorkflow ?? classifyWorkflow;
  const workflow = classify({
    projectIntent: normalized.projectIntent,
    request: normalized.request,
    branch: normalized.branch,
    linearTeamKeys: normalized.linearTeamKeys,
  });

  if (workflow === "ambiguous") {
    const configuration = resolveWorkflowConfiguration(normalized.configuration);
    return normalizeWorkflowDecision({
      workflow,
      requestedProfile: configuration.requestedProfile,
      riskFloor: "quick",
      effectiveProfile: configuration.requestedProfile,
      configurationSources: configuration.configurationSources,
      configurationDiagnostics: configuration.diagnostics,
      normalizedEvidence: [],
      activeRisks: [],
      escalations: [],
      enabledCapabilities: [],
      resolvedCapabilities: [],
      diagnostics: [
        {
          code: "workflow-resolution-ambiguous",
          source: "runtime",
          field: "$.workflow",
          message: "Normalized runtime inputs did not resolve one workflow.",
          blocked: true,
        },
      ],
      blocked: true,
    });
  }

  const configuration = resolveWorkflowConfiguration(normalized.configuration);
  return normalizeWorkflowDecision(
    resolvePolicy({
      configuration,
      workflow,
      riskEvidence: normalized.riskEvidence,
      ...(normalized.capabilities === undefined ? {} : { capabilities: normalized.capabilities }),
    }),
  );
}

function explicitDecision(input, options) {
  const resolveExplicit =
    options.resolveExplicit ??
    ((explicitInput) => resolveRuntimeWorkflow("claude-code", explicitInput));
  return normalizeWorkflowDecision(resolveExplicit(input));
}

export function resolveClaudeWorkflow(input, options = {}) {
  let fallbackReason = "hook-missing";

  if (typeof options.resolveHook === "function") {
    let hookValue;
    try {
      hookValue = options.resolveHook(normalizeRuntimeWorkflowInput("claude-code", input));
    } catch {
      fallbackReason = "hook-failed";
    }

    if (hookValue !== undefined) {
      let hookDecision;
      try {
        hookDecision = normalizeWorkflowDecision(hookValue);
      } catch {
        fallbackReason = "hook-invalid";
      }

      if (hookDecision !== undefined) {
        const canonicalDecision = explicitDecision(input, options);
        if (normalizeDecisionJson(hookDecision) === normalizeDecisionJson(canonicalDecision)) {
          return {
            decision: canonicalDecision,
            source: "hook",
            fallbackReason: null,
          };
        }

        return {
          decision: canonicalDecision,
          source: "explicit-skill",
          fallbackReason: "hook-policy-mismatch",
        };
      }
    }
  }

  return {
    decision: explicitDecision(input, options),
    source: "explicit-skill",
    fallbackReason,
  };
}

export function resolveCodexWorkflow(input, options = {}) {
  const resolveExplicit =
    options.resolveExplicit ?? ((explicitInput) => resolveRuntimeWorkflow("codex", explicitInput));
  return {
    decision: normalizeWorkflowDecision(resolveExplicit(input)),
    source: "explicit-skill",
    fallbackReason: null,
  };
}
