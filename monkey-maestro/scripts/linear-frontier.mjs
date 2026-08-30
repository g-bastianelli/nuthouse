#!/usr/bin/env node

import fs from "node:fs";

import { planLinearFrontier } from "../lib/linear-frontier.mjs";
import { validateLinearSnapshot } from "../lib/linear-snapshot.mjs";

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const source = process.argv[2]
    ? fs.readFileSync(process.argv[2], "utf8")
    : fs.readFileSync(0, "utf8");
  let packet;
  try {
    packet = JSON.parse(source);
  } catch {
    const error = new Error("input must be valid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }
  const hasEnvelope =
    packet &&
    typeof packet === "object" &&
    !Array.isArray(packet) &&
    Object.hasOwn(packet, "snapshot");
  const snapshot = hasEnvelope
    ? validateLinearSnapshot(packet.snapshot, {
        ...(packet.expectedProjectId === undefined
          ? {}
          : { expectedProjectId: packet.expectedProjectId }),
        ...(packet.expectedScope === undefined ? {} : { expectedScope: packet.expectedScope }),
      })
    : packet;
  const plan = planLinearFrontier(snapshot, {
    forcedIssueIds: hasEnvelope ? (packet.forcedIssueIds ?? []) : [],
  });
  write(plan);
} catch (error) {
  write({
    ok: false,
    error: {
      code:
        error && typeof error === "object" && typeof error.code === "string"
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
