import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { observePullRequest, validateRequest, waitForPullRequest } from "../lib/pr-wait.mjs";

const head = "a".repeat(40);
const base = "b".repeat(40);
const identity = {
  operationId: "ci-42-1",
  repository: "owner/repo",
  number: 42,
  expectedHeadOid: head,
  expectedBaseOid: base,
};
const connection = (nodes) => ({
  nodes,
  totalCount: nodes.length,
  pageInfo: { hasNextPage: false, endCursor: null },
});
function pullRequest(overrides = {}) {
  return {
    number: 42,
    headRefOid: head,
    baseRefOid: base,
    state: "OPEN",
    isDraft: false,
    headRepository: { nameWithOwner: "owner/repo" },
    headRefName: "feature",
    baseRefName: "main",
    reviewDecision: "REVIEW_REQUIRED",
    mergeable: "MERGEABLE",
    mergeStateStatus: "BLOCKED",
    mergedAt: null,
    mergeCommit: null,
    autoMergeRequest: null,
    isInMergeQueue: false,
    mergeQueueEntry: null,
    reviewThreads: connection([]),
    ...overrides,
  };
}
function reader({ pr = pullRequest(), pages = {}, mutate } = {}) {
  const calls = [];
  const read = async (args, options) => {
    calls.push({ args, options });
    if (args[1] === "graphql") {
      const current = mutate ? mutate(calls) : pr;
      return { data: { repository: { nameWithOwner: "owner/repo", pullRequest: current } } };
    }
    const endpoint = args.find((arg) => arg.startsWith("repos/"));
    if (endpoint.includes("/check-runs"))
      return pages.checks ?? [{ total_count: 0, check_runs: [] }];
    if (endpoint.includes("/statuses")) return pages.statuses ?? [[]];
    if (endpoint.includes("/pulls/42/reviews")) return pages.reviews ?? [[]];
    if (endpoint.includes("/pulls/42/comments")) return pages.reviewComments ?? [[]];
    if (endpoint.includes("/issues/42/comments")) return pages.comments ?? [[]];
    throw new Error(`Unexpected read ${args}`);
  };
  return { read, calls };
}
async function snapshot(options) {
  return observePullRequest(validateRequest(identity), { read: reader(options).read });
}
function clock() {
  let now = 0;
  return {
    now: () => now,
    sleep: async (duration) => {
      now += duration;
    },
  };
}

function checkRun(overrides = {}) {
  return {
    id: 7,
    name: "review",
    head_sha: head,
    status: "in_progress",
    conclusion: null,
    details_url: "https://ci.example/run/7?step=1",
    app: { id: 1, slug: "reviewer" },
    output: { title: "Review running", summary: "Read one file", text: "Progress: 10%" },
    ...overrides,
  };
}

async function checkSnapshot(check) {
  return snapshot({ pages: { checks: [{ total_count: 1, check_runs: [check] }] } });
}

function commitStatus(overrides = {}) {
  return {
    id: 1,
    context: "review",
    state: "pending",
    description: "Reading file one",
    target_url: "https://ci.example/review?step=1",
    creator: { login: "review-bot" },
    ...overrides,
  };
}

async function statusSnapshot(statuses) {
  return snapshot({ pages: { statuses: [statuses] } });
}

describe("exact PR observations", () => {
  test("rejects ambiguous repository, PR, revision, operation and unbounded timing inputs", () => {
    for (const bad of [
      { repository: "owner/repo;touch /tmp/no" },
      { number: 0 },
      { number: "42" },
      { expectedHeadOid: "main" },
      { expectedBaseOid: "abc" },
      { operationId: "" },
      { timeoutMs: Infinity },
      { commandTimeoutMs: 0 },
      { intervalMs: 1 },
      { hostname: "github.com/evil" },
    ])
      expect(() => validateRequest({ ...identity, ...bad })).toThrow();
  });

  test("collects all REST pages and ignores incidental PR/comment metadata", async () => {
    const comment = { id: 1, body: "Need current-head review", user: { login: "reviewer" } };
    const first = await snapshot({ pages: { comments: [[comment], [{ ...comment, id: 2 }]] } });
    const second = await snapshot({
      pr: pullRequest({ updatedAt: "later", title: "renamed" }),
      pages: {
        comments: [
          [{ ...comment, updated_at: "later", reactions: { "+1": 2 } }],
          [{ ...comment, id: 2 }],
        ],
      },
    });
    expect(first).toEqual(second);
    expect(first.signals.comments).toHaveLength(2);
  });

  test("accepts top-level review comments and pending reviews with absent optional fields", async () => {
    const observed = await snapshot({
      pages: {
        reviewComments: [[{ id: 1, body: "A defect", commit_id: head, original_commit_id: head }]],
        reviews: [[{ id: 2, state: "PENDING", body: "" }]],
      },
    });
    expect(observed.signals.reviewComments[0].in_reply_to_id).toBeNull();
    expect(observed.signals.reviews[0].submitted_at).toBeNull();
  });

  test("requires complete GraphQL and check pagination and matching repository identity", async () => {
    await expect(
      snapshot({ pr: pullRequest({ reviewThreads: { ...connection([]), totalCount: 1 } }) }),
    ).rejects.toThrow("incomplete");
    await expect(
      snapshot({ pages: { checks: [{ total_count: 2, check_runs: [{ id: 1 }] }] } }),
    ).rejects.toThrow("incomplete");
    await expect(
      snapshot({ pages: { checks: [{ total_count: 1, check_runs: [{ id: 1 }] }] } }),
    ).rejects.toThrow("incomplete");
    await expect(
      observePullRequest(validateRequest(identity), {
        read: async () => ({ errors: [{ message: "permission denied" }], data: {} }),
      }),
    ).rejects.toThrow();
    await expect(
      observePullRequest(validateRequest(identity), {
        read: async () => ({
          data: { repository: { nameWithOwner: "wrong/repo", pullRequest: pullRequest() } },
        }),
      }),
    ).rejects.toThrow("identity");
  });

  test("follows an independent thread cursor and fails repeated cursors without truncating", async () => {
    let pages = 0;
    const { read: otherReads } = reader();
    const read = async (args, options) => {
      if (args[1] !== "graphql") return otherReads(args, options);
      pages += 1;
      const isSecond = args.includes("cursor=page-two");
      return {
        data: {
          repository: {
            nameWithOwner: "owner/repo",
            pullRequest: pullRequest({
              reviewThreads: {
                totalCount: 2,
                nodes: [
                  { id: isSecond ? "last" : "first", isResolved: false, isOutdated: isSecond },
                ],
                pageInfo: { hasNextPage: !isSecond, endCursor: isSecond ? null : "page-two" },
              },
            }),
          },
        },
      };
    };
    const observed = await observePullRequest(validateRequest(identity), { read });
    expect(observed.signals.threads).toHaveLength(2);
    expect(pages).toBe(3);
    const repeated = reader({
      pr: pullRequest({
        reviewThreads: {
          totalCount: 2,
          nodes: [],
          pageInfo: { hasNextPage: true, endCursor: "same" },
        },
      }),
    });
    await expect(
      observePullRequest(validateRequest(identity), { read: repeated.read }),
    ).rejects.toThrow("cursor");
  });

  test("passes bounded deadlines only to exact read-only API calls", async () => {
    const { read, calls } = reader();
    await observePullRequest(
      { ...identity, commandTimeoutMs: 2000 },
      { read, now: () => 100, deadline: 400 },
    );
    expect(calls.every(({ args, options }) => args[0] === "api" && options.timeoutMs === 300)).toBe(
      true,
    );
    expect(calls.some(({ args }) => args.includes("number=42"))).toBe(true);
    expect(
      calls
        .filter(({ args }) => args[1] !== "graphql")
        .every(({ args }) => args.includes("GET") && args.includes("--paginate")),
    ).toBe(true);
  });

  test("head changes during pagination produce a fresh identity-change wakeup, not a mixed snapshot", async () => {
    let reads = 0;
    const { read } = reader({
      mutate: () => {
        reads += 1;
        return pullRequest({ headRefOid: reads > 1 ? "c".repeat(40) : head });
      },
    });
    const result = await observePullRequest(validateRequest(identity), { read });
    expect(result.headOid).toBe("c".repeat(40));
    expect(result.reason).toBe("revision-changed");
    expect(result.signals).toBeUndefined();
  });
});

describe("bounded change observer", () => {
  test("repeated pending status IDs and progress details do not wake the worker", async () => {
    const first = commitStatus();
    const baseline = await statusSnapshot([first]);
    const progress = await statusSnapshot([
      first,
      commitStatus({
        id: 2,
        description: "Reading file two",
        target_url: "https://ci.example/review?step=2",
      }),
    ]);
    const result = await waitForPullRequest(
      { ...identity, baseline, timeoutMs: 1000 },
      { ...clock(), observe: async () => progress },
    );
    expect(result.outcome).toBe("expired");
  });

  test("status author changes, terminal transitions, and terminal detail changes wake the worker", async () => {
    const pending = await statusSnapshot([commitStatus()]);
    const changedAuthor = await statusSnapshot([
      commitStatus({ id: 2, creator: { login: "other-bot" } }),
    ]);
    const success = await statusSnapshot([
      commitStatus({ id: 2, state: "success", description: "Complete" }),
    ]);
    const failure = await statusSnapshot([
      commitStatus({ id: 3, state: "failure", description: "Defect found" }),
    ]);
    const error = await statusSnapshot([
      commitStatus({ id: 4, state: "error", description: "Provider unavailable" }),
    ]);
    const details = await statusSnapshot([
      commitStatus({
        id: 2,
        state: "success",
        description: "Complete with findings",
        target_url: "https://ci.example/findings",
      }),
    ]);
    for (const [baseline, changed] of [
      [pending, changedAuthor],
      [pending, success],
      [success, failure],
      [failure, error],
      [success, details],
    ]) {
      const result = await waitForPullRequest(
        { ...identity, baseline },
        { ...clock(), observe: async () => changed },
      );
      expect(result.outcome).toBe("changed");
    }
  });

  test("in-flight check output and progress links do not wake the worker", async () => {
    const baseline = await checkSnapshot(checkRun());
    const progress = await checkSnapshot(
      checkRun({
        details_url: "https://ci.example/run/7?step=2",
        output: { title: "Still reviewing", summary: "Read two files", text: "Progress: 30%" },
      }),
    );
    const result = await waitForPullRequest(
      { ...identity, baseline, timeoutMs: 1000 },
      {
        ...clock(),
        observe: async () => progress,
      },
    );
    expect(result.outcome).toBe("expired");
  });

  test("check completion and subsequent terminal findings each wake the worker", async () => {
    const running = await checkSnapshot(checkRun());
    const completed = await checkSnapshot(
      checkRun({
        status: "completed",
        conclusion: "success",
        output: { title: "Review complete", summary: "No findings", text: "" },
      }),
    );
    const findings = await checkSnapshot(
      checkRun({
        status: "completed",
        conclusion: "success",
        output: {
          title: "Review complete",
          summary: "One finding",
          text: "Inspect the callback race",
        },
      }),
    );
    for (const [baseline, changed] of [
      [running, completed],
      [completed, findings],
    ]) {
      const result = await waitForPullRequest(
        { ...identity, baseline },
        { ...clock(), observe: async () => changed },
      );
      expect(result.outcome).toBe("changed");
    }
  });

  test("stable samples expire once without waking on time or repeated unchanged observations", async () => {
    const baseline = await snapshot();
    const result = await waitForPullRequest(
      { ...identity, baseline, timeoutMs: 2000, intervalMs: 1000 },
      {
        ...clock(),
        observe: async () => structuredClone(baseline),
      },
    );
    expect(result).toMatchObject({
      outcome: "expired",
      operationId: identity.operationId,
      reason: "deadline-reached",
    });
  });

  test("an already terminal PR wakes immediately even with the same terminal baseline", async () => {
    const baseline = await snapshot({
      pr: pullRequest({
        state: "MERGED",
        mergedAt: "2026-10-12T12:00:00Z",
        mergeCommit: { oid: head },
      }),
    });
    const result = await waitForPullRequest(
      { ...identity, baseline },
      { ...clock(), observe: async () => baseline },
    );
    expect(result).toMatchObject({
      outcome: "changed",
      reason: "pr-terminal",
      observed: { state: "MERGED" },
    });
    expect(result.snapshot).toBeUndefined();
  });

  test("JSON key ordering alone is not a change", async () => {
    const baseline = await snapshot();
    const reordered = {
      ...baseline,
      signals: Object.fromEntries(Object.entries(baseline.signals).reverse()),
    };
    const result = await waitForPullRequest(
      { ...identity, baseline, timeoutMs: 1000 },
      { ...clock(), observe: async () => reordered },
    );
    expect(result.outcome).toBe("expired");
  });

  test.each([
    [
      "CI result",
      (value) => {
        value.signals.checks.push({ id: 9, status: "completed", conclusion: "success" });
      },
    ],
    [
      "review decision",
      (value) => {
        value.signals.reviewDecision = "APPROVED";
      },
    ],
    [
      "review completion body",
      (value) => {
        value.signals.reviews.push({ id: 8, body: "Review complete", commit_id: head });
      },
    ],
    [
      "new thread",
      (value) => {
        value.signals.threads.push({ id: "thread", isResolved: false, isOutdated: true });
      },
    ],
    [
      "ordinary feedback",
      (value) => {
        value.signals.comments.push({ id: 8, body: "Please fix this" });
      },
    ],
    [
      "queue departure",
      (value) => {
        value.signals.isInMergeQueue = true;
      },
    ],
    [
      "closed PR",
      (value) => {
        value.signals.state = "CLOSED";
      },
    ],
  ])("%s wakes exactly once for a fresh finish-pr observation", async (_, change) => {
    const baseline = await snapshot();
    const changed = structuredClone(baseline);
    change(changed);
    let calls = 0;
    const result = await waitForPullRequest(
      { ...identity, baseline, timeoutMs: 2000, intervalMs: 1000 },
      {
        ...clock(),
        observe: async () => {
          calls += 1;
          return calls === 1 ? baseline : changed;
        },
      },
    );
    expect(result.outcome).toBe("changed");
    expect(calls).toBe(2);
  });

  test("compares against supplied baseline immediately, including changes before launch", async () => {
    const baseline = await snapshot();
    const changed = structuredClone(baseline);
    changed.baseOid = "c".repeat(40);
    const result = await waitForPullRequest(
      { ...identity, baseline },
      { ...clock(), observe: async () => changed },
    );
    expect(result).toMatchObject({ outcome: "changed", reason: "revision-changed" });
  });

  test("a failed observation terminates once with unavailable evidence", async () => {
    const baseline = await snapshot();
    let calls = 0;
    const result = await waitForPullRequest(
      { ...identity, baseline },
      {
        ...clock(),
        observe: async () => {
          calls += 1;
          throw new Error("gh command timed out");
        },
      },
    );
    expect(result).toMatchObject({ outcome: "failed", reason: "gh command timed out" });
    expect(calls).toBe(1);
  });

  test("refuses a baseline for another PR or missing evidence instead of adopting it", async () => {
    const baseline = await snapshot();
    for (const bad of [
      { ...baseline, number: 43 },
      { ...baseline, signals: {} },
    ]) {
      const result = await waitForPullRequest({ ...identity, baseline: bad });
      expect(result.outcome).toBe("failed");
    }
  });
});

describe("observer subprocess", () => {
  async function invoke(mode, request, ghSource, splitInside) {
    const directory = await mkdtemp(join(tmpdir(), "gremlin-pr-wait-"));
    try {
      await writeFile(join(directory, "gh"), `#!/usr/bin/env node\n${ghSource}`, { mode: 0o700 });
      return await new Promise((resolve, reject) => {
        const child = execFile(
          "node",
          [fileURLToPath(new URL("../scripts/wait-pr.mjs", import.meta.url)), mode],
          {
            env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
            timeout: 4000,
          },
          (error, stdout) => {
            if (error?.killed) {
              reject(new Error("Observer escaped its deadline"));
              return;
            }
            try {
              resolve({ code: error?.code ?? 0, result: JSON.parse(stdout) });
            } catch (parseError) {
              reject(parseError);
            }
          },
        );
        const encoded = Buffer.from(JSON.stringify(request));
        if (splitInside) {
          const splitAt = encoded.indexOf(Buffer.from(splitInside)) + 1;
          child.stdin.write(encoded.subarray(0, splitAt));
          setTimeout(() => child.stdin.end(encoded.subarray(splitAt)), 200);
        } else child.stdin.end(encoded);
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  test("kills a stalled gh command and emits one structured failure", async () => {
    const baseline = await snapshot();
    const started = Date.now();
    const { code, result } = await invoke(
      "wait",
      { ...identity, baseline, commandTimeoutMs: 100 },
      "setTimeout(() => {}, 10000);",
    );
    expect(code).toBe(1);
    expect(result).toMatchObject({
      outcome: "failed",
      operationId: identity.operationId,
      reason: "gh command timed out",
    });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("rejects invalid identity before running the gh subprocess", async () => {
    const { code, result } = await invoke(
      "snapshot",
      { ...identity, number: "42" },
      "process.stdout.write('this command must not run');",
    );
    expect(code).toBe(1);
    expect(result).toMatchObject({ outcome: "failed", reason: "Invalid PR number" });
  });

  test("split UTF-8 baseline input stays equal to unchanged GitHub feedback", async () => {
    const comment = { id: 1, body: "Review 😀 café unchanged", user: { login: "reviewer" } };
    const baseline = await snapshot({ pages: { comments: [[comment]] } });
    const metadata = {
      data: { repository: { nameWithOwner: identity.repository, pullRequest: pullRequest() } },
    };
    const ghSource = `
      const args = process.argv.slice(2);
      const endpoint = args.find((arg) => arg.startsWith('repos/')) ?? '';
      const response = args[1] === 'graphql' ? ${JSON.stringify(metadata)}
        : endpoint.includes('/check-runs') ? [{total_count:0,check_runs:[]}]
        : endpoint.includes('/issues/42/comments') ? ${JSON.stringify([[comment]])}
        : [[]];
      process.stdout.write(JSON.stringify(response));
    `;
    const { code, result } = await invoke(
      "wait",
      { ...identity, baseline, timeoutMs: 1000 },
      ghSource,
      "😀",
    );
    expect(code).toBe(0);
    expect(result).toMatchObject({ outcome: "expired", reason: "deadline-reached" });
  });
});
