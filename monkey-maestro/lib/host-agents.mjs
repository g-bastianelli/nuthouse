export const HOST_AGENT_REASONS = Object.freeze({
  agentNotConfigured: "AGENT_NOT_CONFIGURED",
  agentUnnamed: "AGENT_UNNAMED",
  inheritedNoLongerConfigured: "AGENT_INHERITED_NO_LONGER_CONFIGURED",
  inventoryUnreadable: "HOST_AGENTS_INVENTORY_UNREADABLE",
  noConfiguredDefault: "AGENT_NO_CONFIGURED_DEFAULT",
  noneConfigured: "HOST_AGENTS_NONE_CONFIGURED",
});

const UNKNOWN_INVENTORY = Object.freeze({ dataState: "unknown", agents: [] });

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectorValue(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizedRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
  const instanceId = selectorValue(row.id);
  if (!instanceId) return undefined;
  const presetId = selectorValue(row.presetId) ?? null;
  const order = Number.isInteger(row.order) ? row.order : null;
  return {
    selector: presetId ?? instanceId,
    presetId,
    instanceId,
    label: selectorValue(row.label) ?? presetId ?? instanceId,
    order,
  };
}

/**
 * A preset configured twice on one host is a legitimate setup, so the shared preset id
 * cannot identify either instance. Those rows keep the preset as an accepted alias and
 * expose their instance uuid as the selector a user can unambiguously pick.
 */
function disambiguated(rows) {
  const presetCounts = new Map();
  for (const row of rows) {
    if (row.presetId) presetCounts.set(row.presetId, (presetCounts.get(row.presetId) ?? 0) + 1);
  }
  return rows.map((row) =>
    row.presetId && presetCounts.get(row.presetId) > 1
      ? { ...row, selector: row.instanceId, label: `${row.label} (${row.instanceId})` }
      : row,
  );
}

function ordered(rows) {
  return [...rows].sort((left, right) => {
    if (left.order !== right.order) {
      if (left.order === null) return 1;
      if (right.order === null) return -1;
      return left.order - right.order;
    }
    return compareStrings(left.selector, right.selector);
  });
}

/**
 * Normalize one raw `superset agents list --host <id> --json` capture.
 *
 * Discovery is best effort: an offline host, an absent CLI, an error payload, or any row
 * we cannot read yields `unknown` rather than a throw or a partial list. Only a list we
 * know to be complete may reject an agent selector.
 */
export function parseHostAgentInventory(raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    if (raw.trim().length === 0) return UNKNOWN_INVENTORY;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return UNKNOWN_INVENTORY;
    }
  }
  if (!Array.isArray(parsed)) return UNKNOWN_INVENTORY;

  const rows = [];
  const instanceIds = new Set();
  for (const row of parsed) {
    const normalized = normalizedRow(row);
    if (!normalized) return UNKNOWN_INVENTORY;
    if (instanceIds.has(normalized.instanceId)) return UNKNOWN_INVENTORY;
    instanceIds.add(normalized.instanceId);
    rows.push(normalized);
  }
  return { dataState: "known", agents: ordered(disambiguated(rows)) };
}

function isNormalizedRow(row) {
  return (
    row !== null &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    selectorValue(row.selector) !== undefined &&
    selectorValue(row.instanceId) !== undefined &&
    selectorValue(row.label) !== undefined
  );
}

function inventoryOf(value) {
  if (value && value.dataState === "unknown") return UNKNOWN_INVENTORY;
  if (value && value.dataState === "known") {
    return Array.isArray(value.agents) && value.agents.every(isNormalizedRow)
      ? value
      : UNKNOWN_INVENTORY;
  }
  return parseHostAgentInventory(value);
}

function configures(inventory, selector) {
  return inventory.agents.some(
    (agent) =>
      agent.selector === selector || agent.instanceId === selector || agent.presetId === selector,
  );
}

function options(inventory) {
  return inventory.agents.map((agent) => ({ selector: agent.selector, label: agent.label }));
}

/**
 * Decide which agent one Maestro control should carry, from the host's own inventory.
 *
 * Never invents a default and never makes Superset an activation precondition: an
 * unreadable inventory with nothing to honour asks the user to name an agent instead of
 * refusing. Only a complete inventory can refuse, and only because it proves the host
 * cannot run what was asked.
 */
export function resolveDefaultAgent({ inventory: rawInventory, explicitAgent, inheritedAgent }) {
  const inventory = inventoryOf(rawInventory);
  const inventoryState = inventory.dataState;
  const explicit = selectorValue(explicitAgent);
  const inherited = selectorValue(inheritedAgent);

  if (explicit) {
    if (inventoryState === "unknown" || configures(inventory, explicit)) {
      return { status: "resolved", agent: explicit, source: "explicit", inventoryState };
    }
    return {
      status: "blocked",
      reason: HOST_AGENT_REASONS.agentNotConfigured,
      requestedAgent: explicit,
      options: options(inventory),
      inventoryState,
    };
  }

  if (inherited && (inventoryState === "unknown" || configures(inventory, inherited))) {
    return { status: "resolved", agent: inherited, source: "inherited", inventoryState };
  }

  if (inventoryState === "unknown") {
    // An inherited agent is honoured above, so nothing is superseded on this path.
    return {
      status: "input-required",
      reason: HOST_AGENT_REASONS.inventoryUnreadable,
      options: [],
      inventoryState,
    };
  }
  if (inventory.agents.length === 0) {
    return {
      status: "blocked",
      reason: HOST_AGENT_REASONS.noneConfigured,
      options: [],
      inventoryState,
    };
  }
  if (inventory.agents.length === 1) {
    return {
      status: "resolved",
      agent: inventory.agents[0].selector,
      source: "only-configured",
      ...(inherited ? { replacedAgent: inherited } : {}),
      inventoryState,
    };
  }
  return {
    status: "choice-required",
    reason: inherited
      ? HOST_AGENT_REASONS.inheritedNoLongerConfigured
      : HOST_AGENT_REASONS.noConfiguredDefault,
    ...(inherited ? { replacedAgent: inherited } : {}),
    options: options(inventory),
    inventoryState,
  };
}

/**
 * Re-check a control's configured agent against the host before launching workers.
 *
 * The host can drop an agent between activation and a later orchestration, so this is the
 * authoritative moment. An unknown inventory stays `unverified` — `superset agents create`
 * decides — while a complete inventory that lacks the selector blocks with the live options.
 */
export function validateLaunchAgent({ inventory: rawInventory, defaultAgent }) {
  const inventory = inventoryOf(rawInventory);
  const requestedAgent = typeof defaultAgent === "string" ? defaultAgent : "";
  const selector = selectorValue(defaultAgent);
  const configuredAgents = inventory.agents.map((agent) => agent.selector);

  if (!selector) {
    return {
      status: "blocked",
      reason: HOST_AGENT_REASONS.agentUnnamed,
      requestedAgent,
      configuredAgents,
    };
  }
  if (inventory.dataState === "unknown") return { status: "unverified", agent: selector };
  if (inventory.agents.length === 0) {
    return {
      status: "blocked",
      reason: HOST_AGENT_REASONS.noneConfigured,
      requestedAgent,
      configuredAgents,
    };
  }
  if (!configures(inventory, selector)) {
    return {
      status: "blocked",
      reason: HOST_AGENT_REASONS.agentNotConfigured,
      requestedAgent,
      configuredAgents,
    };
  }
  return { status: "ok", agent: selector };
}
