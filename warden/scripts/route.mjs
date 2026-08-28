#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as installedWorkflow from "../lib/workflow/index.mjs";

function blockedDiagnostic(code, field, message) {
  return {
    code,
    source: "classification",
    ...(field === undefined ? {} : { field }),
    message,
    blocked: true,
  };
}

function routeResult(workflow, projectIntent, issueIdentifiers, target, diagnostics = []) {
  return {
    workflow,
    projectIntent,
    issueIdentifiers,
    target,
    diagnostics,
    blocked: workflow === "ambiguous",
  };
}

export function normalizeRouteInput(taskOrInput, injected = {}) {
  const input =
    taskOrInput && typeof taskOrInput === "object"
      ? { ...taskOrInput, ...injected }
      : { ...injected, task: taskOrInput };

  return {
    ...input,
    projectIntent: typeof input.projectIntent === "string" ? input.projectIntent : "",
    task: typeof input.task === "string" ? input.task : "",
  };
}

export function discoverCurrentBranch(cwd = process.cwd()) {
  return execFileSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function targetFor(workflow, issueIdentifiers) {
  switch (workflow) {
    case "project-creation":
      return { kind: "skill", name: "linear-devotee:create-project" };
    case "issue-delivery":
      return {
        kind: "skill",
        name: "linear-devotee:greet",
        arguments: [issueIdentifiers[0]],
      };
    case "direct-task":
      return { kind: "current-turn", name: "direct-task" };
    case "ambiguous":
      return null;
    default:
      throw new TypeError(`Unsupported workflow classification: ${JSON.stringify(workflow)}.`);
  }
}

function ambiguityDiagnostics(projectIntent, issueIdentifiers) {
  if (projectIntent === "ambiguous") {
    return [
      blockedDiagnostic(
        "ambiguous-project-intent",
        "$.projectIntent",
        "Explicit Linear project intent could not be normalized confidently.",
      ),
    ];
  }

  if (projectIntent === "explicit" && issueIdentifiers.length > 0) {
    return [
      blockedDiagnostic(
        "incompatible-workflow-signals",
        "$.signals",
        "Explicit Linear project creation conflicts with Linear issue-delivery evidence.",
      ),
    ];
  }

  if (issueIdentifiers.length > 1) {
    return [
      blockedDiagnostic(
        "multiple-linear-issue-identifiers",
        "$.issueIdentifiers",
        "Multiple distinct Linear issue identifiers prevent deterministic issue delivery.",
      ),
    ];
  }

  return [
    blockedDiagnostic(
      "ambiguous-workflow-signals",
      "$.signals",
      "The normalized workflow signals remain ambiguous.",
    ),
  ];
}

/**
 * Classify one normalized Warden route request without invoking the returned target.
 * Environment-specific branch discovery and the workflow bundle remain injectable so
 * Claude and Codex adapters execute the same policy path.
 */
export function runRoute(taskOrInput, injected = {}) {
  const input = normalizeRouteInput(taskOrInput, injected);
  const workflowBundle = input.workflow ?? installedWorkflow;
  const branch =
    typeof input.branch === "string"
      ? input.branch
      : discoverCurrentBranch(input.cwd ?? process.cwd());
  const issueIdentifiers = workflowBundle.collectLinearIssueIds({
    request: input.task,
    branch,
  });

  if (!workflowBundle.isProjectIntent(input.projectIntent)) {
    return routeResult("ambiguous", input.projectIntent, issueIdentifiers, null, [
      blockedDiagnostic(
        "invalid-project-intent",
        "$.projectIntent",
        `Expected one of ${workflowBundle.PROJECT_INTENTS.join(", ")}; received ${JSON.stringify(input.projectIntent)}.`,
      ),
    ]);
  }

  const classification = workflowBundle.classifyWorkflow({
    projectIntent: input.projectIntent,
    request: input.task,
    branch,
  });
  if (!workflowBundle.isWorkflowClassification(classification)) {
    throw new TypeError(`Workflow bundle returned an invalid classification: ${classification}.`);
  }

  return routeResult(
    classification,
    input.projectIntent,
    issueIdentifiers,
    targetFor(classification, issueIdentifiers),
    classification === "ambiguous"
      ? ambiguityDiagnostics(input.projectIntent, issueIdentifiers)
      : [],
  );
}

export function parseRouteArguments(args) {
  const separator = args.indexOf("--");
  const options = separator === -1 ? args : args.slice(0, separator);
  const taskArguments = separator === -1 ? [] : args.slice(separator + 1);

  if (options.length !== 2 || options[0] !== "--project-intent") {
    throw new TypeError(
      "Expected --project-intent <explicit|absent|ambiguous> before the task separator.",
    );
  }

  return {
    projectIntent: options[1],
    task: taskArguments.join(" "),
  };
}

function unexpectedRouteResult(error, projectIntent = "") {
  return routeResult("ambiguous", projectIntent, [], null, [
    {
      code: "route-command-failed",
      source: "runtime",
      message: error instanceof Error ? error.message : String(error),
      blocked: true,
    },
  ]);
}

function main() {
  let parsed;
  let result;
  try {
    parsed = parseRouteArguments(process.argv.slice(2));
    result = runRoute(parsed);
  } catch (error) {
    result = unexpectedRouteResult(error, parsed?.projectIntent ?? "");
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.blocked) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main();
