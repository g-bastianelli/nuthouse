import { WORKFLOW_PROFILES, isWorkflowProfile } from "./configuration.mjs";
import { RISK_CATEGORIES, isRiskCategory } from "./risk-evaluator.mjs";

export const CAPABILITY_CONSUMERS = Object.freeze([
  "project-creation",
  "issue-delivery",
  "direct-task",
]);

export const IMMUTABLE_GATE_IDS = Object.freeze([
  "verification",
  "external-mutation",
  "pr-review",
  "human-acceptance",
  "destructive-operation",
]);

const CAPABILITY_CONSUMER_SET = new Set(CAPABILITY_CONSUMERS);
const CAPABILITY_FIELDS = new Set([
  "id",
  "consumers",
  "prerequisites",
  "minimumProfile",
  "riskTriggers",
  "immutable",
]);
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const PROFILE_RANK = new Map(WORKFLOW_PROFILES.map((profile, index) => [profile, index]));
const CONSUMER_RANK = new Map(CAPABILITY_CONSUMERS.map((consumer, index) => [consumer, index]));
const RISK_RANK = new Map(RISK_CATEGORIES.map((risk, index) => [risk, index]));

function immutableGate(id) {
  return Object.freeze({
    id,
    consumers: Object.freeze([...CAPABILITY_CONSUMERS]),
    prerequisites: Object.freeze([]),
    minimumProfile: "quick",
    riskTriggers: Object.freeze([]),
    immutable: true,
  });
}

export const DEFAULT_CAPABILITY_GRAPH = Object.freeze(IMMUTABLE_GATE_IDS.map(immutableGate));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function diagnostic(code, field, message, details = {}) {
  return {
    code,
    source: "capability",
    field,
    message,
    blocked: true,
    ...details,
  };
}

function hasDuplicates(values) {
  return new Set(values).size !== values.length;
}

function normalizeStringArray(value, { field, allowEmpty = true, validate, code, message }) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    return { diagnostics: [diagnostic(code, field, message)] };
  }
  if (
    value.some((entry) => typeof entry !== "string" || !validate(entry)) ||
    hasDuplicates(value)
  ) {
    return { diagnostics: [diagnostic(code, field, message)] };
  }

  return { value: [...value].sort(), diagnostics: [] };
}

function normalizeCapability(value, index) {
  const baseField = `$.capabilities[${index}]`;
  if (!isRecord(value)) {
    return {
      diagnostics: [
        diagnostic("invalid-capability", baseField, "Capability declarations must be objects."),
      ],
    };
  }

  const unknownFields = Object.keys(value).filter((field) => !CAPABILITY_FIELDS.has(field));
  if (unknownFields.length > 0) {
    const field = unknownFields.sort()[0];
    return {
      diagnostics: [
        diagnostic(
          "unknown-capability-field",
          `${baseField}.${field}`,
          `Unknown capability field: ${field}.`,
        ),
      ],
    };
  }

  if (typeof value.id !== "string" || !CAPABILITY_ID_PATTERN.test(value.id)) {
    return {
      diagnostics: [
        diagnostic(
          "invalid-capability-id",
          `${baseField}.id`,
          "Capability ids must be lowercase kebab-case identifiers.",
        ),
      ],
    };
  }

  const consumers = normalizeStringArray(value.consumers, {
    field: `${baseField}.consumers`,
    allowEmpty: false,
    validate: (entry) => CAPABILITY_CONSUMER_SET.has(entry),
    code: "invalid-capability-consumer",
    message: `Capability consumers must contain unique values from: ${CAPABILITY_CONSUMERS.join(", ")}.`,
  });
  const prerequisites = normalizeStringArray(value.prerequisites, {
    field: `${baseField}.prerequisites`,
    validate: (entry) => CAPABILITY_ID_PATTERN.test(entry),
    code: "invalid-capability-prerequisite",
    message: "Capability prerequisites must contain unique capability ids.",
  });
  const riskTriggers = normalizeStringArray(value.riskTriggers, {
    field: `${baseField}.riskTriggers`,
    validate: isRiskCategory,
    code: "invalid-capability-risk-trigger",
    message: "Capability risk triggers must contain unique normalized risk categories.",
  });
  const diagnostics = [
    ...consumers.diagnostics,
    ...prerequisites.diagnostics,
    ...riskTriggers.diagnostics,
  ];

  if (!isWorkflowProfile(value.minimumProfile)) {
    diagnostics.push(
      diagnostic(
        "invalid-capability-profile",
        `${baseField}.minimumProfile`,
        `Capability minimumProfile must be one of: ${WORKFLOW_PROFILES.join(", ")}.`,
      ),
    );
  }
  if (typeof value.immutable !== "boolean") {
    diagnostics.push(
      diagnostic(
        "invalid-capability-immutability",
        `${baseField}.immutable`,
        "Capability immutable must be a boolean.",
      ),
    );
  }

  if (diagnostics.length > 0) return { diagnostics };

  return {
    capability: {
      id: value.id,
      consumers: consumers.value.sort(
        (left, right) => CONSUMER_RANK.get(left) - CONSUMER_RANK.get(right),
      ),
      prerequisites: prerequisites.value,
      minimumProfile: value.minimumProfile,
      riskTriggers: riskTriggers.value.sort(
        (left, right) => RISK_RANK.get(left) - RISK_RANK.get(right),
      ),
      immutable: value.immutable,
    },
    diagnostics: [],
  };
}

function findCycle(capabilities) {
  const byId = new Map(capabilities.map((capability) => [capability.id, capability]));
  const visiting = new Set();
  const visited = new Set();
  const path = [];

  function visit(id) {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      return [...path.slice(start), id];
    }
    if (visited.has(id)) return null;

    visiting.add(id);
    path.push(id);
    for (const prerequisite of byId.get(id).prerequisites) {
      const cycle = visit(prerequisite);
      if (cycle !== null) return cycle;
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const { id } of capabilities) {
    const cycle = visit(id);
    if (cycle !== null) return cycle;
  }
  return null;
}

export function validateCapabilityGraph(value) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      capabilities: [],
      diagnostics: [
        diagnostic(
          "invalid-capability-graph",
          "$.capabilities",
          "The capability graph must be an array.",
        ),
      ],
    };
  }

  const capabilities = [];
  const diagnostics = [];
  const seenIds = new Set();

  value.forEach((entry, index) => {
    const result = normalizeCapability(entry, index);
    diagnostics.push(...result.diagnostics);
    if (result.capability === undefined) return;

    if (seenIds.has(result.capability.id)) {
      diagnostics.push(
        diagnostic(
          "duplicate-capability-id",
          `$.capabilities[${index}].id`,
          `Capability id ${result.capability.id} is declared more than once.`,
          { capability: result.capability.id },
        ),
      );
      return;
    }
    seenIds.add(result.capability.id);
    capabilities.push(result.capability);
  });

  capabilities.sort((left, right) => left.id.localeCompare(right.id));
  if (diagnostics.length > 0) return { ok: false, capabilities: [], diagnostics };

  for (const capability of capabilities) {
    for (const prerequisite of capability.prerequisites) {
      if (seenIds.has(prerequisite)) continue;
      diagnostics.push(
        diagnostic(
          "unknown-capability-prerequisite",
          `$.capabilities.${capability.id}.prerequisites`,
          `Capability ${capability.id} requires unknown capability ${prerequisite}.`,
          { capability: capability.id, prerequisite },
        ),
      );
    }
  }
  if (diagnostics.length > 0) return { ok: false, capabilities: [], diagnostics };

  const cycle = findCycle(capabilities);
  if (cycle !== null) {
    return {
      ok: false,
      capabilities: [],
      diagnostics: [
        diagnostic(
          "capability-cycle",
          "$.capabilities",
          `Capability prerequisites contain a cycle: ${cycle.join(" -> ")}.`,
          { cycle },
        ),
      ],
    };
  }

  return { ok: true, capabilities, diagnostics: [] };
}

function blockedResult(diagnostics) {
  return {
    enabledCapabilities: [],
    resolvedCapabilities: [],
    diagnostics,
    blocked: true,
  };
}

function topologicalOrder(selectedIds, byId) {
  const selectedSet = new Set(selectedIds);
  const indegree = new Map();
  const dependents = new Map();

  for (const id of selectedSet) {
    const prerequisites = byId
      .get(id)
      .prerequisites.filter((prerequisite) => selectedSet.has(prerequisite));
    indegree.set(id, prerequisites.length);
    for (const prerequisite of prerequisites) {
      const entries = dependents.get(prerequisite) ?? [];
      entries.push(id);
      dependents.set(prerequisite, entries);
    }
  }

  const ready = [...selectedSet].filter((id) => indegree.get(id) === 0).sort();
  const ordered = [];
  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(id);
    for (const dependent of (dependents.get(id) ?? []).sort()) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  return ordered;
}

export function resolveCapabilities(input) {
  if (!isRecord(input)) {
    throw new TypeError("resolveCapabilities requires an input object.");
  }
  if (!CAPABILITY_CONSUMER_SET.has(input.workflow)) {
    throw new TypeError(`workflow must be one of: ${CAPABILITY_CONSUMERS.join(", ")}.`);
  }
  if (!isWorkflowProfile(input.effectiveProfile)) {
    throw new TypeError(`effectiveProfile must be one of: ${WORKFLOW_PROFILES.join(", ")}.`);
  }

  const activeRisks = input.activeRisks ?? [];
  if (!Array.isArray(activeRisks) || activeRisks.some((risk) => !isRiskCategory(risk))) {
    throw new TypeError("activeRisks must contain normalized risk categories.");
  }
  const activeRiskSet = new Set(activeRisks);
  const validation = validateCapabilityGraph(input.capabilities ?? DEFAULT_CAPABILITY_GRAPH);
  if (!validation.ok) return blockedResult(validation.diagnostics);

  const byId = new Map(validation.capabilities.map((capability) => [capability.id, capability]));
  const immutableDiagnostics = [];
  for (const gateId of IMMUTABLE_GATE_IDS) {
    const gate = byId.get(gateId);
    if (gate?.immutable === true && gate.consumers.includes(input.workflow)) continue;
    immutableDiagnostics.push(
      diagnostic(
        "missing-immutable-gate",
        "$.capabilities",
        `Required immutable gate ${gateId} is missing for ${input.workflow}.`,
        { capability: gateId, workflow: input.workflow },
      ),
    );
  }
  if (immutableDiagnostics.length > 0) return blockedResult(immutableDiagnostics);

  const reasonsById = new Map();
  for (const capability of validation.capabilities) {
    if (!capability.consumers.includes(input.workflow)) continue;

    if (capability.immutable) {
      reasonsById.set(capability.id, [{ kind: "immutable" }]);
      continue;
    }

    const profileApplies =
      PROFILE_RANK.get(input.effectiveProfile) >= PROFILE_RANK.get(capability.minimumProfile);
    if (!profileApplies) continue;

    if (capability.riskTriggers.length === 0) {
      reasonsById.set(capability.id, [
        { kind: "profile", minimumProfile: capability.minimumProfile },
      ]);
      continue;
    }

    const triggeredRisks = capability.riskTriggers.filter((risk) => activeRiskSet.has(risk));
    if (triggeredRisks.length > 0) {
      reasonsById.set(
        capability.id,
        triggeredRisks.map((risk) => ({ kind: "risk", risk })),
      );
    }
  }

  const prerequisiteDiagnostics = [];
  function includePrerequisites(id) {
    for (const prerequisite of byId.get(id).prerequisites) {
      const declaration = byId.get(prerequisite);
      if (!declaration.consumers.includes(input.workflow)) {
        prerequisiteDiagnostics.push(
          diagnostic(
            "inapplicable-capability-prerequisite",
            `$.capabilities.${id}.prerequisites`,
            `Capability ${id} requires ${prerequisite}, which does not consume ${input.workflow}.`,
            { capability: id, prerequisite, workflow: input.workflow },
          ),
        );
        continue;
      }

      if (!reasonsById.has(prerequisite)) {
        reasonsById.set(prerequisite, [{ kind: "prerequisite", capability: id }]);
        includePrerequisites(prerequisite);
      }
    }
  }

  for (const id of [...reasonsById.keys()].sort()) includePrerequisites(id);
  if (prerequisiteDiagnostics.length > 0) return blockedResult(prerequisiteDiagnostics);

  const enabledCapabilities = topologicalOrder(reasonsById.keys(), byId);
  const resolvedCapabilities = enabledCapabilities.map((id) => ({
    id,
    reasons: reasonsById.get(id),
  }));

  return {
    enabledCapabilities,
    resolvedCapabilities,
    diagnostics: [],
    blocked: false,
  };
}
