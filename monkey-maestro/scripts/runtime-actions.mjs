#!/usr/bin/env node

import fs from "node:fs";

import { planRuntimeActions } from "../lib/runtime-actions.mjs";
import { RuntimeSnapshotValidationError } from "../lib/runtime-snapshot.mjs";

function readPayload() {
  const source = process.argv[2]
    ? fs.readFileSync(process.argv[2], "utf8")
    : fs.readFileSync(0, "utf8");
  return JSON.parse(source);
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const payload = readPayload();
  write({
    ok: true,
    plan: planRuntimeActions(payload.frontierPlan, payload.runtimeSnapshot, payload.options),
  });
} catch (error) {
  write({
    ok: false,
    error: {
      code:
        error instanceof RuntimeSnapshotValidationError
          ? error.code
          : typeof error?.code === "string"
            ? error.code
            : "INVALID_INPUT",
      message: error instanceof Error ? error.message : String(error),
      ...(Array.isArray(error?.issueIds) && error.issueIds.length > 0
        ? { issueIds: error.issueIds }
        : {}),
    },
  });
  process.exitCode = 1;
}
