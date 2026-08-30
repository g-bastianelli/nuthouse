#!/usr/bin/env node

import fs from "node:fs";

import {
  advanceOrchestrationEpoch,
  OrchestrationEffectsError,
} from "../lib/orchestration-effects.mjs";
import { OrchestrationEpochError } from "../lib/orchestration-epoch.mjs";

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
  write(await advanceOrchestrationEpoch(readPayload()));
} catch (error) {
  write({
    ok: false,
    error: {
      code:
        error instanceof OrchestrationEffectsError || error instanceof OrchestrationEpochError
          ? error.code
          : typeof error?.code === "string"
            ? error.code
            : "INVALID_INPUT",
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
}
