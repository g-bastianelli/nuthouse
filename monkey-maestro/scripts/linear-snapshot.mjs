#!/usr/bin/env node

import fs from "node:fs";

import {
  hydrateLinearSnapshotCache,
  LinearSnapshotValidationError,
  markLinearSnapshotCacheUnknown,
  refreshLinearSnapshotCache,
  validateLinearSnapshot,
} from "../lib/linear-snapshot.mjs";

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

function exactPayload(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("CACHE_PAYLOAD_INVALID");
  }
  const actualKeys = Object.keys(value).sort((left, right) => left.localeCompare(right));
  const sortedExpectedKeys = [...expectedKeys].sort((left, right) => left.localeCompare(right));
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    fail("CACHE_PAYLOAD_INVALID");
  }
  return value;
}

function hydrate(payload) {
  const input = exactPayload(payload, ["expectedProjectId", "snapshot"]);
  const snapshot = validateLinearSnapshot(input.snapshot, {
    expectedProjectId: input.expectedProjectId,
    expectedScope: { mode: "full", requestedIssueIds: [] },
  });
  return hydrateLinearSnapshotCache(snapshot);
}

function refresh(payload) {
  const input = exactPayload(payload, ["cache", "expectedScope", "targetedSnapshot"]);
  return refreshLinearSnapshotCache(input.cache, input.targetedSnapshot, {
    expectedScope: input.expectedScope,
  });
}

function rawFullSnapshot(raw, expectedProjectId) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    raw.schemaVersion !== 1 ||
    raw.projectId !== expectedProjectId ||
    raw.scope?.mode !== "full" ||
    !Array.isArray(raw.scope?.requestedIssueIds) ||
    raw.scope.requestedIssueIds.length !== 0 ||
    !Array.isArray(raw.issues) ||
    !Array.isArray(raw.unknown)
  ) {
    fail("CACHE_RECOVERY_BASE_INVALID");
  }
  const rawIssueIds = raw.issues.map((row) =>
    typeof row?.issueId === "string" && row.issueId.trim().length > 0
      ? row.issueId.trim()
      : fail("CACHE_RECOVERY_IDENTITY_INVALID"),
  );
  const duplicateIssueIds = rawIssueIds.filter(
    (issueId, index) => rawIssueIds.indexOf(issueId) !== index,
  );
  if (duplicateIssueIds.length > 0) fail("CACHE_RECOVERY_IDENTITY_INVALID");
  return { raw, rawIssueIds };
}

function recoverFull(payload) {
  const input = exactPayload(payload, [
    "expectedProjectId",
    "expectedScope",
    "snapshot",
    "targetedSnapshot",
  ]);
  const targeted = validateLinearSnapshot(input.targetedSnapshot, {
    expectedProjectId: input.expectedProjectId,
    expectedScope: input.expectedScope,
  });
  if (targeted.scope.mode !== "targeted") fail("CACHE_RECOVERY_SCOPE_INVALID");

  const { raw, rawIssueIds } = rawFullSnapshot(input.snapshot, input.expectedProjectId);
  const replacementIds = new Set(targeted.scope.requestedIssueIds);
  if ([...replacementIds].some((issueId) => !rawIssueIds.includes(issueId))) {
    fail("CACHE_RECOVERY_SCOPE_INVALID");
  }
  const replacementById = new Map(targeted.issues.map((row) => [row.issueId, row]));
  const recovered = {
    ...raw,
    issues: raw.issues.map((row) =>
      replacementIds.has(row.issueId.trim()) ? replacementById.get(row.issueId.trim()) : row,
    ),
    unknown: [
      ...raw.unknown.filter((entry) => !replacementIds.has(entry?.issueId)),
      ...targeted.unknown,
    ],
  };
  return hydrate({ expectedProjectId: input.expectedProjectId, snapshot: recovered });
}

function recoverFullUnknown(payload) {
  const input = exactPayload(payload, [
    "code",
    "detail",
    "expectedProjectId",
    "issueIds",
    "snapshot",
  ]);
  if (!Array.isArray(input.issueIds) || input.issueIds.length === 0) {
    fail("CACHE_RECOVERY_SCOPE_INVALID");
  }
  const issueIds = input.issueIds.map((issueId) =>
    typeof issueId === "string" && issueId.trim().length > 0
      ? issueId.trim()
      : fail("CACHE_RECOVERY_SCOPE_INVALID"),
  );
  if (new Set(issueIds).size !== issueIds.length) fail("CACHE_RECOVERY_SCOPE_INVALID");
  const replacementIds = new Set(issueIds);
  const { raw, rawIssueIds } = rawFullSnapshot(input.snapshot, input.expectedProjectId);
  if (issueIds.some((issueId) => !rawIssueIds.includes(issueId))) {
    fail("CACHE_RECOVERY_SCOPE_INVALID");
  }
  const recovered = {
    ...raw,
    issues: raw.issues.map((row) =>
      replacementIds.has(row.issueId.trim())
        ? {
            issueId: row.issueId.trim(),
            projectId: input.expectedProjectId,
            statusType: "unknown",
            blockerIssueIds: [],
            dataState: "unknown",
          }
        : row,
    ),
    unknown: [
      ...raw.unknown.filter((entry) => !replacementIds.has(entry?.issueId)),
      ...issueIds.map((issueId) => ({ issueId, code: input.code, detail: input.detail })),
    ],
  };
  return hydrate({ expectedProjectId: input.expectedProjectId, snapshot: recovered });
}

function markUnknown(payload) {
  const input = exactPayload(payload, ["cache", "code", "detail", "issueIds"]);
  return markLinearSnapshotCacheUnknown(input.cache, {
    issueIds: input.issueIds,
    code: input.code,
    detail: input.detail,
  });
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const operation = process.argv[2];
  const payload = readPayload();
  const cache =
    operation === "hydrate"
      ? hydrate(payload)
      : operation === "refresh"
        ? refresh(payload)
        : operation === "recover-full"
          ? recoverFull(payload)
          : operation === "recover-full-unknown"
            ? recoverFullUnknown(payload)
            : operation === "mark-unknown"
              ? markUnknown(payload)
              : fail("COMMAND_INVALID");
  write({ ok: true, cache });
} catch (error) {
  write({
    ok: false,
    error: {
      code:
        error instanceof LinearSnapshotValidationError
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
