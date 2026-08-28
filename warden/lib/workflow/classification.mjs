export const PROJECT_INTENTS = Object.freeze(["explicit", "absent", "ambiguous"]);
export const WORKFLOW_CLASSIFICATIONS = Object.freeze([
  "project-creation",
  "issue-delivery",
  "direct-task",
  "ambiguous",
]);

const PROJECT_INTENT_SET = new Set(PROJECT_INTENTS);
const WORKFLOW_CLASSIFICATION_SET = new Set(WORKFLOW_CLASSIFICATIONS);
const LINEAR_TEAM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const EXACT_LINEAR_ISSUE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*-[1-9][0-9]*$/;
const LINEAR_ISSUE_CANDIDATE_PATTERN =
  /(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]*)-([1-9][0-9]*)(?![A-Za-z0-9])/g;
const EXPLICIT_LINEAR_ISSUE_URL_PATTERN =
  /https:\/\/linear\.app\/[^/?#\s]+\/issue\/([A-Za-z][A-Za-z0-9]*-[1-9][0-9]*)(?=$|[^A-Za-z0-9-])/gi;
const LINEAR_URL_SUFFIX_START_CHARACTERS = new Set(["/", "?", "#"]);
const LINEAR_URL_BALANCED_DELIMITERS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);
const LINEAR_URL_CLOSING_DELIMITERS = new Set(LINEAR_URL_BALANCED_DELIMITERS.values());
const LINEAR_URL_HARD_TERMINATORS = new Set(["<", ">", '"', "`", "\\"]);
const LINEAR_URL_PROSE_DELIMITERS = new Set([",", ";"]);
const LINEAR_ISSUE_CANDIDATE_AT_START_PATTERN = /^[A-Za-z][A-Za-z0-9]*-[1-9][0-9]*(?![A-Za-z0-9])/;
const WHITESPACE_PATTERN = /\s/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deduplicate(values) {
  const uniqueValues = [];
  const seen = new Set();

  for (const value of values) {
    if (seen.has(value)) continue;

    seen.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function explicitLinearUrlEndIndex(value, prefixEndIndex) {
  if (!LINEAR_URL_SUFFIX_START_CHARACTERS.has(value[prefixEndIndex])) return prefixEndIndex;

  const closingDelimiterStack = [];
  let endIndex = prefixEndIndex;
  while (endIndex < value.length) {
    const character = value[endIndex];
    if (WHITESPACE_PATTERN.test(character) || LINEAR_URL_HARD_TERMINATORS.has(character)) break;

    const closingDelimiter = LINEAR_URL_BALANCED_DELIMITERS.get(character);
    if (closingDelimiter !== undefined) {
      closingDelimiterStack.push(closingDelimiter);
      endIndex += 1;
      continue;
    }

    if (LINEAR_URL_CLOSING_DELIMITERS.has(character)) {
      if (closingDelimiterStack.at(-1) !== character) break;
      closingDelimiterStack.pop();
      endIndex += 1;
      continue;
    }

    if (
      LINEAR_URL_PROSE_DELIMITERS.has(character) &&
      LINEAR_ISSUE_CANDIDATE_AT_START_PATTERN.test(value.slice(endIndex + 1))
    ) {
      break;
    }

    endIndex += 1;
  }

  return endIndex;
}

function extractCandidateEvidence(value) {
  if (typeof value !== "string") return [];

  const explicitUrlCandidates = [];

  for (const match of value.matchAll(EXPLICIT_LINEAR_ISSUE_URL_PATTERN)) {
    const issueId = normalizeLinearIssueId(match[1]);
    if (issueId === null) continue;

    const prefixEndIndex = match.index + match[0].length;

    explicitUrlCandidates.push({
      issueId,
      index: match.index,
      endIndex: explicitLinearUrlEndIndex(value, prefixEndIndex),
      source: "explicit-url",
    });
  }

  const bareCandidates = [];

  for (const match of value.matchAll(LINEAR_ISSUE_CANDIDATE_PATTERN)) {
    const insideExplicitUrl = explicitUrlCandidates.some(
      (candidate) => match.index >= candidate.index && match.index < candidate.endIndex,
    );
    if (insideExplicitUrl) continue;

    const issueId = normalizeLinearIssueId(match[0]);
    if (issueId === null) continue;

    bareCandidates.push({ issueId, index: match.index, source: "bare" });
  }

  return [...explicitUrlCandidates, ...bareCandidates].sort(
    (left, right) => left.index - right.index,
  );
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

/**
 * Normalizes adapter-supplied Linear team keys. `null` means that team metadata is unavailable;
 * `undefined` is accepted as the same state for callers that predate this input field.
 */
export function normalizeLinearTeamKeys(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) {
    throw new TypeError("linearTeamKeys must be an array or null when metadata is unavailable.");
  }

  const teamKeys = [];

  for (const valueEntry of value) {
    if (typeof valueEntry !== "string") {
      throw new TypeError("Every linearTeamKeys entry must be a canonical team key.");
    }

    const teamKey = valueEntry.trim();
    if (!LINEAR_TEAM_KEY_PATTERN.test(teamKey)) {
      throw new TypeError("Every linearTeamKeys entry must be a canonical team key.");
    }

    teamKeys.push(teamKey.toUpperCase());
  }

  return deduplicate(teamKeys);
}

export function extractLinearIssueCandidates(value) {
  return deduplicate(extractCandidateEvidence(value).map(({ issueId }) => issueId));
}

export function extractLinearIssueIds(value, { linearTeamKeys } = {}) {
  return collectLinearIssueEvidence({ request: value, linearTeamKeys }).issueIds;
}

export function collectLinearIssueEvidence(input = {}) {
  if (!isRecord(input)) {
    throw new TypeError("collectLinearIssueEvidence requires an input object.");
  }

  const normalizedTeamKeys = normalizeLinearTeamKeys(input.linearTeamKeys);
  const knownTeamKeys = normalizedTeamKeys === null ? null : new Set(normalizedTeamKeys);
  const issueIds = [];
  const unresolvedBareIssueIds = [];

  for (const value of [input.request, input.branch]) {
    for (const candidate of extractCandidateEvidence(value)) {
      if (candidate.source === "explicit-url") {
        issueIds.push(candidate.issueId);
        continue;
      }

      if (knownTeamKeys === null) {
        unresolvedBareIssueIds.push(candidate.issueId);
        continue;
      }

      const teamKey = candidate.issueId.slice(0, candidate.issueId.indexOf("-"));
      if (knownTeamKeys.has(teamKey)) issueIds.push(candidate.issueId);
    }
  }

  return {
    issueIds: deduplicate(issueIds),
    unresolvedBareIssueIds: deduplicate(unresolvedBareIssueIds),
    linearTeamKeysUnavailable: normalizedTeamKeys === null,
  };
}

export function collectLinearIssueIds(input = {}) {
  return collectLinearIssueEvidence(input).issueIds;
}

export function classifyWorkflow(input) {
  if (!isRecord(input)) {
    throw new TypeError("classifyWorkflow requires a normalized input object.");
  }

  if (!isProjectIntent(input.projectIntent)) {
    throw new TypeError(`projectIntent must be one of: ${PROJECT_INTENTS.join(", ")}.`);
  }

  const evidence = collectLinearIssueEvidence(input);

  if (
    input.projectIntent === "ambiguous" ||
    evidence.unresolvedBareIssueIds.length > 0 ||
    evidence.issueIds.length > 1 ||
    (input.projectIntent === "explicit" && evidence.issueIds.length > 0)
  ) {
    return "ambiguous";
  }

  if (input.projectIntent === "explicit") return "project-creation";
  if (evidence.issueIds.length === 1) return "issue-delivery";
  return "direct-task";
}
