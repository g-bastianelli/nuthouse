#!/usr/bin/env node

import fs from "node:fs";

import {
  mergeTargetedRuntimeSnapshot,
  mergeTargetedRuntimeSnapshotUnknown,
  RuntimeSnapshotValidationError,
  validateRuntimeAuditSnapshot,
} from "../lib/runtime-snapshot.mjs";

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function readPayload() {
  const source = process.argv[3]
    ? fs.readFileSync(process.argv[3], "utf8")
    : fs.readFileSync(0, "utf8");
  try {
    return JSON.parse(source);
  } catch {
    fail("INVALID_JSON", "input must be valid JSON");
  }
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function requirePayloadKeys(payload, expectedKeys) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("AUDIT_PAYLOAD_INVALID");
  }
  const payloadKeys = Object.keys(payload).sort((left, right) => left.localeCompare(right));
  const expected = [...expectedKeys].sort((left, right) => left.localeCompare(right));
  if (
    payloadKeys.length !== expected.length ||
    payloadKeys.some((key, index) => key !== expected[index])
  ) {
    fail("AUDIT_PAYLOAD_INVALID");
  }
}

try {
  const command = process.argv[2];
  if (!["validate-audit", "merge-targeted", "merge-targeted-unknown"].includes(command)) {
    fail("COMMAND_INVALID");
  }
  const payload = readPayload();
  if (command === "validate-audit") {
    requirePayloadKeys(payload, ["expectedContext", "runtimeSnapshot", "selectedRows"]);
    write({
      ok: true,
      snapshot: validateRuntimeAuditSnapshot(payload.runtimeSnapshot, payload.selectedRows, {
        expectedContext: payload.expectedContext,
      }),
    });
  } else if (command === "merge-targeted") {
    requirePayloadKeys(payload, [
      "expectedContext",
      "retryIssueIds",
      "retrySnapshot",
      "runtimeSnapshot",
      "selectedRows",
    ]);
    write({
      ok: true,
      runtimeSnapshot: mergeTargetedRuntimeSnapshot(
        payload.runtimeSnapshot,
        payload.retrySnapshot,
        {
          selectedRows: payload.selectedRows,
          retryIssueIds: payload.retryIssueIds,
          expectedContext: payload.expectedContext,
        },
      ),
    });
  } else {
    requirePayloadKeys(payload, [
      "code",
      "detail",
      "expectedContext",
      "retryIssueIds",
      "runtimeSnapshot",
      "selectedRows",
    ]);
    write({
      ok: true,
      runtimeSnapshot: mergeTargetedRuntimeSnapshotUnknown(payload.runtimeSnapshot, {
        selectedRows: payload.selectedRows,
        retryIssueIds: payload.retryIssueIds,
        expectedContext: payload.expectedContext,
        code: payload.code,
        detail: payload.detail,
      }),
    });
  }
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
