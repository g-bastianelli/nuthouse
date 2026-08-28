import { describe, expect, test } from "bun:test";
import {
  PROJECT_INTENTS,
  WORKFLOW_CLASSIFICATIONS,
  classifyWorkflow,
  collectLinearIssueEvidence,
  collectLinearIssueIds,
  extractLinearIssueCandidates,
  extractLinearIssueIds,
  isProjectIntent,
  isWorkflowClassification,
  normalizeLinearIssueId,
  normalizeLinearTeamKeys,
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
  test("normalizes canonical identifiers, including one-character team keys", () => {
    expect(normalizeLinearIssueId("not-548")).toBe("NOT-548");
    expect(normalizeLinearIssueId("  Team42-7  ")).toBe("TEAM42-7");
    expect(normalizeLinearIssueId("A-1")).toBe("A-1");

    for (const value of [undefined, null, "AC-001", "TEAM-0", "TEAM-", "TEAM-ABC", "TEAM_123"]) {
      expect(normalizeLinearIssueId(value)).toBeNull();
    }
  });

  test("normalizes available team keys and represents unavailable metadata as null", () => {
    expect(normalizeLinearTeamKeys(["not", "A", "NOT"])).toEqual(["NOT", "A"]);
    expect(normalizeLinearTeamKeys(null)).toBeNull();
    expect(normalizeLinearTeamKeys(undefined)).toBeNull();
    expect(() => normalizeLinearTeamKeys(["NOT-548"])).toThrow(TypeError);
  });

  test("extracts canonical syntactic candidates without claiming they are Linear IDs", () => {
    expect(extractLinearIssueCandidates("Deliver not-548, then review ENG42-7.")).toEqual([
      "NOT-548",
      "ENG42-7",
    ]);
    expect(extractLinearIssueCandidates("A-1 AC-001 ISO-8601 RFC-3339")).toEqual([
      "A-1",
      "ISO-8601",
      "RFC-3339",
    ]);
    expect(extractLinearIssueCandidates(undefined)).toEqual([]);
  });

  test("validates bare candidates against known teams and ignores unknown teams", () => {
    expect(
      collectLinearIssueEvidence({
        request: "Implement A-1 while converting ISO-8601 to RFC-3339.",
        branch: "main",
        linearTeamKeys: ["A"],
      }),
    ).toEqual({
      issueIds: ["A-1"],
      unresolvedBareIssueIds: [],
      linearTeamKeysUnavailable: false,
    });
  });

  test("deduplicates validated request and branch evidence case-insensitively", () => {
    expect(
      collectLinearIssueIds({
        request: "Work on not-548, then NOT-548 again.",
        branch: "gbastianelli/not-548-routing",
        linearTeamKeys: ["NOT"],
      }),
    ).toEqual(["NOT-548"]);
  });

  test("preserves request-before-branch order for distinct validated identifiers", () => {
    expect(
      collectLinearIssueIds({
        request: "Compare not-548 with ENG-42.",
        branch: "gbastianelli/eng-42-and-ops-7",
        linearTeamKeys: ["NOT", "ENG", "OPS"],
      }),
    ).toEqual(["NOT-548", "ENG-42", "OPS-7"]);
  });

  test("validates explicit Linear URLs when team metadata is unavailable", () => {
    const input = {
      request: "Handle https://linear.app/nuthouse/issue/not-548/fix-ac-1?related=ops-7#rfc-3339",
      branch: "main",
      linearTeamKeys: null,
    };

    expect(extractLinearIssueIds(input.request, { linearTeamKeys: null })).toEqual(["NOT-548"]);
    expect(collectLinearIssueEvidence(input)).toEqual({
      issueIds: ["NOT-548"],
      unresolvedBareIssueIds: [],
      linearTeamKeysUnavailable: true,
    });
  });

  test("does not rescan an explicit Linear URL slug, query, or fragment as bare evidence", () => {
    expect(
      collectLinearIssueEvidence({
        request: "Handle https://linear.app/nuthouse/issue/not-548/fix-ac-1?related=ops-7#rfc-3339",
        branch: "main",
        linearTeamKeys: ["NOT", "AC", "OPS", "RFC"],
      }),
    ).toEqual({
      issueIds: ["NOT-548"],
      unresolvedBareIssueIds: [],
      linearTeamKeysUnavailable: false,
    });
  });

  test("keeps balanced URL punctuation and apostrophes inside explicit evidence spans", () => {
    const urls = [
      "https://linear.app/nuthouse/issue/not-548/slug-(ops-7)",
      "https://linear.app/nuthouse/issue/not-548?context=(ops-7)&owner=o'connor-7",
      "https://linear.app/nuthouse/issue/not-548#note=(ops-7)-o'connor-7",
    ];

    for (const linearTeamKeys of [null, ["NOT", "OPS", "CONNOR"]]) {
      for (const request of urls) {
        expect(collectLinearIssueEvidence({ request, branch: "main", linearTeamKeys })).toEqual({
          issueIds: ["NOT-548"],
          unresolvedBareIssueIds: [],
          linearTeamKeysUnavailable: linearTeamKeys === null,
        });
      }
    }
  });

  test("keeps adjacent Markdown and autolink Linear URLs as distinct evidence", () => {
    const requests = [
      "[first](https://linear.app/nuthouse/issue/not-548/fix-ac-1)[second](https://linear.app/nuthouse/issue/ops-7/fix-rfc-3339)",
      "<https://linear.app/nuthouse/issue/not-548/fix-ac-1><https://linear.app/nuthouse/issue/ops-7/fix-rfc-3339>",
    ];

    for (const request of requests) {
      expect(collectLinearIssueEvidence({ request, branch: "main", linearTeamKeys: null })).toEqual(
        {
          issueIds: ["NOT-548", "OPS-7"],
          unresolvedBareIssueIds: [],
          linearTeamKeysUnavailable: true,
        },
      );
      expect(
        classifyWorkflow({
          projectIntent: "absent",
          request,
          branch: "main",
          linearTeamKeys: null,
        }),
      ).toBe("ambiguous");
    }
  });

  test("keeps URL sub-delimiters and their candidates inside explicit evidence", () => {
    expect(
      collectLinearIssueEvidence({
        request: "https://linear.app/nuthouse/issue/not-548/view?related=ops-7,eng-8;next=rfc-3339",
        branch: "main",
        linearTeamKeys: null,
      }),
    ).toEqual({
      issueIds: ["NOT-548"],
      unresolvedBareIssueIds: [],
      linearTeamKeysUnavailable: true,
    });
  });

  test("detects bare evidence separated from an explicit URL by whitespace", () => {
    expect(
      collectLinearIssueIds({
        request: "https://linear.app/nuthouse/issue/not-548/fix-ac-1, OPS-7",
        branch: "main",
        linearTeamKeys: ["NOT", "AC", "OPS"],
      }),
    ).toEqual(["NOT-548", "OPS-7"]);
  });

  test("exposes unresolved bare candidates when team metadata is unavailable", () => {
    expect(
      collectLinearIssueEvidence({
        request: "Work on NOT-548",
        branch: "gbastianelli/a-1-follow-up",
        linearTeamKeys: null,
      }),
    ).toEqual({
      issueIds: [],
      unresolvedBareIssueIds: ["NOT-548", "A-1"],
      linearTeamKeysUnavailable: true,
    });
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
      input: {
        projectIntent: "absent",
        request: "Please deliver not-548",
        branch: "main",
        linearTeamKeys: ["NOT"],
      },
    },
    {
      name: "branch-only evidence",
      input: {
        projectIntent: "absent",
        request: "Please deliver the routing change",
        branch: "gbastianelli/not-548-routing",
        linearTeamKeys: ["NOT"],
      },
    },
    {
      name: "a Linear issue URL",
      input: {
        projectIntent: "absent",
        request: "Handle https://linear.app/nuthouse/issue/not-548/routing-kernel",
        branch: "main",
        linearTeamKeys: null,
      },
    },
    {
      name: "matching request and branch evidence",
      input: {
        projectIntent: "absent",
        request: "Work on NOT-548",
        branch: "gbastianelli/not-548-routing",
        linearTeamKeys: ["NOT"],
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

  test("ignores canonical unknown-team tokens when team metadata is available", () => {
    expect(
      classifyWorkflow({
        projectIntent: "absent",
        request: "Convert ISO-8601 to RFC-3339 and document AC-001.",
        branch: "main",
        linearTeamKeys: ["NOT"],
      }),
    ).toBe("direct-task");
  });

  test("classifies a known one-character team issue as issue delivery", () => {
    expect(
      classifyWorkflow({
        projectIntent: "absent",
        request: "Deliver A-1",
        branch: "main",
        linearTeamKeys: ["A"],
      }),
    ).toBe("issue-delivery");
  });

  test("returns ambiguous for bare issue evidence when team metadata is unavailable", () => {
    expect(
      classifyWorkflow({
        projectIntent: "absent",
        request: "Deliver NOT-548",
        branch: "main",
        linearTeamKeys: null,
      }),
    ).toBe("ambiguous");
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
        linearTeamKeys: ["NOT"],
      },
    },
    {
      name: "multiple request identifiers",
      input: {
        projectIntent: "absent",
        request: "Deliver NOT-548 and OPS-7",
        branch: "main",
        linearTeamKeys: ["NOT", "OPS"],
      },
    },
    {
      name: "different request and branch identifiers",
      input: {
        projectIntent: "absent",
        request: "Deliver NOT-548",
        branch: "gbastianelli/ops-7-other-work",
        linearTeamKeys: ["NOT", "OPS"],
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
      linearTeamKeys: Object.freeze(["NOT"]),
    });
    const before = structuredClone(input);

    expect(classifyWorkflow(input)).toBe("issue-delivery");
    expect(input).toEqual(before);
  });
});
