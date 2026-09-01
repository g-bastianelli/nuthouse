export const NATIVE_VERIFICATION_SOURCES = Object.freeze([
  "repository-instructions",
  "repository-build-metadata",
]);

const NATIVE_VERIFICATION_SOURCE_SET = new Set(NATIVE_VERIFICATION_SOURCES);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasControlCharacters(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 31 || codePoint === 127) return true;
  }
  return false;
}

function normalizeCommands(value) {
  if (!Array.isArray(value)) return [];

  const commands = [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== "string" || hasControlCharacters(entry)) {
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

function isSafeRelativePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    hasControlCharacters(value)
  ) {
    return false;
  }
  const segments = value.split("/");
  return !segments.includes("") && !segments.includes(".") && !segments.includes("..");
}

function isInstructionPath(value) {
  if (!isSafeRelativePath(value)) return false;
  const basename = value.split("/").at(-1);
  return basename === "AGENTS.md" || basename === "CLAUDE.md";
}

function normalizeTargets(value, fallback = []) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.length === 0) return [];

  const targets = [];
  const seen = new Set();
  for (const entry of value) {
    if (
      typeof entry !== "string" ||
      entry.trim() !== entry ||
      entry.length === 0 ||
      hasControlCharacters(entry)
    ) {
      return [];
    }
    if (seen.has(entry)) continue;
    seen.add(entry);
    targets.push(entry);
  }
  return targets;
}

function ready(strategy, verifier, commands, targets = [], provenance = []) {
  return {
    status: "ready",
    strategy,
    verifier,
    commands,
    targets,
    provenance,
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
    targets: [],
    provenance: [],
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

function resolveStructuredNative(native) {
  if (!isRecord(native) || !Array.isArray(native.sources) || native.sources.length === 0) {
    return null;
  }

  const commands = [];
  const provenance = [];
  const seen = new Set();
  for (const entry of native.sources) {
    if (
      !isRecord(entry) ||
      !NATIVE_VERIFICATION_SOURCE_SET.has(entry.source) ||
      !isSafeRelativePath(entry.path) ||
      (entry.source === "repository-instructions" && !isInstructionPath(entry.path))
    ) {
      return null;
    }
    const sourceCommands = normalizeCommands(entry.commands);
    if (sourceCommands.length === 0) return null;
    for (const command of sourceCommands) {
      if (seen.has(command)) continue;
      seen.add(command);
      commands.push(command);
      provenance.push({ command, source: entry.source, path: entry.path });
    }
  }

  if (commands.length === 0) return null;
  return ready("native", "repository-owned", commands, ["repository"], provenance);
}

export function resolveVerificationStrategy(input = {}) {
  if (!isRecord(input)) throw new TypeError("Verification input must be an object.");

  const specialized = input.specializedVerifier;
  if (input.moonWorkspace !== false && isRecord(specialized) && specialized.available === true) {
    const commands = normalizeCommands(specialized.commands);
    const legacy = input.moonWorkspace === undefined;
    const id = typeof specialized.id === "string" ? specialized.id.trim() : "";
    const targets = normalizeTargets(specialized.targets, legacy ? [] : undefined);
    const validMoonVerifier =
      legacy || (id === "moon-moth:verify" && specialized.source === "moon-moth:verify");
    if (
      commands.length > 0 &&
      id.length > 0 &&
      validMoonVerifier &&
      (legacy || targets.length > 0)
    ) {
      return ready("specialized", id, commands, targets, []);
    }
    if (input.moonWorkspace === true) return blocked();
  }

  if (input.moonWorkspace === true) return blocked();

  const native = input.nativeVerification;
  const structured = resolveStructuredNative(native);
  if (structured !== null) return structured;
  if (isRecord(native) && NATIVE_VERIFICATION_SOURCE_SET.has(native.source)) {
    const commands = normalizeCommands(native.commands);
    if (commands.length > 0) {
      return ready("native", native.source, commands, ["repository"], []);
    }
  }

  return blocked();
}
