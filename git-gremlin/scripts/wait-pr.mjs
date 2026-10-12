#!/usr/bin/env node
import { observePullRequest, validateRequest, waitForPullRequest } from "../lib/pr-wait.mjs";

let request;
try {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !["snapshot", "wait"].includes(mode))
    throw new Error("Usage: wait-pr.mjs snapshot|wait < request.json");
  const chunks = [];
  let inputBytes = 0;
  for await (const chunk of process.stdin) {
    inputBytes += chunk.length;
    if (inputBytes > 8 * 1024 * 1024) throw new Error("Request exceeds 8 MiB");
    chunks.push(chunk);
  }
  request = JSON.parse(Buffer.concat(chunks, inputBytes).toString("utf8"));
  const result =
    mode === "snapshot"
      ? {
          outcome: "observed",
          operationId: request.operationId,
          snapshot: await observePullRequest(validateRequest(request)),
        }
      : await waitForPullRequest(request);
  const output = JSON.stringify(result);
  // Leave room for the caller's identity and timing fields in the next stdin request.
  if (Buffer.byteLength(output) > 7 * 1024 * 1024)
    throw new Error("Observation exceeds the 7 MiB baseline limit; resume manually");
  process.stdout.write(`${output}\n`);
  process.exitCode = result.outcome === "failed" ? 1 : 0;
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ outcome: "failed", operationId: request?.operationId ?? null, repository: request?.repository ?? null, number: request?.number ?? null, reason: error instanceof Error ? error.message : "Invalid observation request" })}\n`,
  );
  process.exitCode = 1;
}
