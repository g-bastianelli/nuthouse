#!/usr/bin/env node

import fs from "node:fs";

import {
  RecordValidationError,
  buildControlRecord,
  parseControlRecord,
  resolveControlAuthority,
  serializeRecord,
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
  } else if (operation === "parse-control") {
    write({ ok: true, record: parseControlRecord(payload.body) });
  } else if (operation === "resolve-controls") {
    write({
      ok: true,
      authority: resolveControlAuthority(payload.comments, {
        expectedProjectId: payload.projectId,
      }),
    });
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
