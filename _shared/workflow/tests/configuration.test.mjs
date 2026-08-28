import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RepositoryConfigurationError,
  WORKFLOW_CONFIGURATION_SCHEMA_VERSION,
  WORKFLOW_PROFILES,
  buildModeStatus,
  extendConfigurationResolution,
  loadWorkflowConfiguration,
  resolveConfiguration,
  validateWorkflowConfiguration,
} from "../src/index.mjs";

let temporaryDirectory;

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nuthouse-workflow-config-"));
});

afterEach(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function writeJson(relativePath, value) {
  const filePath = path.join(temporaryDirectory, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

describe("workflow configuration schema", () => {
  test("exports the exact supported profile and schema contracts", () => {
    expect(WORKFLOW_PROFILES).toEqual(["quick", "standard", "strict"]);
    expect(WORKFLOW_CONFIGURATION_SCHEMA_VERSION).toBe(1);
  });

  test("accepts only the strict version-one configuration shape", () => {
    expect(validateWorkflowConfiguration({ schemaVersion: 1, defaultProfile: "strict" })).toEqual({
      ok: true,
      value: { schemaVersion: 1, defaultProfile: "strict" },
      diagnostics: [],
    });
  });

  const invalidConfigurations = [
    {
      name: "a non-object root",
      value: [],
      fields: ["$"],
    },
    {
      name: "a missing schema version",
      value: { defaultProfile: "standard" },
      fields: ["$.schemaVersion"],
    },
    {
      name: "a wrong schema version",
      value: { schemaVersion: 2, defaultProfile: "standard" },
      fields: ["$.schemaVersion"],
    },
    {
      name: "a missing default profile",
      value: { schemaVersion: 1 },
      fields: ["$.defaultProfile"],
    },
    {
      name: "an invalid default profile",
      value: { schemaVersion: 1, defaultProfile: "turbo" },
      fields: ["$.defaultProfile"],
    },
    {
      name: "an unknown field",
      value: { schemaVersion: 1, defaultProfile: "standard", extra: true },
      fields: ["$.extra"],
    },
  ];

  for (const fixture of invalidConfigurations) {
    test(`reports JSONPath-like fields for ${fixture.name}`, () => {
      const result = validateWorkflowConfiguration(fixture.value);

      expect(result.ok).toBe(false);
      expect(result.diagnostics.map(({ field }) => field)).toEqual(fixture.fields);
    });
  }
});

describe("configuration file loading", () => {
  test("distinguishes missing, valid, and malformed files", () => {
    const missingPath = path.join(temporaryDirectory, "missing.json");
    const validPath = writeJson("valid.json", {
      schemaVersion: 1,
      defaultProfile: "quick",
    });
    const malformedPath = path.join(temporaryDirectory, "malformed.json");
    fs.writeFileSync(malformedPath, "{ definitely not JSON", "utf8");

    expect(loadWorkflowConfiguration(missingPath, { source: "personal" })).toEqual({
      status: "missing",
      source: "personal",
      path: missingPath,
      diagnostics: [],
    });

    expect(loadWorkflowConfiguration(validPath, { source: "personal" })).toEqual({
      status: "valid",
      source: "personal",
      path: validPath,
      configuration: { schemaVersion: 1, defaultProfile: "quick" },
      diagnostics: [],
    });

    const malformed = loadWorkflowConfiguration(malformedPath, { source: "repository" });
    expect(malformed.status).toBe("invalid");
    expect(malformed.diagnostics).toMatchObject([
      {
        code: "invalid-json",
        source: "repository",
        path: malformedPath,
        field: "$",
      },
    ]);
  });
});

describe("configuration resolution", () => {
  test("defaults to the core standard profile (AC-005)", () => {
    expect(resolveConfiguration()).toEqual({
      requestedProfile: "standard",
      configurationSources: [{ source: "core", profile: "standard" }],
      diagnostics: [],
      blocked: false,
    });
  });

  test("uses core, personal, repository, worktree, then invocation precedence", () => {
    const personalConfigPath = writeJson("personal.json", {
      schemaVersion: 1,
      defaultProfile: "quick",
    });
    const projectRoot = path.join(temporaryDirectory, "repository");
    const repositoryConfigPath = writeJson("repository/.nuthouse/workflow.json", {
      schemaVersion: 1,
      defaultProfile: "strict",
    });
    const worktreeOverride = {
      schemaVersion: 1,
      worktreeId: "a".repeat(64),
      profile: "quick",
      createdAt: "2026-08-28T10:00:00.000Z",
      expiresAt: "2026-08-29T10:00:00.000Z",
    };

    const repositoryOnly = resolveConfiguration({ personalConfigPath, projectRoot });
    expect(repositoryOnly.requestedProfile).toBe("strict");
    expect(repositoryOnly.configurationSources).toEqual([
      { source: "core", profile: "standard" },
      { source: "personal", profile: "quick", path: personalConfigPath },
      { source: "repository", profile: "strict", path: repositoryConfigPath },
    ]);

    const worktree = resolveConfiguration({
      personalConfigPath,
      projectRoot,
      worktreeOverride,
      worktreeOverridePath: "/git/common/nuthouse/workflow/worktrees/override.json",
    });
    expect(worktree.requestedProfile).toBe("quick");
    expect(worktree.configurationSources.at(-1)).toEqual({
      source: "worktree",
      profile: "quick",
      path: "/git/common/nuthouse/workflow/worktrees/override.json",
    });

    const invocation = resolveConfiguration({
      personalConfigPath,
      projectRoot,
      worktreeOverride,
      invocationProfile: "standard",
    });
    expect(invocation.requestedProfile).toBe("standard");
    expect(invocation.configurationSources.map(({ source }) => source)).toEqual([
      "core",
      "personal",
      "repository",
      "worktree",
      "invocation",
    ]);
  });

  test("a repository configuration path can be injected directly", () => {
    const repositoryConfigPath = writeJson("custom-repository.json", {
      schemaVersion: 1,
      defaultProfile: "quick",
    });

    expect(resolveConfiguration({ repositoryConfigPath }).requestedProfile).toBe("quick");
  });

  test("extends a validated snapshot without rereading configuration files", () => {
    const repositoryConfigPath = writeJson("repository.json", {
      schemaVersion: 1,
      defaultProfile: "quick",
    });
    const validated = resolveConfiguration({ repositoryConfigPath });
    const validatedBefore = structuredClone(validated);
    fs.writeFileSync(repositoryConfigPath, "{ now invalid", "utf8");
    const overridePath = path.join(temporaryDirectory, "override.json");
    const expiredDiagnostic = {
      code: "expired-worktree-override",
      source: "worktree",
      field: "$.expiresAt",
      severity: "warning",
      fallback: "repository",
      message: "The worktree override has expired.",
    };

    const result = extendConfigurationResolution(validated, {
      worktreeOverride: { profile: "strict" },
      worktreeOverridePath: overridePath,
      diagnostics: [expiredDiagnostic],
    });

    expect(result).toEqual({
      requestedProfile: "strict",
      configurationSources: [
        { source: "core", profile: "standard" },
        { source: "repository", profile: "quick", path: repositoryConfigPath },
        { source: "worktree", profile: "strict", path: overridePath },
      ],
      diagnostics: [expiredDiagnostic],
      blocked: false,
    });
    expect(validated).toEqual(validatedBefore);
  });

  test("warns and falls back from invalid personal configuration before valid later layers (AC-050)", () => {
    const personalConfigPath = writeJson("personal.json", {
      schemaVersion: 1,
      defaultProfile: "turbo",
    });
    const repositoryConfigPath = writeJson("repository.json", {
      schemaVersion: 1,
      defaultProfile: "strict",
    });

    const result = resolveConfiguration({ personalConfigPath, repositoryConfigPath });

    expect(result.requestedProfile).toBe("strict");
    expect(result.configurationSources).toEqual([
      { source: "core", profile: "standard" },
      { source: "repository", profile: "strict", path: repositoryConfigPath },
    ]);
    expect(result.diagnostics).toMatchObject([
      {
        severity: "warning",
        source: "personal",
        path: personalConfigPath,
        field: "$.defaultProfile",
        fallback: "core",
      },
    ]);
  });

  const invalidRepositories = [
    {
      name: "malformed JSON",
      contents: "{ nope",
      field: "$",
    },
    {
      name: "a wrong schema version",
      value: { schemaVersion: 2, defaultProfile: "standard" },
      field: "$.schemaVersion",
    },
    {
      name: "an unknown field",
      value: { schemaVersion: 1, defaultProfile: "standard", unexpected: true },
      field: "$.unexpected",
    },
    {
      name: "an invalid profile",
      value: { schemaVersion: 1, defaultProfile: "fast" },
      field: "$.defaultProfile",
    },
  ];

  for (const fixture of invalidRepositories) {
    test(`throws a typed blocker for repository ${fixture.name} (AC-049)`, () => {
      const repositoryConfigPath = path.join(temporaryDirectory, "repository.json");
      fs.writeFileSync(
        repositoryConfigPath,
        fixture.contents ?? `${JSON.stringify(fixture.value)}\n`,
        "utf8",
      );

      let thrown;
      try {
        resolveConfiguration({ repositoryConfigPath });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RepositoryConfigurationError);
      expect(thrown).toMatchObject({
        code: "invalid-repository-configuration",
        source: "repository",
        path: repositoryConfigPath,
        field: fixture.field,
        blocked: true,
      });
      expect(thrown.toJSON()).toMatchObject({
        name: "RepositoryConfigurationError",
        code: "invalid-repository-configuration",
        source: "repository",
        path: repositoryConfigPath,
        field: fixture.field,
        blocked: true,
      });
      expect(thrown.diagnostics[0]).toMatchObject({
        severity: "error",
        source: "repository",
        field: fixture.field,
      });
    });
  }

  test("rejects invalid invocation profiles at their exact field", () => {
    expect(() => resolveConfiguration({ invocationProfile: "turbo" })).toThrow(
      expect.objectContaining({
        code: "invalid-invocation-profile",
        source: "invocation",
        field: "$.invocationProfile",
        blocked: true,
      }),
    );
  });
});

describe("mode status", () => {
  test("returns a stable truthful default projection (AC-011)", () => {
    const configuration = resolveConfiguration();

    expect(buildModeStatus(configuration)).toEqual({
      requestedProfile: "standard",
      effectiveProfile: "standard",
      configurationSources: [{ source: "core", profile: "standard" }],
      escalations: [],
      enabledCapabilities: [],
      diagnostics: [],
      blocked: false,
    });
  });

  test("projects later policy results without changing configuration semantics", () => {
    const configuration = resolveConfiguration({ invocationProfile: "quick" });
    const policyDiagnostic = {
      severity: "warning",
      source: "policy",
      field: "$.risk",
      code: "unresolved-risk",
      message: "Risk could not be resolved.",
    };

    expect(
      buildModeStatus(configuration, {
        effectiveProfile: "strict",
        escalations: [{ reason: "unresolved-risk", from: "quick", to: "strict" }],
        enabledCapabilities: ["verification", "human-acceptance"],
        diagnostics: [policyDiagnostic],
        blocked: true,
      }),
    ).toEqual({
      requestedProfile: "quick",
      effectiveProfile: "strict",
      configurationSources: [
        { source: "core", profile: "standard" },
        { source: "invocation", profile: "quick" },
      ],
      escalations: [{ reason: "unresolved-risk", from: "quick", to: "strict" }],
      enabledCapabilities: ["verification", "human-acceptance"],
      diagnostics: [policyDiagnostic],
      blocked: true,
    });
  });
});
