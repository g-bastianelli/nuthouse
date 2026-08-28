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

function ambiguityDiagnostics(projectIntent, evidence) {
  const { issueIds, linearTeamKeysUnavailable, unresolvedBareIssueIds } = evidence;

  if (projectIntent === "ambiguous") {
    return [
      blockedDiagnostic(
        "ambiguous-project-intent",
        "$.projectIntent",
        "Explicit Linear project intent could not be normalized confidently.",
      ),
    ];
  }

  if (projectIntent === "explicit" && issueIds.length > 0) {
    return [
      blockedDiagnostic(
        "incompatible-workflow-signals",
        "$.signals",
        "Explicit Linear project creation conflicts with Linear issue-delivery evidence.",
      ),
    ];
  }

  if (issueIds.length > 1) {
    return [
      blockedDiagnostic(
        "multiple-linear-issue-identifiers",
        "$.issueIdentifiers",
        "Multiple distinct Linear issue identifiers prevent deterministic issue delivery.",
      ),
    ];
  }

  if (linearTeamKeysUnavailable && unresolvedBareIssueIds.length > 0) {
    return [
      blockedDiagnostic(
        "linear-team-keys-unavailable",
        "$.linearTeamKeys",
        "Linear team metadata is unavailable, so bare issue candidates cannot be validated.",
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
  const classificationInput = {
    projectIntent: input.projectIntent,
    request: input.task,
    branch,
    linearTeamKeys: input.linearTeamKeys,
  };
  const evidence = workflowBundle.collectLinearIssueEvidence(classificationInput);
  const issueIdentifiers = evidence.issueIds;

  if (!workflowBundle.isProjectIntent(input.projectIntent)) {
    return routeResult("ambiguous", input.projectIntent, issueIdentifiers, null, [
      blockedDiagnostic(
        "invalid-project-intent",
        "$.projectIntent",
        `Expected one of ${workflowBundle.PROJECT_INTENTS.join(", ")}; received ${JSON.stringify(input.projectIntent)}.`,
      ),
    ]);
  }

  const classification = workflowBundle.classifyWorkflow(classificationInput);
  if (!workflowBundle.isWorkflowClassification(classification)) {
    throw new TypeError(`Workflow bundle returned an invalid classification: ${classification}.`);
  }

  return routeResult(
    classification,
    input.projectIntent,
    issueIdentifiers,
    targetFor(classification, issueIdentifiers),
    classification === "ambiguous" ? ambiguityDiagnostics(input.projectIntent, evidence) : [],
  );
}

export function parseRouteArguments(args) {
  let projectIntent;
  let readsTaskFromStdin = false;
  let teamKeyMode = "unspecified";
  const linearTeamKeys = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--project-intent") {
      if (projectIntent !== undefined || index + 1 >= args.length) {
        throw new TypeError("Expected exactly one --project-intent <value> option.");
      }
      projectIntent = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === "--linear-team-key") {
      if ((teamKeyMode !== "unspecified" && teamKeyMode !== "keys") || index + 1 >= args.length) {
        throw new TypeError(
          "Expected team-key options, --linear-team-keys-empty, or --linear-team-keys-unavailable, never more than one mode.",
        );
      }
      teamKeyMode = "keys";
      linearTeamKeys.push(args[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--linear-team-keys-empty") {
      if (teamKeyMode !== "unspecified") {
        throw new TypeError(
          "Expected team-key options, --linear-team-keys-empty, or --linear-team-keys-unavailable, never more than one mode.",
        );
      }
      teamKeyMode = "empty";
      continue;
    }

    if (argument === "--linear-team-keys-unavailable") {
      if (teamKeyMode !== "unspecified") {
        throw new TypeError(
          "Expected team-key options, --linear-team-keys-empty, or --linear-team-keys-unavailable, never more than one mode.",
        );
      }
      teamKeyMode = "unavailable";
      continue;
    }

    if (argument === "--stdin") {
      if (readsTaskFromStdin) throw new TypeError("Expected exactly one --stdin option.");
      readsTaskFromStdin = true;
      continue;
    }

    throw new TypeError(`Unknown route option: ${JSON.stringify(argument)}.`);
  }

  if (projectIntent === undefined) {
    throw new TypeError("Missing --project-intent <explicit|absent|ambiguous>.");
  }
  if (!readsTaskFromStdin) {
    throw new TypeError("Task input must be provided through --stdin.");
  }
  if (teamKeyMode === "unspecified") {
    throw new TypeError(
      "Pass --linear-team-key, --linear-team-keys-empty, or --linear-team-keys-unavailable.",
    );
  }

  const normalizedTeamKeys =
    teamKeyMode === "unavailable"
      ? null
      : installedWorkflow.normalizeLinearTeamKeys(linearTeamKeys);
  if (teamKeyMode !== "unavailable" && normalizedTeamKeys === null) {
    throw new TypeError("Every --linear-team-key value must be canonical.");
  }

  return {
    projectIntent,
    linearTeamKeys: normalizedTeamKeys,
  };
}

export async function readTaskFromStdin(stream = process.stdin) {
  stream.setEncoding?.("utf8");
  let task = "";
  for await (const chunk of stream) task += chunk;
  return task;
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

async function main() {
  let parsed;
  let result;
  try {
    parsed = parseRouteArguments(process.argv.slice(2));
    const task = await readTaskFromStdin();
    result = runRoute({ ...parsed, task });
  } catch (error) {
    result = unexpectedRouteResult(error, parsed?.projectIntent ?? "");
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.blocked) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) await main();
