#!/usr/bin/env node

import fs from "node:fs";

import {
  RecordValidationError,
  buildControlRecord,
  buildExecutionRecord,
  buildWorkerResultRecord,
  buildWaiverRecord,
  parseControlRecord,
  parseExecutionRecord,
  parseWorkerResultRecord,
  parseWaiverRecord,
  resolveControlAuthority,
  serializeRecord,
  validateControlSnapshot,
} from "../lib/records.mjs";

function readPayload() {
  const source = process.argv[3]
    ? fs.readFileSync(process.argv[3], "utf8")
    : fs.readFileSync(0, "utf8");
  return JSON.parse(source);
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const operation = process.argv[2];
  const payload = readPayload();
  if (operation === "build-control") {
    const record = buildControlRecord(payload.input, payload.existing);
    write({ ok: true, record, body: serializeRecord(record) });
  } else if (operation === "build-execution") {
    const record = buildExecutionRecord(payload);
    write({ ok: true, record, body: serializeRecord(record) });
  } else if (operation === "build-result") {
    const record = buildWorkerResultRecord(payload);
    write({ ok: true, record, body: serializeRecord(record) });
  } else if (operation === "build-waiver") {
    const record = buildWaiverRecord(payload);
    write({ ok: true, record, body: serializeRecord(record) });
  } else if (operation === "parse-control") {
    write({ ok: true, record: parseControlRecord(payload.body) });
  } else if (operation === "resolve-controls") {
    const snapshot = validateControlSnapshot(payload.snapshot, {
      expectedProjectId: payload.expectedProjectId,
    });
    write({ ok: true, authority: resolveControlAuthority(snapshot.comments) });
  } else if (operation === "parse-execution") {
    write({ ok: true, record: parseExecutionRecord(payload.body) });
  } else if (operation === "parse-result") {
    write({ ok: true, record: parseWorkerResultRecord(payload.body) });
  } else if (operation === "parse-waiver") {
    write({ ok: true, record: parseWaiverRecord(payload.body) });
  } else if (operation === "serialize") {
    write({ ok: true, body: serializeRecord(payload.record) });
  } else {
    throw new RecordValidationError("USAGE", "unknown records operation");
  }
} catch (error) {
  write({
    ok: false,
    error: {
      code: error instanceof RecordValidationError ? error.code : "INVALID_INPUT",
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
}
