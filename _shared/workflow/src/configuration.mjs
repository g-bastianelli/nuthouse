import fs from "node:fs";
import path from "node:path";

export const WORKFLOW_CONFIGURATION_SCHEMA_VERSION = 1;
export const WORKFLOW_PROFILES = Object.freeze(["quick", "standard", "strict"]);

const WORKFLOW_PROFILE_SET = new Set(WORKFLOW_PROFILES);
const CONFIGURATION_FIELDS = new Set(["schemaVersion", "defaultProfile"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validationDiagnostic(code, field, message) {
  return { code, field, message };
}

function withSource(diagnostic, source, filePath) {
  return {
    ...diagnostic,
    source,
    ...(filePath === undefined ? {} : { path: filePath }),
  };
}

function withResolutionDisposition(diagnostic, { severity, fallback, blocked = false }) {
  return {
    ...diagnostic,
    severity,
    ...(fallback === undefined ? {} : { fallback }),
    ...(blocked ? { blocked: true } : {}),
  };
}

function sourceEntry(source, profile, filePath) {
  return {
    source,
    profile,
    ...(filePath === undefined ? {} : { path: filePath }),
  };
}

function invalidProfileDiagnostic(source, field, value) {
  return {
    code: `invalid-${source}-profile`,
    source,
    field,
    severity: "error",
    blocked: true,
    message: `Expected one of ${WORKFLOW_PROFILES.join(", ")} at ${field}; received ${JSON.stringify(value)}.`,
  };
}

export function isWorkflowProfile(value) {
  return typeof value === "string" && WORKFLOW_PROFILE_SET.has(value);
}

export function validateWorkflowConfiguration(value) {
  if (!isRecord(value)) {
    return {
      ok: false,
      diagnostics: [
        validationDiagnostic(
          "invalid-type",
          "$",
          "Expected the configuration root to be an object.",
        ),
      ],
    };
  }

  const diagnostics = [];
  const unknownFields = Object.keys(value)
    .filter((field) => !CONFIGURATION_FIELDS.has(field))
    .sort();

  for (const field of unknownFields) {
    diagnostics.push(
      validationDiagnostic("unknown-field", `$.${field}`, `Unknown configuration field: ${field}.`),
    );
  }

  if (!Object.hasOwn(value, "schemaVersion")) {
    diagnostics.push(
      validationDiagnostic(
        "missing-field",
        "$.schemaVersion",
        "The schemaVersion field is required.",
      ),
    );
  } else if (value.schemaVersion !== WORKFLOW_CONFIGURATION_SCHEMA_VERSION) {
    diagnostics.push(
      validationDiagnostic(
        "unsupported-schema-version",
        "$.schemaVersion",
        `Expected schemaVersion ${WORKFLOW_CONFIGURATION_SCHEMA_VERSION}.`,
      ),
    );
  }

  if (!Object.hasOwn(value, "defaultProfile")) {
    diagnostics.push(
      validationDiagnostic(
        "missing-field",
        "$.defaultProfile",
        "The defaultProfile field is required.",
      ),
    );
  } else if (!isWorkflowProfile(value.defaultProfile)) {
    diagnostics.push(
      validationDiagnostic(
        "invalid-profile",
        "$.defaultProfile",
        `Expected defaultProfile to be one of ${WORKFLOW_PROFILES.join(", ")}.`,
      ),
    );
  }

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  return {
    ok: true,
    value: {
      schemaVersion: WORKFLOW_CONFIGURATION_SCHEMA_VERSION,
      defaultProfile: value.defaultProfile,
    },
    diagnostics: [],
  };
}

export function loadWorkflowConfiguration(filePath, { source = "configuration" } = {}) {
  let contents;
  try {
    contents = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        status: "missing",
        source,
        path: filePath,
        diagnostics: [],
      };
    }

    return {
      status: "invalid",
      source,
      path: filePath,
      diagnostics: [
        withSource(
          validationDiagnostic(
            "read-failed",
            "$",
            `Could not read the configuration: ${error instanceof Error ? error.message : String(error)}.`,
          ),
          source,
          filePath,
        ),
      ],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return {
      status: "invalid",
      source,
      path: filePath,
      diagnostics: [
        withSource(
          validationDiagnostic("invalid-json", "$", "The configuration is not valid JSON."),
          source,
          filePath,
        ),
      ],
    };
  }

  const validation = validateWorkflowConfiguration(parsed);
  if (!validation.ok) {
    return {
      status: "invalid",
      source,
      path: filePath,
      diagnostics: validation.diagnostics.map((diagnostic) =>
        withSource(diagnostic, source, filePath),
      ),
    };
  }

  return {
    status: "valid",
    source,
    path: filePath,
    configuration: validation.value,
    diagnostics: [],
  };
}

export class WorkflowConfigurationError extends Error {
  constructor(
    message,
    { code, source, field, filePath, diagnostics = [], blocked = true, cause } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "WorkflowConfigurationError";
    this.code = code;
    this.source = source;
    this.path = filePath;
    this.field = field;
    this.diagnostics = diagnostics;
    this.blocked = blocked;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      source: this.source,
      path: this.path,
      field: this.field,
      diagnostics: this.diagnostics,
      blocked: this.blocked,
    };
  }
}

export class RepositoryConfigurationError extends WorkflowConfigurationError {
  constructor({ filePath, diagnostics }) {
    const field = diagnostics[0]?.field ?? "$";
    super(`Invalid repository workflow configuration at ${field}.`, {
      code: "invalid-repository-configuration",
      source: "repository",
      field,
      filePath,
      diagnostics,
      blocked: true,
    });
    this.name = "RepositoryConfigurationError";
  }
}

export function resolveConfiguration(options = {}) {
  const {
    personalConfigPath,
    projectRoot,
    worktreeOverride,
    worktreeOverridePath,
    invocationProfile,
    diagnostics: inheritedDiagnostics = [],
  } = options;
  const repositoryConfigPath =
    options.repositoryConfigPath ??
    (projectRoot === undefined ? undefined : path.join(projectRoot, ".nuthouse", "workflow.json"));
  const configurationSources = [sourceEntry("core", "standard")];
  const diagnostics = [...inheritedDiagnostics];
  let requestedProfile = "standard";

  if (personalConfigPath !== undefined) {
    const personal = loadWorkflowConfiguration(personalConfigPath, { source: "personal" });
    if (personal.status === "valid") {
      requestedProfile = personal.configuration.defaultProfile;
      configurationSources.push(
        sourceEntry("personal", personal.configuration.defaultProfile, personal.path),
      );
    } else if (personal.status === "invalid") {
      diagnostics.push(
        ...personal.diagnostics.map((diagnostic) =>
          withResolutionDisposition(diagnostic, {
            severity: "warning",
            fallback: "core",
          }),
        ),
      );
    }
  }

  if (repositoryConfigPath !== undefined) {
    const repository = loadWorkflowConfiguration(repositoryConfigPath, { source: "repository" });
    if (repository.status === "invalid") {
      throw new RepositoryConfigurationError({
        filePath: repository.path,
        diagnostics: repository.diagnostics.map((diagnostic) =>
          withResolutionDisposition(diagnostic, { severity: "error", blocked: true }),
        ),
      });
    }
    if (repository.status === "valid") {
      requestedProfile = repository.configuration.defaultProfile;
      configurationSources.push(
        sourceEntry("repository", repository.configuration.defaultProfile, repository.path),
      );
    }
  }

  if (worktreeOverride !== undefined && worktreeOverride !== null) {
    if (isRecord(worktreeOverride) && isWorkflowProfile(worktreeOverride.profile)) {
      requestedProfile = worktreeOverride.profile;
      configurationSources.push(
        sourceEntry("worktree", worktreeOverride.profile, worktreeOverridePath),
      );
    } else {
      diagnostics.push({
        code: "invalid-worktree-profile",
        source: "worktree",
        field: "$.profile",
        severity: "warning",
        fallback: "repository",
        message: `Expected one of ${WORKFLOW_PROFILES.join(", ")} at $.profile.`,
      });
    }
  }

  if (invocationProfile !== undefined) {
    if (!isWorkflowProfile(invocationProfile)) {
      const diagnostic = invalidProfileDiagnostic(
        "invocation",
        "$.invocationProfile",
        invocationProfile,
      );
      throw new WorkflowConfigurationError("Invalid invocation workflow profile.", {
        code: diagnostic.code,
        source: diagnostic.source,
        field: diagnostic.field,
        diagnostics: [diagnostic],
        blocked: true,
      });
    }
    requestedProfile = invocationProfile;
    configurationSources.push(sourceEntry("invocation", invocationProfile));
  }

  return {
    requestedProfile,
    configurationSources,
    diagnostics,
    blocked: false,
  };
}

export function buildModeStatus(configuration, policyProjection = {}) {
  if (!isRecord(configuration) || !isWorkflowProfile(configuration.requestedProfile)) {
    throw new TypeError("buildModeStatus requires a resolved workflow configuration.");
  }

  const effectiveProfile = policyProjection.effectiveProfile ?? configuration.requestedProfile;
  if (!isWorkflowProfile(effectiveProfile)) {
    throw new TypeError("The effective workflow profile is invalid.");
  }

  return {
    requestedProfile: configuration.requestedProfile,
    effectiveProfile,
    configurationSources: [...(configuration.configurationSources ?? [])],
    escalations: [...(policyProjection.escalations ?? [])],
    enabledCapabilities: [...(policyProjection.enabledCapabilities ?? [])],
    diagnostics: [...(configuration.diagnostics ?? []), ...(policyProjection.diagnostics ?? [])],
    blocked: policyProjection.blocked ?? configuration.blocked ?? false,
  };
}
