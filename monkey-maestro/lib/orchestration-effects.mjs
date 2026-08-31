import { createHash } from "node:crypto";

import {
  OrchestrationEffectRequired,
  requiredOrchestrationEffects,
} from "./orchestration-effect-signal.mjs";
import { runOrchestrationEpoch } from "./orchestration-epoch.mjs";

const EFFECT_ADAPTERS = Object.freeze([
  "acquireDispatchLock",
  "releaseDispatchLock",
  "refreshCandidateAndBlockers",
  "inspectExactRuntime",
  "dispatchIssue",
  "monitorWorker",
  "refreshAfterWorkerEvent",
  "promoteAfterRefresh",
]);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OrchestrationEffectsError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "OrchestrationEffectsError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new OrchestrationEffectsError(code, message);
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  fail("ORCHESTRATION_EFFECT_INPUT_INVALID");
}

function normalizeTranscript(input) {
  if (input === undefined) return new Map();
  if (!Array.isArray(input)) fail("ORCHESTRATION_TRANSCRIPT_INVALID");
  const transcript = new Map();
  for (const rawEntry of input) {
    const entry = object(rawEntry, "ORCHESTRATION_TRANSCRIPT_INVALID");
    if (
      typeof entry.effectId !== "string" ||
      entry.effectId.length === 0 ||
      !["fulfilled", "rejected"].includes(entry.status) ||
      transcript.has(entry.effectId)
    ) {
      fail("ORCHESTRATION_TRANSCRIPT_INVALID");
    }
    if (entry.status === "fulfilled" && !("value" in entry)) {
      fail("ORCHESTRATION_TRANSCRIPT_INVALID");
    }
    if (entry.status === "rejected") {
      const error = object(entry.error, "ORCHESTRATION_TRANSCRIPT_INVALID");
      const allowedErrorKeys = new Set(["code", "message", "ambiguous"]);
      if (
        Object.keys(error).some((key) => !allowedErrorKeys.has(key)) ||
        typeof error.code !== "string" ||
        error.code.length === 0 ||
        error.code.startsWith("ORCHESTRATION_EFFECT") ||
        typeof error.message !== "string" ||
        error.message.length === 0 ||
        (error.ambiguous !== undefined && typeof error.ambiguous !== "boolean")
      ) {
        fail("ORCHESTRATION_TRANSCRIPT_INVALID");
      }
    }
    transcript.set(entry.effectId, entry);
  }
  return transcript;
}

function effectRequests(error) {
  return requiredOrchestrationEffects(error);
}

function replayError(input) {
  const error = new Error(input.message);
  error.code = input.code;
  if (input.ambiguous !== undefined) error.ambiguous = input.ambiguous;
  return error;
}

function effectId(invocationId, adapter, input, occurrence) {
  const digest = createHash("sha256")
    .update(canonicalJson({ invocationId, adapter, input, occurrence }))
    .digest("hex");
  return `sha256:${digest}`;
}

function bridgeAdapters(invocationId, transcript, consumedEffectIds) {
  const occurrenceByCall = new Map();
  const adapters = {};
  for (const adapter of EFFECT_ADAPTERS) {
    adapters[adapter] = async (input) => {
      const canonicalCall = canonicalJson({ adapter, input });
      const occurrence = (occurrenceByCall.get(canonicalCall) ?? 0) + 1;
      occurrenceByCall.set(canonicalCall, occurrence);
      const id = effectId(invocationId, adapter, input, occurrence);
      const effect = { effectId: id, invocationId, adapter, input, occurrence };
      const response = transcript.get(id);
      if (!response) throw new OrchestrationEffectRequired(effect);
      consumedEffectIds.add(id);
      if (response.status === "rejected") throw replayError(response.error);
      return response.value;
    };
  }
  return adapters;
}

function assertNoUnusedTranscript(transcript, consumedEffectIds) {
  const unused = [...transcript.keys()].filter((effectId) => !consumedEffectIds.has(effectId));
  if (unused.length > 0) {
    fail(
      "ORCHESTRATION_TRANSCRIPT_UNUSED",
      `transcript contains unrequested effects: ${unused.sort().join(",")}`,
    );
  }
}

export async function advanceOrchestrationEpoch(input) {
  const envelope = object(input, "ORCHESTRATION_EFFECT_ENVELOPE_INVALID");
  if (envelope.schemaVersion !== 1) fail("ORCHESTRATION_EFFECT_SCHEMA_INVALID");
  const request = object(envelope.request, "ORCHESTRATION_EFFECT_REQUEST_INVALID");
  if (typeof request.invocationId !== "string" || !UUID_V4_PATTERN.test(request.invocationId)) {
    fail("ORCHESTRATION_INVOCATION_ID_INVALID");
  }
  const transcript = normalizeTranscript(envelope.transcript);
  const consumedEffectIds = new Set();

  try {
    const result = await runOrchestrationEpoch({
      ...request,
      adapters: bridgeAdapters(request.invocationId, transcript, consumedEffectIds),
    });
    assertNoUnusedTranscript(transcript, consumedEffectIds);
    return { schemaVersion: 1, state: "complete", result };
  } catch (error) {
    const effects = effectRequests(error);
    if (!effects) throw error;
    assertNoUnusedTranscript(transcript, consumedEffectIds);
    const byId = new Map();
    for (const effect of effects) {
      if (
        !effect ||
        typeof effect !== "object" ||
        !EFFECT_ADAPTERS.includes(effect.adapter) ||
        typeof effect.effectId !== "string" ||
        effect.invocationId !== request.invocationId ||
        !Number.isSafeInteger(effect.occurrence) ||
        effect.occurrence < 1 ||
        effect.effectId !==
          effectId(request.invocationId, effect.adapter, effect.input, effect.occurrence) ||
        byId.has(effect.effectId)
      ) {
        fail("ORCHESTRATION_EFFECT_INVALID");
      }
      byId.set(effect.effectId, effect);
    }
    return {
      schemaVersion: 1,
      state: "needs-effects",
      effects: [...byId.values()].sort((left, right) =>
        left.effectId.localeCompare(right.effectId),
      ),
    };
  }
}
