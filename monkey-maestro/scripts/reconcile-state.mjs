#!/usr/bin/env node

import fs from "node:fs";

import { resolveReconciliation } from "../lib/reconciliation-state.mjs";

try {
  const source = process.argv[2]
    ? fs.readFileSync(process.argv[2], "utf8")
    : fs.readFileSync(0, "utf8");
  const decision = resolveReconciliation(JSON.parse(source));
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
