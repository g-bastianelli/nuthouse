import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const signalArrays = ["checks", "statuses", "reviews", "threads", "reviewComments", "comments"];
const metadataFields = [
  "state",
  "isDraft",
  "headRepository",
  "headRefName",
  "baseRefName",
  "reviewDecision",
  "mergeable",
  "mergeStateStatus",
  "mergedAt",
  "mergeCommit",
  "autoMergeRequest",
  "isInMergeQueue",
  "mergeQueueEntry",
];
const query = `query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
  repository(owner:$owner,name:$name) { nameWithOwner pullRequest(number:$number) {
    number headRefOid baseRefOid state isDraft headRepository { nameWithOwner }
    headRefName baseRefName reviewDecision mergeable mergeStateStatus mergedAt mergeCommit { oid }
    autoMergeRequest { enabledAt mergeMethod } isInMergeQueue mergeQueueEntry { id state }
    reviewThreads(first:100,after:$cursor) {
      totalCount pageInfo { hasNextPage endCursor } nodes { id isResolved isOutdated }
    }
  } }
}`;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function duration(value, fallback, minimum, maximum, name) {
  const result = value ?? fallback;
  requireValue(
    Number.isSafeInteger(result) && result >= minimum && result <= maximum,
    `Invalid ${name}`,
  );
  return result;
}

export function validateRequest(value) {
  requireValue(object(value), "Expected a JSON request object");
  requireValue(
    typeof value.operationId === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.operationId),
    "Invalid operationId",
  );
  requireValue(
    typeof value.repository === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(value.repository) &&
      !value.repository.endsWith("/.") &&
      !value.repository.endsWith("/.."),
    "Invalid repository",
  );
  requireValue(Number.isSafeInteger(value.number) && value.number > 0, "Invalid PR number");
  for (const field of ["expectedHeadOid", "expectedBaseOid"]) {
    requireValue(
      typeof value[field] === "string" && /^[a-f0-9]{40}$/.test(value[field]),
      `Invalid ${field}`,
    );
  }
  const hostname = value.hostname ?? "github.com";
  requireValue(
    typeof hostname === "string" &&
      /^(?=.{1,253}$)[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/.test(hostname),
    "Invalid hostname",
  );
  return {
    ...value,
    hostname,
    intervalMs: duration(value.intervalMs, 30_000, 1000, 300_000, "intervalMs"),
    timeoutMs: duration(value.timeoutMs, 1_800_000, 1000, 3_600_000, "timeoutMs"),
    commandTimeoutMs: duration(value.commandTimeoutMs, 15_000, 100, 60_000, "commandTimeoutMs"),
  };
}

export function runGh(args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    execFile(
      "gh",
      args,
      { timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              error.killed
                ? "gh command timed out"
                : `gh command failed (${error.code ?? "execution error"})`,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("gh returned invalid JSON"));
        }
      },
    );
  });
}

function project(value, fields) {
  return Object.fromEntries(fields.map((field) => [field, value[field] ?? null]));
}

function sorted(values) {
  return values.sort((left, right) =>
    String(left.id ?? left.context).localeCompare(String(right.id ?? right.context)),
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function records(pages, fields, label, required = fields) {
  requireValue(
    Array.isArray(pages) && pages.length > 0 && pages.every(Array.isArray),
    `incomplete ${label} pages`,
  );
  const values = pages.flat();
  requireValue(
    values.every(
      (value) => object(value) && (typeof value.id === "string" || Number.isSafeInteger(value.id)),
    ),
    `Invalid ${label} evidence`,
  );
  requireValue(
    values.every((value) => required.every((field) => Object.hasOwn(value, field))),
    `incomplete ${label} evidence`,
  );
  requireValue(
    new Set(values.map((value) => value.id)).size === values.length,
    `incomplete ${label} pages: duplicate entries`,
  );
  return sorted(
    values.map((value) => ({
      ...project(value, fields),
      author: value.user?.login ?? value.creator?.login ?? null,
    })),
  );
}

function metadata(pr) {
  for (const field of metadataFields) requireValue(Object.hasOwn(pr, field), `Missing PR ${field}`);
  requireValue(
    ["OPEN", "CLOSED", "MERGED"].includes(pr.state) &&
      typeof pr.isDraft === "boolean" &&
      typeof pr.isInMergeQueue === "boolean",
    "Invalid PR state",
  );
  return project(pr, metadataFields);
}

function revision(request, pr) {
  return {
    version: 1,
    hostname: request.hostname,
    repository: request.repository,
    number: request.number,
    headOid: pr.headRefOid,
    baseOid: pr.baseRefOid,
  };
}

function revisionChanged(request, pr) {
  return pr.headRefOid !== request.expectedHeadOid || pr.baseRefOid !== request.expectedBaseOid;
}

// Every command is read-only. Page failures are unavailable evidence, never empty results.
export async function observePullRequest(input, options = {}) {
  const request = validateRequest(input);
  const now = options.now ?? Date.now;
  const read = options.read ?? runGh;
  const deadline = options.deadline ?? now() + request.timeoutMs;
  const [owner, name] = request.repository.split("/");
  const api = async (args) => {
    const remaining = deadline - now();
    requireValue(remaining > 0, "Observation deadline reached");
    return read(["api", ...args, "--hostname", request.hostname], {
      timeoutMs: Math.min(request.commandTimeoutMs, remaining),
    });
  };
  const getPr = async (cursor) => {
    const args = [
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `number=${request.number}`,
    ];
    if (cursor) args.push("-f", `cursor=${cursor}`);
    const response = await api(args);
    requireValue(
      !response.errors?.length && object(response.data?.repository),
      "Unavailable GraphQL evidence",
    );
    const repo = response.data.repository;
    const pr = repo.pullRequest;
    requireValue(
      repo.nameWithOwner?.toLowerCase() === request.repository.toLowerCase() &&
        pr?.number === request.number,
      "PR identity mismatch",
    );
    requireValue(
      /^[a-f0-9]{40}$/.test(pr.headRefOid) && /^[a-f0-9]{40}$/.test(pr.baseRefOid),
      "Invalid observed PR revision",
    );
    return pr;
  };
  let pr = await getPr();
  if (revisionChanged(request, pr)) return { ...revision(request, pr), reason: "revision-changed" };
  const initial = metadata(pr);
  const threads = [];
  const cursors = new Set();
  let total;
  while (true) {
    const page = pr.reviewThreads;
    requireValue(
      object(page) &&
        Array.isArray(page.nodes) &&
        Number.isSafeInteger(page.totalCount) &&
        object(page.pageInfo) &&
        typeof page.pageInfo.hasNextPage === "boolean",
      "incomplete thread pages",
    );
    total ??= page.totalCount;
    requireValue(
      total === page.totalCount &&
        page.nodes.every(
          (node) =>
            object(node) &&
            typeof node.id === "string" &&
            typeof node.isResolved === "boolean" &&
            typeof node.isOutdated === "boolean",
        ),
      "incomplete thread evidence",
    );
    threads.push(...page.nodes.map((node) => project(node, ["id", "isResolved", "isOutdated"])));
    if (!page.pageInfo.hasNextPage) break;
    const cursor = page.pageInfo.endCursor;
    requireValue(
      typeof cursor === "string" && cursor.length > 0 && !cursors.has(cursor),
      "incomplete thread pagination cursor",
    );
    cursors.add(cursor);
    pr = await getPr(cursor);
    if (revisionChanged(request, pr))
      return { ...revision(request, pr), reason: "revision-changed" };
  }
  requireValue(
    total === threads.length && new Set(threads.map((thread) => thread.id)).size === total,
    "incomplete thread pages",
  );
  const rest = (path) =>
    api(["--method", "GET", "--paginate", "--slurp", `repos/${request.repository}/${path}`]);
  const checks = await rest(
    `commits/${request.expectedHeadOid}/check-runs?filter=latest&per_page=100`,
  );
  requireValue(
    Array.isArray(checks) &&
      checks.length > 0 &&
      checks.every(
        (page) =>
          object(page) && Number.isSafeInteger(page.total_count) && Array.isArray(page.check_runs),
      ),
    "incomplete check pages",
  );
  const checkRows = checks.flatMap((page) => page.check_runs);
  requireValue(
    checks.every((page) => page.total_count === checkRows.length),
    "incomplete check pages",
  );
  const checkSignals = records(
    [checkRows],
    ["id", "name", "head_sha", "status", "conclusion", "details_url", "app", "output"],
    "check",
  ).map((check) => ({
    ...check,
    app: check.app ? project(check.app, ["id", "slug"]) : null,
    // Running providers stream progress here; only terminal output can resume readiness.
    details_url: check.status === "completed" ? check.details_url : null,
    output:
      check.status === "completed" && check.output
        ? project(check.output, ["title", "summary", "text"])
        : null,
  }));
  requireValue(
    checkSignals.every(
      (check) =>
        check.head_sha === request.expectedHeadOid &&
        typeof check.name === "string" &&
        typeof check.status === "string",
    ),
    "incomplete check revision/status",
  );
  const statuses = records(
    await rest(`commits/${request.expectedHeadOid}/statuses?per_page=100`),
    ["id", "context", "state", "description", "target_url"],
    "status",
  );
  // REST returns all historical statuses. Only the latest status per context can affect this head.
  const latestStatuses = new Map();
  for (const status of statuses) {
    requireValue(
      typeof status.context === "string" && Number.isSafeInteger(status.id),
      "Invalid status context",
    );
    if (!latestStatuses.has(status.context) || latestStatuses.get(status.context).id < status.id)
      latestStatuses.set(status.context, status);
  }
  const reviews = records(
    await rest(`pulls/${request.number}/reviews?per_page=100`),
    ["id", "state", "body", "commit_id", "submitted_at"],
    "review",
    ["id", "state", "body"],
  );
  const reviewComments = records(
    await rest(`pulls/${request.number}/comments?per_page=100`),
    ["id", "body", "commit_id", "original_commit_id", "in_reply_to_id"],
    "review comment",
    ["id", "body", "commit_id", "original_commit_id"],
  );
  const comments = records(
    await rest(`issues/${request.number}/comments?per_page=100`),
    ["id", "body"],
    "comment",
  );
  const final = await getPr();
  if (revisionChanged(request, final))
    return { ...revision(request, final), reason: "revision-changed" };
  const finalMetadata = metadata(final);
  if (stableJson(initial) !== stableJson(finalMetadata))
    return { ...revision(request, final), reason: "pr-evidence-changed" };
  return {
    ...revision(request, final),
    signals: {
      ...finalMetadata,
      checks: checkSignals,
      statuses: sorted(
        [...latestStatuses.values()].map((status) =>
          status.state === "pending"
            ? { ...status, id: null, description: null, target_url: null }
            : status,
        ),
      ),
      reviews,
      threads: sorted(threads),
      reviewComments,
      comments,
    },
  };
}

function validateBaseline(request) {
  const value = request.baseline;
  requireValue(
    object(value) &&
      value.version === 1 &&
      value.hostname === request.hostname &&
      value.repository === request.repository &&
      value.number === request.number &&
      value.headOid === request.expectedHeadOid &&
      value.baseOid === request.expectedBaseOid,
    "Baseline identity mismatch",
  );
  requireValue(
    object(value.signals) &&
      metadataFields.every((field) => Object.hasOwn(value.signals, field)) &&
      signalArrays.every((field) => Array.isArray(value.signals[field])),
    "Baseline has incomplete evidence",
  );
}

export async function waitForPullRequest(input, options = {}) {
  const result = (outcome, reason, snapshot) => ({
    outcome,
    operationId: input?.operationId ?? null,
    repository: input?.repository ?? null,
    number: input?.number ?? null,
    reason,
    ...(snapshot
      ? {
          observed: {
            headOid: snapshot.headOid,
            baseOid: snapshot.baseOid,
            ...(snapshot.signals ? { state: snapshot.signals.state } : {}),
          },
        }
      : {}),
  });
  try {
    const request = validateRequest(input);
    validateBaseline(request);
    const now = options.now ?? Date.now;
    const pause = options.sleep ?? sleep;
    const observe = options.observe ?? observePullRequest;
    const deadline = now() + request.timeoutMs;
    while (now() < deadline) {
      const observed = await observe(request, { ...options, deadline });
      if (
        observed.headOid !== request.expectedHeadOid ||
        observed.baseOid !== request.expectedBaseOid
      )
        return result("changed", "revision-changed", observed);
      if (observed.signals && observed.signals.state !== "OPEN")
        return result("changed", "pr-terminal", observed);
      if (stableJson(observed.signals) !== stableJson(request.baseline.signals))
        return result("changed", "pr-evidence-changed", observed);
      await pause(Math.max(0, Math.min(request.intervalMs, deadline - now())));
    }
    return result("expired", "deadline-reached");
  } catch (error) {
    return result("failed", error instanceof Error ? error.message : "Unavailable observation");
  }
}
