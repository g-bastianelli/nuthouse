#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as installedWorkflow from "../lib/workflow/index.mjs";

export const MODE_ACTIONS = Object.freeze(["quick", "standard", "strict", "status", "reset"]);
export const WORKTREE_OVERRIDE_DURATION_MS = 24 * 60 * 60 * 1000;

const PROFILE_ACTIONS = new Set(["quick", "standard", "strict"]);

export function getDefaultPersonalConfigPath(homeDirectory = os.homedir()) {
  return path.join(homeDirectory, ".nuthouse", "workflow.json");
}

export function normalizeModeInput(actionOrInput, injected = {}) {
  const input =
    actionOrInput && typeof actionOrInput === "object"
      ? { ...actionOrInput, ...injected }
      : { ...injected, action: actionOrInput };

  return {
    ...input,
    action: typeof input.action === "string" ? input.action : "",
  };
}

function normalizeNow(now) {
  const value = typeof now === "function" ? now() : (now ?? new Date());
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("mode clock must resolve to a valid date");
  }

  return date;
}

function normalizeStatus(status) {
  return {
    requestedProfile: status?.requestedProfile ?? null,
    effectiveProfile: status?.effectiveProfile ?? null,
    configurationSources: Array.isArray(status?.configurationSources)
      ? status.configurationSources
      : [],
    escalations: Array.isArray(status?.escalations) ? status.escalations : [],
    enabledCapabilities: Array.isArray(status?.enabledCapabilities)
      ? status.enabledCapabilities
      : [],
    diagnostics: Array.isArray(status?.diagnostics) ? status.diagnostics : [],
    blocked: status?.blocked === true,
  };
}

function invalidActionStatus(action) {
  return normalizeStatus({
    diagnostics: [
      {
        code: "invalid-mode-action",
        source: "invocation",
        field: "$.action",
        message: `Expected one of ${MODE_ACTIONS.join(", ")}; received ${JSON.stringify(action)}.`,
        blocked: true,
      },
    ],
    blocked: true,
  });
}

function modeResult(action, status, override = null) {
  return { action, status: normalizeStatus(status), override };
}

function errorDetails(error) {
  if (typeof error?.toJSON === "function") return error.toJSON();
  return error && typeof error === "object" ? error : {};
}

function repositoryErrorStatus(error) {
  const details = errorDetails(error);
  const reportedDiagnostic = Array.isArray(details.diagnostics)
    ? details.diagnostics.find(
        (diagnostic) => diagnostic?.source === "repository" && diagnostic?.field,
      )
    : undefined;
  const diagnostics = [
    reportedDiagnostic ?? {
      code: details.code ?? "invalid-repository-configuration",
      source: details.source ?? "repository",
      path: details.path,
      field: details.field,
      message: details.message ?? "Repository workflow configuration is invalid.",
      blocked: true,
    },
  ];

  return normalizeStatus({ diagnostics, blocked: true });
}

function isRepositoryConfigurationError(error, workflow) {
  if (
    typeof workflow.RepositoryConfigurationError === "function" &&
    error instanceof workflow.RepositoryConfigurationError
  ) {
    return true;
  }

  const details = errorDetails(error);
  return details.blocked === true && details.source === "repository";
}

function repositoryConfigPathFor(input, context) {
  if (input.repositoryConfigPath) return input.repositoryConfigPath;

  const worktreeRoot = context.worktreeRoot ?? context.repositoryRoot;
  if (!worktreeRoot) {
    throw new TypeError("Git context must include worktreeRoot");
  }

  return path.join(worktreeRoot, ".nuthouse", "workflow.json");
}

async function resolveConfiguration(workflow, paths) {
  return workflow.resolveConfiguration({
    personalConfigPath: paths.personalConfigPath,
    repositoryConfigPath: paths.repositoryConfigPath,
  });
}

async function extendConfiguration(workflow, configuration, paths, worktreeOverride, diagnostics) {
  return workflow.extendConfigurationResolution(configuration, {
    worktreeOverride,
    worktreeOverridePath: paths.worktreeOverridePath,
    diagnostics,
  });
}

async function statusFor(workflow, configuration) {
  return normalizeStatus(await workflow.buildModeStatus(configuration));
}

function persistedOverrideMetadata(workflow, context, override) {
  if (!override) return null;
  return {
    path: workflow.getWorktreeOverridePath(context),
    profile: override.profile,
    expiresAt: override.expiresAt,
  };
}

/**
 * Run one Warden mode operation.
 *
 * The first argument may be an action string or a normalized adapter input object.
 * All environment-specific values (workflow bundle, clock, paths, and Git context)
 * remain injectable so Claude and Codex adapters execute the same policy path.
 */
export async function runMode(actionOrInput, injected = {}) {
  const input = normalizeModeInput(actionOrInput, injected);
  if (!MODE_ACTIONS.includes(input.action)) {
    return modeResult(input.action, invalidActionStatus(input.action));
  }

  const workflow = input.workflow ?? installedWorkflow;
  const now = normalizeNow(input.now);
  const context =
    input.gitContext ?? (await workflow.discoverGitContext(input.cwd ?? process.cwd()));
  const paths = {
    personalConfigPath:
      input.personalConfigPath ?? getDefaultPersonalConfigPath(input.homeDirectory),
    repositoryConfigPath: repositoryConfigPathFor(input, context),
    worktreeOverridePath: workflow.getWorktreeOverridePath(context),
  };

  if (input.action === "reset") {
    try {
      const configuration = await resolveConfiguration(workflow, paths);
      const removed = await workflow.resetWorktreeOverride(context);
      const override = { path: paths.worktreeOverridePath, removed };
      return modeResult(input.action, await statusFor(workflow, configuration), override);
    } catch (error) {
      if (isRepositoryConfigurationError(error, workflow)) {
        return modeResult(input.action, repositoryErrorStatus(error));
      }
      throw error;
    }
  }

  try {
    // Repository validation must finish before a profile write or expiry cleanup.
    const validatedConfiguration = await resolveConfiguration(workflow, paths);

    let override;
    let diagnostics = [];
    if (PROFILE_ACTIONS.has(input.action)) {
      override = await workflow.writeWorktreeOverride(context, input.action, {
        now,
        durationMs: WORKTREE_OVERRIDE_DURATION_MS,
      });
    } else {
      const result = await workflow.readWorktreeOverride(context, {
        now,
        repositoryValidated: true,
      });
      override = result.override;
      diagnostics = result.diagnostics ?? [];
    }

    const configuration = await extendConfiguration(
      workflow,
      validatedConfiguration,
      paths,
      override,
      diagnostics,
    );
    return modeResult(
      input.action,
      await statusFor(workflow, configuration),
      persistedOverrideMetadata(workflow, context, override),
    );
  } catch (error) {
    if (isRepositoryConfigurationError(error, workflow)) {
      return modeResult(input.action, repositoryErrorStatus(error));
    }
    throw error;
  }
}

function unexpectedErrorStatus(error) {
  return normalizeStatus({
    diagnostics: [
      {
        code: "mode-command-failed",
        source: "runtime",
        message: error instanceof Error ? error.message : String(error),
        blocked: true,
      },
    ],
    blocked: true,
  });
}

async function main() {
  let result;
  try {
    result = await runMode(process.argv[2]);
  } catch (error) {
    result = modeResult(process.argv[2] ?? "", unexpectedErrorStatus(error));
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status.blocked) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) await main();
