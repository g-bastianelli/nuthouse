import { describe, expect, test } from "bun:test";
import path from "node:path";

import {
  ProjectGraphError,
  canonicalizeMutationEnvelope,
  canonicalizeProjectGraph,
  compareProjectGraphs,
  foundationReasonMarker,
  hashMutationEnvelope,
  hashProjectGraph,
  validateProjectGraph,
} from "../lib/project-graph.mjs";

const PROJECT_REF = "project-1";

function graph(overrides = {}) {
  return {
    schemaVersion: 1,
    project: { clientRef: PROJECT_REF, teamId: "team-1", title: "Delivery" },
    milestones: [
      { clientRef: "milestone-2", projectRef: PROJECT_REF, title: "Later" },
      { clientRef: "milestone-1", projectRef: PROJECT_REF, title: "First" },
    ],
    issues: [
      {
        clientRef: "issue-b",
        projectRef: PROJECT_REF,
        milestoneRef: "milestone-1",
        title: "Dependent",
        acceptanceIds: ["AC-002"],
      },
      {
        clientRef: "issue-a",
        projectRef: PROJECT_REF,
        milestoneRef: "milestone-1",
        title: "Blocker",
        acceptanceIds: ["AC-001"],
      },
      {
        clientRef: "issue-c",
        projectRef: PROJECT_REF,
        title: "Independent",
        acceptanceIds: ["AC-003"],
      },
    ],
    edges: [{ dependentRef: "issue-b", blockerRef: "issue-a" }],
    ...overrides,
  };
}

function mutationEnvelope(overrides = {}) {
  const normalizedGraph = graph();
  return {
    schemaVersion: 1,
    graph: normalizedGraph,
    project: {
      clientRef: PROJECT_REF,
      name: "Delivery",
      description: `Project body\n\n<!-- nuthouse-client-ref: ${PROJECT_REF} -->`,
      teamIds: ["team-1"],
      statusId: "status-1",
    },
    milestones: normalizedGraph.milestones.map((milestone) => ({
      clientRef: milestone.clientRef,
      projectRef: milestone.projectRef,
      name: milestone.title,
      description: `${milestone.title} scope\n\n<!-- nuthouse-client-ref: ${milestone.clientRef} -->`,
      targetDate: milestone.clientRef === "milestone-1" ? "2026-09-01" : null,
    })),
    issues: normalizedGraph.issues.map((entry, index) => ({
      clientRef: entry.clientRef,
      draftKey: `I-${String(index + 1).padStart(3, "0")}`,
      projectRef: entry.projectRef,
      milestoneRef: entry.milestoneRef ?? null,
      teamId: "team-1",
      title: entry.title,
      description: `Issue body ${entry.acceptanceIds.join(", ")}\n\n<!-- nuthouse-client-ref: ${entry.clientRef} -->`,
      labelIds: index === 0 ? ["label-2", "label-1"] : [],
      blockedByRefs: entry.clientRef === "issue-b" ? ["issue-a"] : [],
    })),
    ...overrides,
  };
}

function expectGraphError(input, code, relation) {
  try {
    validateProjectGraph(input);
    throw new Error("expected graph validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectGraphError);
    expect(error.code).toBe(code);
    if (relation) expect(error.relation).toEqual(relation);
  }
}

describe("project graph validation", () => {
  test("canonicalizes unordered entities before hashing", () => {
    const first = graph();
    const second = graph({
      milestones: [...first.milestones].reverse(),
      issues: [...first.issues]
        .reverse()
        .map((issue) => ({ ...issue, acceptanceIds: [...issue.acceptanceIds].reverse() })),
    });

    expect(canonicalizeProjectGraph(first).issues.map((issue) => issue.clientRef)).toEqual([
      "issue-a",
      "issue-b",
      "issue-c",
    ]);
    expect(hashProjectGraph(first)).toBe(hashProjectGraph(second));
    expect(hashProjectGraph(first)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("accepts disconnected acyclic components", () => {
    expect(validateProjectGraph(graph()).edges).toEqual([
      { dependentRef: "issue-b", blockerRef: "issue-a" },
    ]);
  });

  test.each([
    {
      name: "unknown dependent",
      code: "UNKNOWN_TARGET",
      edges: [{ dependentRef: "issue-z", blockerRef: "issue-a" }],
      relation: { dependentRef: "issue-z", blockerRef: "issue-a" },
    },
    {
      name: "self edge",
      code: "SELF_EDGE",
      edges: [{ dependentRef: "issue-a", blockerRef: "issue-a" }],
      relation: { dependentRef: "issue-a", blockerRef: "issue-a" },
    },
    {
      name: "duplicate edge",
      code: "DUPLICATE_EDGE",
      edges: [
        { dependentRef: "issue-b", blockerRef: "issue-a" },
        { dependentRef: "issue-b", blockerRef: "issue-a" },
      ],
      relation: { dependentRef: "issue-b", blockerRef: "issue-a" },
    },
  ])("rejects $name and identifies its relation", ({ code, edges, relation }) => {
    expectGraphError(graph({ edges }), code, relation);
  });

  test("rejects an issue or milestone outside the proposed project", () => {
    const input = graph();
    input.issues[0] = { ...input.issues[0], projectRef: "another-project" };

    expectGraphError(input, "CROSS_PROJECT", {
      dependentRef: "issue-b",
      blockerRef: "issue-a",
    });
  });

  test("rejects legacy directional relation keys", () => {
    expectGraphError(
      graph({ edges: [{ fromRef: "issue-a", toRef: "issue-b" }] }),
      "INVALID_DIRECTION",
      { fromRef: "issue-a", toRef: "issue-b" },
    );
  });

  test("rejects a cycle and identifies an edge in the cycle", () => {
    const input = graph({
      edges: [
        { dependentRef: "issue-b", blockerRef: "issue-a" },
        { dependentRef: "issue-a", blockerRef: "issue-b" },
      ],
    });

    try {
      validateProjectGraph(input);
      throw new Error("expected a cycle");
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectGraphError);
      expect(error.code).toBe("CYCLE");
      expect(error.relation).toBeDefined();
      expect(error.detail.cycle).toEqual(["issue-a", "issue-b", "issue-a"]);
    }
  });

  test("requires acceptance coverage and valid milestone membership", () => {
    const withoutAcceptance = graph();
    withoutAcceptance.issues[0] = { ...withoutAcceptance.issues[0], acceptanceIds: [] };
    expectGraphError(withoutAcceptance, "ACCEPTANCE_MISSING");

    const unknownMilestone = graph();
    unknownMilestone.issues[0] = {
      ...unknownMilestone.issues[0],
      milestoneRef: "milestone-missing",
    };
    expectGraphError(unknownMilestone, "UNKNOWN_MILESTONE");
  });

  test("accepts explicit foundation coverage and rejects mixed coverage", () => {
    const foundation = graph();
    foundation.issues[0] = {
      ...foundation.issues[0],
      acceptanceIds: [],
      foundationReason: "Shared schema required before feature issues",
    };
    expect(validateProjectGraph(foundation).issues[1]).toMatchObject({
      acceptanceIds: [],
      foundationReason: "Shared schema required before feature issues",
    });

    foundation.issues[0].acceptanceIds = ["AC-002"];
    expectGraphError(foundation, "COVERAGE_AMBIGUOUS");
  });
});

describe("complete mutation envelope", () => {
  test("canonicalizes every externally replayed field", () => {
    const canonical = canonicalizeMutationEnvelope(mutationEnvelope());
    expect(canonical.issues.find((entry) => entry.clientRef === "issue-b").labelIds).toEqual([
      "label-1",
      "label-2",
    ]);
    expect(canonical.project.statusId).toBe("status-1");
    expect(hashMutationEnvelope(canonical)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test.each([
    ["project description", (value) => (value.project.description += " changed")],
    ["project status", (value) => (value.project.statusId = "status-2")],
    ["milestone description", (value) => (value.milestones[0].description += " changed")],
    ["milestone target date", (value) => (value.milestones[0].targetDate = "2026-09-02")],
    ["issue body", (value) => (value.issues[0].description += " changed")],
    ["issue labels", (value) => value.issues[0].labelIds.push("label-3")],
    [
      "dependency",
      (value) => {
        value.graph.edges = [];
        value.issues.find((entry) => entry.clientRef === "issue-b").blockedByRefs = [];
      },
    ],
  ])("binds %s into the approved payload hash", (_name, mutate) => {
    const approved = mutationEnvelope();
    const edited = structuredClone(approved);
    mutate(edited);
    expect(hashMutationEnvelope(edited)).not.toBe(hashMutationEnvelope(approved));
  });

  test("requires a loadable marker for foundation-only issues", () => {
    const value = mutationEnvelope();
    const reason = "Shared schema required before feature issues";
    const target = value.graph.issues.find((entry) => entry.clientRef === "issue-b");
    target.acceptanceIds = [];
    target.foundationReason = reason;
    const issueMutation = value.issues.find((entry) => entry.clientRef === "issue-b");
    issueMutation.description += `\n${foundationReasonMarker(reason)}`;

    expect(canonicalizeMutationEnvelope(value).graph.issues[1].foundationReason).toBe(reason);
    issueMutation.description = issueMutation.description.replace(
      foundationReasonMarker(reason),
      "",
    );
    expect(() => canonicalizeMutationEnvelope(value)).toThrow("foundation reason marker");
  });

  test("rejects an envelope whose replay fields disagree with its graph", () => {
    const value = mutationEnvelope();
    value.issues[0].blockedByRefs = ["issue-c"];
    expect(() => canonicalizeMutationEnvelope(value)).toThrow("does not match the graph");
  });
});

describe("project graph equivalence", () => {
  test("reports exact equivalence", () => {
    expect(compareProjectGraphs(graph(), graph())).toMatchObject({
      equivalent: true,
      differences: [],
    });
    const comparison = compareProjectGraphs(graph(), graph());
    expect(comparison.approvedHash).toBe(comparison.actualHash);
    expect(comparison.actualHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("reports missing, extra, changed, and reversed relations", () => {
    const actual = graph({
      issues: graph()
        .issues.filter((issue) => issue.clientRef !== "issue-c")
        .map((issue) =>
          issue.clientRef === "issue-a" ? { ...issue, title: "Renamed too early" } : issue,
        )
        .concat({
          clientRef: "issue-extra",
          projectRef: PROJECT_REF,
          title: "Extra",
          acceptanceIds: ["AC-999"],
        }),
      edges: [{ dependentRef: "issue-a", blockerRef: "issue-b" }],
    });

    expect(compareProjectGraphs(graph(), actual).differences).toEqual([
      "ISSUE_CHANGED issue-a",
      "ISSUE_MISSING issue-c",
      "ISSUE_EXTRA issue-extra",
      "EDGE_REVERSED issue-b<-issue-a actual=issue-a<-issue-b",
    ]);
  });
});

test("the JSON CLI returns a hash-bound validation receipt", () => {
  const script = path.resolve(import.meta.dir, "..", "scripts", "project-graph.mjs");
  const result = Bun.spawnSync({
    cmd: [process.execPath, script, "validate"],
    stdin: new Blob([JSON.stringify(graph())]),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  const output = JSON.parse(result.stdout.toString());
  expect(output.ok).toBe(true);
  expect(output.payloadHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(output.graph.schemaVersion).toBe(1);
});

test("the JSON CLI hash-binds the complete mutation envelope separately from the graph", () => {
  const script = path.resolve(import.meta.dir, "..", "scripts", "project-graph.mjs");
  const result = Bun.spawnSync({
    cmd: [process.execPath, script, "validate-envelope"],
    stdin: new Blob([JSON.stringify(mutationEnvelope())]),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);
  const output = JSON.parse(result.stdout.toString());
  expect(output.ok).toBe(true);
  expect(output.payloadHash).toBe(hashMutationEnvelope(mutationEnvelope()));
  expect(output.graphHash).toBe(hashProjectGraph(graph()));
  expect(output.payloadHash).not.toBe(output.graphHash);
});

test("the JSON CLI returns both exact hashes when comparison finds drift", () => {
  const script = path.resolve(import.meta.dir, "..", "scripts", "project-graph.mjs");
  const actual = graph({ edges: [{ dependentRef: "issue-a", blockerRef: "issue-b" }] });
  const result = Bun.spawnSync({
    cmd: [process.execPath, script, "compare"],
    stdin: new Blob([JSON.stringify({ approved: graph(), actual })]),
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(2);
  const output = JSON.parse(result.stdout.toString());
  expect(output.ok).toBe(false);
  expect(output.equivalent).toBe(false);
  expect(output.approvedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(output.actualHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  expect(output.approvedHash).not.toBe(output.actualHash);
  expect(output.differences).toContain("EDGE_REVERSED issue-b<-issue-a actual=issue-a<-issue-b");
});
