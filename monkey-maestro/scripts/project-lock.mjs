#!/usr/bin/env node

import fs from "node:fs";

import {
  acquireProjectLock,
  inspectProjectLock,
  recoverProjectLock,
  releaseProjectLock,
} from "../lib/project-lock.mjs";

function write(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  const operation = process.argv[2];
  const source = process.argv[3]
    ? fs.readFileSync(process.argv[3], "utf8")
    : fs.readFileSync(0, "utf8");
  const payload = JSON.parse(source);
  if (operation === "acquire") write(acquireProjectLock(payload));
  else if (operation === "inspect") write(inspectProjectLock(payload));
  else if (operation === "release") write(releaseProjectLock(payload));
  else if (operation === "recover") write(recoverProjectLock(payload));
  else throw new Error("unknown project-lock operation");
} catch (error) {
  write({ ok: false, error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
