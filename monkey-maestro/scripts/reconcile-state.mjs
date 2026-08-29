#!/usr/bin/env node

import fs from "node:fs";

import { buildReconciliationInput } from "../lib/reconciliation-input.mjs";
import { resolveReconciliation } from "../lib/reconciliation-state.mjs";

try {
  const source = process.argv[2]
    ? fs.readFileSync(process.argv[2], "utf8")
    : fs.readFileSync(0, "utf8");
  const packet = JSON.parse(source);
  const input =
    packet?.linearSnapshot && packet?.runtimeSnapshot ? buildReconciliationInput(packet) : packet;
  const decision = resolveReconciliation(input);
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 1;
}
