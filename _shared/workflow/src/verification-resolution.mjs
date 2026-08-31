export const NATIVE_VERIFICATION_SOURCES = Object.freeze([
  "repository-instructions",
  "repository-build-metadata",
]);

const NATIVE_VERIFICATION_SOURCE_SET = new Set(NATIVE_VERIFICATION_SOURCES);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeCommands(value) {
  if (!Array.isArray(value)) return [];

  const commands = [];
  const seen = new Set();
  for (const entry of value) {
    if (
      typeof entry !== "string" ||
      entry.includes("\n") ||
      entry.includes("\r") ||
      entry.includes("\0")
    ) {
      return [];
    }
    const command = entry.trim();
    if (command.length === 0) return [];
    if (seen.has(command)) continue;
    seen.add(command);
    commands.push(command);
  }
  return commands;
}

function ready(strategy, verifier, commands) {
  return {
    status: "ready",
    strategy,
    verifier,
    commands,
    diagnostics: [],
    blocked: false,
  };
}

function blocked() {
  return {
    status: "blocked",
    strategy: "none",
    verifier: null,
    commands: [],
    diagnostics: [
      {
        code: "verification-strategy-unavailable",
        source: "verification",
        field: "$.verification",
        message:
          "No available specialized verifier or reliable repository-owned native command set was declared.",
        blocked: true,
      },
    ],
    blocked: true,
  };
}

export function resolveVerificationStrategy(input = {}) {
  if (!isRecord(input)) throw new TypeError("Verification input must be an object.");

  const specialized = input.specializedVerifier;
  if (
    isRecord(specialized) &&
    specialized.available === true &&
    typeof specialized.id === "string" &&
    specialized.id.trim().length > 0
  ) {
    const commands = normalizeCommands(specialized.commands);
    if (commands.length > 0) return ready("specialized", specialized.id.trim(), commands);
  }

  const native = input.nativeVerification;
  if (isRecord(native) && NATIVE_VERIFICATION_SOURCE_SET.has(native.source)) {
    const commands = normalizeCommands(native.commands);
    if (commands.length > 0) return ready("native", native.source, commands);
  }

  return blocked();
}
