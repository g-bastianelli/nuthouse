import { describe, expect, test } from "bun:test";
import {
  PROJECT_INTENTS,
  WORKFLOW_CLASSIFICATIONS,
  classifyWorkflow,
  collectLinearIssueIds,
  extractLinearIssueIds,
  isProjectIntent,
  isWorkflowClassification,
  normalizeLinearIssueId,
} from "../src/index.mjs";

describe("workflow classification contract", () => {
  test("exports closed project-intent and classification values", () => {
    expect(PROJECT_INTENTS).toEqual(["explicit", "absent", "ambiguous"]);
    expect(WORKFLOW_CLASSIFICATIONS).toEqual([
      "project-creation",
      "issue-delivery",
      "direct-task",
      "ambiguous",
    ]);
    expect(Object.isFrozen(PROJECT_INTENTS)).toBe(true);
    expect(Object.isFrozen(WORKFLOW_CLASSIFICATIONS)).toBe(true);

    for (const projectIntent of PROJECT_INTENTS) {
      expect(isProjectIntent(projectIntent)).toBe(true);
    }
    for (const classification of WORKFLOW_CLASSIFICATIONS) {
      expect(isWorkflowClassification(classification)).toBe(true);
    }

    expect(isProjectIntent("EXPLICIT")).toBe(false);
    expect(isProjectIntent(undefined)).toBe(false);
    expect(isWorkflowClassification("project")).toBe(false);
    expect(isWorkflowClassification(null)).toBe(false);
  });

  test("rejects inputs outside the normalized project-intent boundary", () => {
    for (const input of [
      undefined,
      null,
      {},
      { projectIntent: "unknown", request: "Ship the patch", branch: "main" },
    ]) {
      expect(() => classifyWorkflow(input)).toThrow(TypeError);
    }
  });
});

describe("Linear issue identifier normalization", () => {
  test("normalizes exact identifiers and rejects malformed values", () => {
    expect(normalizeLinearIssueId("not-548")).toBe("NOT-548");
    expect(normalizeLinearIssueId("  Team42-7  ")).toBe("TEAM42-7");

    for (const value of [undefined, null, "A-1", "TEAM-", "TEAM-ABC", "TEAM_123"]) {
      expect(normalizeLinearIssueId(value)).toBeNull();
    }
  });

  test("extracts lowercase, branch, and Linear URL identifiers in occurrence order", () => {
    expect(extractLinearIssueIds("Deliver not-548, then review ENG42-7.")).toEqual([
      "NOT-548",
      "ENG42-7",
    ]);
    expect(extractLinearIssueIds("gbastianelli/ops-9-fix-routing")).toEqual(["OPS-9"]);
    expect(
      extractLinearIssueIds("https://linear.app/nuthouse/issue/not-548/routing-kernel"),
    ).toEqual(["NOT-548"]);
    expect(extractLinearIssueIds(undefined)).toEqual([]);
  });

  test("deduplicates request and branch evidence case-insensitively", () => {
    expect(
      collectLinearIssueIds({
        request: "Work on not-548, then NOT-548 again.",
        branch: "gbastianelli/not-548-routing",
      }),
    ).toEqual(["NOT-548"]);
  });

  test("preserves deterministic request-before-branch order for distinct identifiers", () => {
    expect(
      collectLinearIssueIds({
        request: "Compare not-548 with ENG-42.",
        branch: "gbastianelli/eng-42-and-ops-7",
      }),
    ).toEqual(["NOT-548", "ENG-42", "OPS-7"]);
  });
});

describe("deterministic workflow classification", () => {
  const projectRequests = [
    "Create a Linear project for the release.",
    "Crée un projet Linear pour la livraison.",
    "Linear のプロジェクトを作成してください。",
  ];

  for (const request of projectRequests) {
    test(`classifies caller-normalized multilingual project intent: ${request}`, () => {
      expect(classifyWorkflow({ projectIntent: "explicit", request, branch: "main" })).toBe(
        "project-creation",
      );
    });
  }

  test("does not infer project intent from natural-language request text (AC-001)", () => {
    expect(
      classifyWorkflow({
        projectIntent: "absent",
        request: "Create a Linear project for the release.",
        branch: "main",
      }),
    ).toBe("direct-task");
  });

  const issueDeliveryInputs = [
    {
      name: "request-only evidence",
      input: { projectIntent: "absent", request: "Please deliver not-548", branch: "main" },
    },
    {
      name: "branch-only evidence",
      input: {
        projectIntent: "absent",
        request: "Please deliver the routing change",
        branch: "gbastianelli/not-548-routing",
      },
    },
    {
      name: "a Linear issue URL",
      input: {
        projectIntent: "absent",
        request: "Handle https://linear.app/nuthouse/issue/not-548/routing-kernel",
        branch: "main",
      },
    },
    {
      name: "matching request and branch evidence",
      input: {
        projectIntent: "absent",
        request: "Work on NOT-548",
        branch: "gbastianelli/not-548-routing",
      },
    },
  ];

  for (const fixture of issueDeliveryInputs) {
    test(`classifies ${fixture.name} as issue delivery (AC-002)`, () => {
      expect(classifyWorkflow(fixture.input)).toBe("issue-delivery");
    });
  }

  test("classifies a task with no Linear workflow signal as direct (AC-003)", () => {
    expect(
      classifyWorkflow({
        projectIntent: "absent",
        request: "Refactor the parser and add regression tests.",
        branch: "feature/parser-cleanup",
      }),
    ).toBe("direct-task");
  });

  const ambiguousInputs = [
    {
      name: "uncertain project intent",
      input: { projectIntent: "ambiguous", request: "Set up the work", branch: "main" },
    },
    {
      name: "project intent combined with issue evidence",
      input: {
        projectIntent: "explicit",
        request: "Use NOT-548 as context",
        branch: "main",
      },
    },
    {
      name: "multiple request identifiers",
      input: {
        projectIntent: "absent",
        request: "Deliver NOT-548 and OPS-7",
        branch: "main",
      },
    },
    {
      name: "different request and branch identifiers",
      input: {
        projectIntent: "absent",
        request: "Deliver NOT-548",
        branch: "gbastianelli/ops-7-other-work",
      },
    },
  ];

  for (const fixture of ambiguousInputs) {
    test(`returns ambiguous for ${fixture.name} (AC-004)`, () => {
      expect(classifyWorkflow(fixture.input)).toBe("ambiguous");
    });
  }

  test("does not mutate caller-owned normalized input", () => {
    const input = Object.freeze({
      projectIntent: "absent",
      request: "Deliver not-548",
      branch: "gbastianelli/not-548-routing",
    });
    const before = structuredClone(input);

    expect(classifyWorkflow(input)).toBe("issue-delivery");
    expect(input).toEqual(before);
  });
});
