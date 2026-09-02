#!/usr/bin/env node

import fs from "node:fs";

import { resolveDefaultAgent, validateLaunchAgent } from "../lib/host-agents.mjs";

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
    write({
      ok: true,
      resolution: resolveDefaultAgent({
        inventory,
        explicitAgent: payload.explicitAgent,
        inheritedAgent: payload.inheritedAgent,
      }),
    });
  } else if (operation === "validate-launch") {
    write({
      ok: true,
      validation: validateLaunchAgent({ inventory, defaultAgent: payload.defaultAgent }),
    });
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
