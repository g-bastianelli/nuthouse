export const PROJECT_INTENTS = Object.freeze(["explicit", "absent", "ambiguous"]);
export const WORKFLOW_CLASSIFICATIONS = Object.freeze([
  "project-creation",
  "issue-delivery",
  "direct-task",
  "ambiguous",
]);

const PROJECT_INTENT_SET = new Set(PROJECT_INTENTS);
const WORKFLOW_CLASSIFICATION_SET = new Set(WORKFLOW_CLASSIFICATIONS);
const LINEAR_ISSUE_ID_PATTERN = /\b([A-Za-z][A-Za-z0-9]+)-([0-9]+)\b/g;
const EXACT_LINEAR_ISSUE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]+-[0-9]+$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isProjectIntent(value) {
  return typeof value === "string" && PROJECT_INTENT_SET.has(value);
}

export function isWorkflowClassification(value) {
  return typeof value === "string" && WORKFLOW_CLASSIFICATION_SET.has(value);
}

export function normalizeLinearIssueId(value) {
  if (typeof value !== "string") return null;

  const candidate = value.trim();
  if (!EXACT_LINEAR_ISSUE_ID_PATTERN.test(candidate)) return null;

  return candidate.toUpperCase();
}

export function extractLinearIssueIds(value) {
  if (typeof value !== "string") return [];

  const issueIds = [];
  const seen = new Set();

  for (const match of value.matchAll(LINEAR_ISSUE_ID_PATTERN)) {
    const issueId = normalizeLinearIssueId(match[0]);
    if (issueId === null || seen.has(issueId)) continue;

    seen.add(issueId);
    issueIds.push(issueId);
  }

  return issueIds;
}

export function collectLinearIssueIds({ request, branch } = {}) {
  const issueIds = [];
  const seen = new Set();

  for (const issueId of [...extractLinearIssueIds(request), ...extractLinearIssueIds(branch)]) {
    if (seen.has(issueId)) continue;

    seen.add(issueId);
    issueIds.push(issueId);
  }

  return issueIds;
}

export function classifyWorkflow(input) {
  if (!isRecord(input)) {
    throw new TypeError("classifyWorkflow requires a normalized input object.");
  }

  if (!isProjectIntent(input.projectIntent)) {
    throw new TypeError(`projectIntent must be one of: ${PROJECT_INTENTS.join(", ")}.`);
  }

  const issueIds = collectLinearIssueIds(input);

  if (
    input.projectIntent === "ambiguous" ||
    issueIds.length > 1 ||
    (input.projectIntent === "explicit" && issueIds.length > 0)
  ) {
    return "ambiguous";
  }

  if (input.projectIntent === "explicit") return "project-creation";
  if (issueIds.length === 1) return "issue-delivery";
  return "direct-task";
}
