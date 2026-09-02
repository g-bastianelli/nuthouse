import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  HOST_AGENT_REASONS,
  parseHostAgentInventory,
  resolveDefaultAgent,
  validateLaunchAgent,
} from "../lib/host-agents.mjs";

const scriptPath = path.join(import.meta.dir, "..", "scripts", "host-agents.mjs");

function agentEntry(overrides = {}) {
  return {
    id: "196038d6-f331-44b7-b819-a01aff008b6b",
    presetId: "claude",
    iconId: null,
    label: "Claude",
    command: "claude",
    args: ["--dangerously-skip-permissions"],
    promptTransport: "argv",
    order: 0,
    ...overrides,
  };
}

const codexEntry = agentEntry({
  id: "6b8473f2-7993-4475-8c6d-2dcfaadd3bf3",
  presetId: "codex",
  label: "Codex",
  command: "codex",
  order: 2,
});

function known(agents) {
  return parseHostAgentInventory(JSON.stringify(agents));
}

describe("parseHostAgentInventory", () => {
  test("normalizes a live `superset agents list --json` payload", () => {
    const inventory = known([codexEntry, agentEntry()]);
    expect(inventory).toEqual({
      dataState: "known",
      agents: [
        {
          selector: "claude",
          presetId: "claude",
          instanceId: "196038d6-f331-44b7-b819-a01aff008b6b",
          label: "Claude",
          order: 0,
        },
        {
          selector: "codex",
          presetId: "codex",
          instanceId: "6b8473f2-7993-4475-8c6d-2dcfaadd3bf3",
          label: "Codex",
          order: 2,
        },
      ],
    });
  });

  test("accepts an already-parsed array", () => {
    expect(parseHostAgentInventory([agentEntry()]).agents).toHaveLength(1);
  });

  test("selects the instance uuid when a custom agent carries no preset", () => {
    const [agent] = known([agentEntry({ presetId: null, label: "Mon agent" })]).agents;
    expect(agent.selector).toBe("196038d6-f331-44b7-b819-a01aff008b6b");
    expect(agent.presetId).toBe(null);
    expect(agent.label).toBe("Mon agent");
  });

  test("falls back to the selector when a label is missing", () => {
    expect(known([agentEntry({ label: null })]).agents[0].label).toBe("claude");
  });

  test("orders unordered entries deterministically after ordered ones", () => {
    const inventory = known([
      agentEntry({ presetId: "zeta", id: "z", order: null }),
      agentEntry({ presetId: "alpha", id: "a", order: null }),
      codexEntry,
    ]);
    expect(inventory.agents.map((agent) => agent.selector)).toEqual(["codex", "alpha", "zeta"]);
  });

  test("an empty host inventory is a known fact, not an unknown", () => {
    expect(known([])).toEqual({ dataState: "known", agents: [] });
  });

  test.each([
    ["empty stdout", ""],
    ["whitespace", "   \n"],
    ["invalid json", "{oops"],
    ["a cli error object", '{"error":"host offline"}'],
    ["a json scalar", "42"],
    ["undefined", undefined],
    ["null", null],
  ])("treats %s as an unknown inventory", (_label, raw) => {
    expect(parseHostAgentInventory(raw)).toEqual({ dataState: "unknown", agents: [] });
  });

  test("a malformed row makes the whole inventory unknown", () => {
    expect(parseHostAgentInventory([agentEntry(), { presetId: "codex" }])).toEqual({
      dataState: "unknown",
      agents: [],
    });
  });

  test("a preset configured twice keeps both rows, selected by instance uuid", () => {
    const inventory = parseHostAgentInventory([agentEntry(), agentEntry({ id: "other-instance" })]);
    expect(inventory.dataState).toBe("known");
    expect(inventory.agents.map((agent) => agent.selector)).toEqual([
      "196038d6-f331-44b7-b819-a01aff008b6b",
      "other-instance",
    ]);
    expect(inventory.agents.map((agent) => agent.label)).toEqual([
      "Claude (196038d6-f331-44b7-b819-a01aff008b6b)",
      "Claude (other-instance)",
    ]);
    expect(inventory.agents.every((agent) => agent.presetId === "claude")).toBe(true);
  });

  test("the shared preset id still resolves and validates against a duplicated preset", () => {
    const inventory = parseHostAgentInventory([agentEntry(), agentEntry({ id: "other-instance" })]);
    expect(resolveDefaultAgent({ inventory, explicitAgent: "claude" })).toMatchObject({
      status: "resolved",
      agent: "claude",
    });
    expect(validateLaunchAgent({ inventory, defaultAgent: "claude" })).toEqual({
      status: "ok",
      agent: "claude",
    });
  });

  test("a repeated instance uuid makes the inventory unknown", () => {
    expect(
      parseHostAgentInventory([agentEntry(), agentEntry({ presetId: "codex", label: "Codex" })]),
    ).toEqual({ dataState: "unknown", agents: [] });
  });

  test("an empty preset id reads as no preset, not as a malformed row", () => {
    const inventory = parseHostAgentInventory([
      agentEntry({ presetId: "", label: null }),
      codexEntry,
    ]);
    expect(inventory.dataState).toBe("known");
    expect(inventory.agents.map((agent) => agent.selector)).toEqual([
      "196038d6-f331-44b7-b819-a01aff008b6b",
      "codex",
    ]);
  });
});

describe("resolveDefaultAgent", () => {
  const inventory = known([codexEntry, agentEntry()]);

  test("accepts an explicit agent configured on the host", () => {
    expect(resolveDefaultAgent({ inventory, explicitAgent: "codex" })).toEqual({
      status: "resolved",
      agent: "codex",
      source: "explicit",
      inventoryState: "known",
    });
  });

  test("accepts an explicit instance uuid", () => {
    expect(resolveDefaultAgent({ inventory, explicitAgent: codexEntry.id })).toMatchObject({
      status: "resolved",
      agent: codexEntry.id,
      source: "explicit",
    });
  });

  test("blocks an explicit agent the host does not configure, listing what it does", () => {
    expect(resolveDefaultAgent({ inventory, explicitAgent: "gpt-whatever" })).toEqual({
      status: "blocked",
      reason: HOST_AGENT_REASONS.agentNotConfigured,
      requestedAgent: "gpt-whatever",
      options: [
        { selector: "claude", label: "Claude" },
        { selector: "codex", label: "Codex" },
      ],
      inventoryState: "known",
    });
  });

  test("an explicit agent survives an unknown inventory", () => {
    expect(
      resolveDefaultAgent({
        inventory: { dataState: "unknown", agents: [] },
        explicitAgent: "codex",
      }),
    ).toEqual({
      status: "resolved",
      agent: "codex",
      source: "explicit",
      inventoryState: "unknown",
    });
  });

  test("inherits the previous control agent when the host still configures it", () => {
    expect(resolveDefaultAgent({ inventory, inheritedAgent: "claude" })).toEqual({
      status: "resolved",
      agent: "claude",
      source: "inherited",
      inventoryState: "known",
    });
  });

  test("an inherited agent survives an unknown inventory", () => {
    expect(
      resolveDefaultAgent({
        inventory: { dataState: "unknown", agents: [] },
        inheritedAgent: "codex",
      }),
    ).toMatchObject({ status: "resolved", agent: "codex", source: "inherited" });
  });

  test("an explicit agent wins over an inherited one", () => {
    expect(
      resolveDefaultAgent({ inventory, explicitAgent: "codex", inheritedAgent: "claude" }),
    ).toMatchObject({ agent: "codex", source: "explicit" });
  });

  test("asks the user when the host offers several agents and nothing is configured", () => {
    expect(resolveDefaultAgent({ inventory })).toEqual({
      status: "choice-required",
      reason: HOST_AGENT_REASONS.noConfiguredDefault,
      options: [
        { selector: "claude", label: "Claude" },
        { selector: "codex", label: "Codex" },
      ],
      inventoryState: "known",
    });
  });

  test("asks the user when the inherited agent is gone from the host", () => {
    expect(resolveDefaultAgent({ inventory, inheritedAgent: "retired-agent" })).toEqual({
      status: "choice-required",
      reason: HOST_AGENT_REASONS.inheritedNoLongerConfigured,
      replacedAgent: "retired-agent",
      options: [
        { selector: "claude", label: "Claude" },
        { selector: "codex", label: "Codex" },
      ],
      inventoryState: "known",
    });
  });

  test("takes the only configured agent instead of asking", () => {
    expect(resolveDefaultAgent({ inventory: known([codexEntry]) })).toEqual({
      status: "resolved",
      agent: "codex",
      source: "only-configured",
      inventoryState: "known",
    });
  });

  test("names the replaced agent when the only configured one supersedes a retired default", () => {
    expect(
      resolveDefaultAgent({ inventory: known([codexEntry]), inheritedAgent: "retired-agent" }),
    ).toEqual({
      status: "resolved",
      agent: "codex",
      source: "only-configured",
      replacedAgent: "retired-agent",
      inventoryState: "known",
    });
  });

  test("blocks when the host configures no agent at all", () => {
    expect(resolveDefaultAgent({ inventory: known([]) })).toEqual({
      status: "blocked",
      reason: HOST_AGENT_REASONS.noneConfigured,
      options: [],
      inventoryState: "known",
    });
  });

  test("asks the user instead of refusing when the inventory is unreadable", () => {
    expect(resolveDefaultAgent({ inventory: { dataState: "unknown", agents: [] } })).toEqual({
      status: "input-required",
      reason: HOST_AGENT_REASONS.inventoryUnreadable,
      options: [],
      inventoryState: "unknown",
    });
  });

  test("an unreadable inventory never blocks activation", () => {
    for (const inherited of [undefined, "retired-agent"]) {
      expect(
        resolveDefaultAgent({
          inventory: { dataState: "unknown", agents: [] },
          inheritedAgent: inherited,
        }).status,
      ).not.toBe("blocked");
    }
  });

  test("an unreadable inventory honours the inherited agent rather than re-asking", () => {
    expect(
      resolveDefaultAgent({
        inventory: { dataState: "unknown", agents: [] },
        inheritedAgent: "retired-agent",
      }),
    ).toMatchObject({ status: "resolved", agent: "retired-agent", source: "inherited" });
  });

  test("a malformed pre-normalized inventory degrades to unknown instead of leaking rows", () => {
    expect(
      resolveDefaultAgent({
        inventory: { dataState: "known", agents: [{ selector: undefined }] },
      }),
    ).toMatchObject({ status: "input-required", options: [] });
  });

  test("ignores blank explicit and inherited values", () => {
    expect(
      resolveDefaultAgent({
        inventory: known([codexEntry]),
        explicitAgent: "  ",
        inheritedAgent: "",
      }),
    ).toMatchObject({ agent: "codex", source: "only-configured" });
  });

  test("trims a padded explicit selector", () => {
    expect(resolveDefaultAgent({ inventory, explicitAgent: " codex " })).toMatchObject({
      agent: "codex",
      source: "explicit",
    });
  });
});

describe("validateLaunchAgent", () => {
  const inventory = known([codexEntry, agentEntry()]);

  test("confirms an agent the host still configures", () => {
    expect(validateLaunchAgent({ inventory, defaultAgent: "codex" })).toEqual({
      status: "ok",
      agent: "codex",
    });
  });

  test("blocks a launch whose agent left the host, naming the live selectors", () => {
    expect(validateLaunchAgent({ inventory, defaultAgent: "retired-agent" })).toEqual({
      status: "blocked",
      reason: HOST_AGENT_REASONS.agentNotConfigured,
      requestedAgent: "retired-agent",
      configuredAgents: ["claude", "codex"],
    });
  });

  test("blocks a launch when the host configures no agent", () => {
    expect(validateLaunchAgent({ inventory: known([]), defaultAgent: "codex" })).toEqual({
      status: "blocked",
      reason: HOST_AGENT_REASONS.noneConfigured,
      requestedAgent: "codex",
      configuredAgents: [],
    });
  });

  test("stays unverified on an unknown inventory so `agents create` remains the authority", () => {
    expect(
      validateLaunchAgent({
        inventory: { dataState: "unknown", agents: [] },
        defaultAgent: "codex",
      }),
    ).toEqual({ status: "unverified", agent: "codex" });
  });

  test("blocks an unnamed configured agent regardless of inventory", () => {
    expect(validateLaunchAgent({ inventory, defaultAgent: "" })).toEqual({
      status: "blocked",
      reason: HOST_AGENT_REASONS.agentUnnamed,
      requestedAgent: "",
      configuredAgents: ["claude", "codex"],
    });
  });

  test("never presents an unreadable row as a host selector", () => {
    expect(
      validateLaunchAgent({
        inventory: { dataState: "known", agents: [{ selector: undefined }] },
        defaultAgent: "codex",
      }),
    ).toEqual({ status: "unverified", agent: "codex" });
  });
});

describe("scripts/host-agents.mjs", () => {
  function run(operation, payload) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-host-agents-"));
    try {
      const payloadPath = path.join(dir, "payload.json");
      fs.writeFileSync(payloadPath, JSON.stringify(payload));
      const stdout = execFileSync("node", [scriptPath, operation, payloadPath], {
        encoding: "utf8",
      });
      return JSON.parse(stdout);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  function withInventoryFile(contents, callback) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "maestro-inventory-"));
    try {
      const inventoryPath = path.join(dir, "agents.json");
      fs.writeFileSync(inventoryPath, contents);
      return callback(inventoryPath);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  test("resolve-default reads the raw cli capture from disk", () => {
    const result = withInventoryFile(JSON.stringify([codexEntry, agentEntry()]), (inventoryPath) =>
      run("resolve-default", { inventoryPath, explicitAgent: "claude" }),
    );
    expect(result).toMatchObject({
      ok: true,
      resolution: {
        status: "resolved",
        agent: "claude",
        source: "explicit",
        inventoryState: "known",
      },
    });
  });

  test("resolve-default surfaces the host options when nothing is configured", () => {
    const result = withInventoryFile(JSON.stringify([codexEntry, agentEntry()]), (inventoryPath) =>
      run("resolve-default", { inventoryPath }),
    );
    expect(result.resolution).toMatchObject({
      status: "choice-required",
      options: [
        { selector: "claude", label: "Claude" },
        { selector: "codex", label: "Codex" },
      ],
    });
  });

  test("a missing capture file is an unknown inventory, never a crash", () => {
    const result = run("resolve-default", {
      inventoryPath: path.join(os.tmpdir(), "maestro-absent-capture.json"),
      explicitAgent: "codex",
    });
    expect(result.resolution).toEqual({
      status: "resolved",
      agent: "codex",
      source: "explicit",
      inventoryState: "unknown",
    });
  });

  test("an empty capture from a failed cli call is an unknown inventory", () => {
    const result = withInventoryFile("", (inventoryPath) =>
      run("resolve-default", { inventoryPath }),
    );
    expect(result.resolution).toEqual({
      status: "input-required",
      reason: HOST_AGENT_REASONS.inventoryUnreadable,
      options: [],
      inventoryState: "unknown",
    });
  });

  test("validate-launch reports a launch-time drift", () => {
    const result = withInventoryFile(JSON.stringify([codexEntry]), (inventoryPath) =>
      run("validate-launch", { inventoryPath, defaultAgent: "claude" }),
    );
    expect(result).toMatchObject({
      ok: true,
      validation: {
        status: "blocked",
        reason: HOST_AGENT_REASONS.agentNotConfigured,
        requestedAgent: "claude",
        configuredAgents: ["codex"],
      },
    });
  });

  test("an unknown operation exits non-zero", () => {
    expect(() => run("teleport", {})).toThrow();
  });
});
