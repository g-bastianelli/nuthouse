#!/usr/bin/env node
import {
  MAX_CONTINUATION_BYTES,
  MAX_INPUT_BYTES,
  notify,
  validateRequest,
  waitAndNotify,
} from "../lib/notifications.mjs";

async function readInput(maximum) {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > maximum) throw new Error(`request exceeds ${maximum} bytes`);
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

let receipt;
try {
  const [action, ...args] = process.argv.slice(2);
  let input;
  if (action === "receive") {
    if (
      args.length !== 4 ||
      args[0] !== "--receipt" ||
      args[2] !== "--payload" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args[1]) ||
      !/^[A-Za-z0-9_-]+$/.test(args[3]) ||
      args[3].length > MAX_INPUT_BYTES * 2
    )
      throw new Error("invalid receive arguments");
    receipt = args[1];
    input = JSON.parse(Buffer.from(args[3], "base64url").toString("utf8"));
    if (input.destination?.kind !== "local")
      throw new Error("receive requires a local destination");
  } else {
    if (!["send", "check", "wait-and-notify"].includes(action) || args.length)
      throw new Error("usage: notify.mjs send|check|wait-and-notify < request.json");
    input = await readInput(
      action === "wait-and-notify" ? MAX_CONTINUATION_BYTES : MAX_INPUT_BYTES,
    );
  }
  const result =
    action === "check"
      ? { status: "valid", eventId: validateRequest(input).event.eventId }
      : action === "wait-and-notify"
        ? await waitAndNotify(input)
        : await notify(input);
  if (receipt) process.stdout.write(`\nMM:${receipt}:${result.status}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (
    ["failed", "unknown"].includes(result.notification?.status ?? result.status) ||
    result.observer?.outcome === "failed" ||
    result.cleanup?.status === "failed"
  )
    process.exitCode = 1;
} catch (error) {
  if (receipt) process.stdout.write(`\nMM:${receipt}:failed\n`);
  process.stderr.write(
    `${JSON.stringify({ status: "failed", reason: error instanceof Error ? error.message : String(error) })}\n`,
  );
  process.exitCode = 1;
}
