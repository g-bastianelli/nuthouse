#!/usr/bin/env node

import fs from "node:fs";

import {
  HOST_AGENT_REASONS,
  resolveDefaultAgent,
  validateLaunchAgent,
} from "../lib/host-agents.mjs";

// The skills print this line and branch on `status` alone. Keeping the reason taxonomy
// here rather than in SKILL.md prose is the point: it is testable, and it is not
// re-loaded into context on every invocation of every skill that launches an agent.
const REASON_TEXT = {
  [HOST_AGENT_REASONS.agentNotConfigured]: "the host no longer configures that agent",
  [HOST_AGENT_REASONS.agentUnnamed]: "no agent was named",
  [HOST_AGENT_REASONS.inheritedNoLongerConfigured]:
    "the agent recorded at activation is gone from the host",
  [HOST_AGENT_REASONS.inventoryUnreadable]: "the host inventory could not be read",
  [HOST_AGENT_REASONS.noConfiguredDefault]: "the host configures no default agent",
  [HOST_AGENT_REASONS.noneConfigured]: "the host configures no agent at all",
};

function message(result) {
  const listed = result.configuredAgents?.length
    ? ` Configured: ${result.configuredAgents.join(", ")}.`
    : "";
  switch (result.status) {
    case "resolved":
    case "ok":
      return `Agent ${result.agent} confirmed on the host.`;
    case "unverified":
      return `Host inventory unreadable; launching ${result.agent} and letting \`superset agents create\` decide.`;
    case "choice-required":
      return `Pick an agent for this host.${listed}`;
    case "input-required":
      return `${REASON_TEXT[result.reason] ?? "agent unresolved"} — name an agent explicitly.`;
    default:
      return `Cannot launch: ${REASON_TEXT[result.reason] ?? "agent unresolved"}. Re-run \`monkey-maestro:start\` with an agent the host reports.${listed}`;
  }
}

function readPayload() {
  const source = process.argv[3]
    ? fs.readFileSync(process.argv[3], "utf8")
    : fs.readFileSync(0, "utf8");
  return JSON.parse(source);
}

function readInventory(inventoryPath) {
  if (typeof inventoryPath !== "string" || inventoryPath.length === 0) return undefined;
  try {
    return fs.readFileSync(inventoryPath, "utf8");
  } catch {
    return undefined;
  }
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const operation = process.argv[2];
  const payload = readPayload();
  const inventory = readInventory(payload.inventoryPath);
  if (operation === "resolve-default") {
    const resolution = resolveDefaultAgent({
      inventory,
      explicitAgent: payload.explicitAgent,
      inheritedAgent: payload.inheritedAgent,
    });
    write({ ok: true, resolution, message: message(resolution) });
  } else if (operation === "validate-launch") {
    const validation = validateLaunchAgent({ inventory, defaultAgent: payload.defaultAgent });
    write({ ok: true, validation, message: message(validation) });
  } else {
    throw new Error(`unknown operation: ${operation}`);
  }
} catch (error) {
  write({
    ok: false,
    error: {
      code: typeof error?.code === "string" ? error.code : "INVALID_INPUT",
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
}
