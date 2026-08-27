import { createHash } from "node:crypto";

const HASH_PREFIX = "sha256:";

export class ProjectGraphError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "ProjectGraphError";
    this.code = code;
    this.relation = options.relation;
    this.detail = options.detail ?? {};
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.relation === undefined ? {} : { relation: this.relation }),
      ...(Object.keys(this.detail).length === 0 ? {} : { detail: this.detail }),
    };
  }
}

function fail(code, message, options) {
  throw new ProjectGraphError(code, message, options);
}

function requireObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_SHAPE", `${label} must be an object`, { detail: { label } });
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    fail("INVALID_SHAPE", `${label} must be an array`, { detail: { label } });
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("INVALID_SHAPE", `${label} must be a non-empty string`, { detail: { label } });
  }
  return value.trim();
}

function requireExactString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("INVALID_SHAPE", `${label} must be a non-empty string`, { detail: { label } });
  }
  return value;
}

function nullableDate(value, label) {
  if (value === undefined || value === null) return null;
  const normalized = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    fail("INVALID_SHAPE", `${label} must be YYYY-MM-DD or null`, { detail: { label } });
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized) {
    fail("INVALID_SHAPE", `${label} must be a real calendar date`, { detail: { label } });
  }
  return normalized;
}

function uniqueSortedStrings(value, label) {
  const values = requireArray(value, label).map((entry, index) =>
    requireString(entry, `${label}[${index}]`),
  );
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function compareRef(left, right) {
  return left.clientRef.localeCompare(right.clientRef);
}

function edgeKey(edge) {
  return `${edge.dependentRef}\u0000${edge.blockerRef}`;
}

function edgeLabel(edge) {
  return `${edge.dependentRef}<-${edge.blockerRef}`;
}

function assertUniqueRefs(entries, kind) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.clientRef)) {
      fail("DUPLICATE_ENTITY", `duplicate ${kind} clientRef: ${entry.clientRef}`, {
        detail: { kind, clientRef: entry.clientRef },
      });
    }
    seen.add(entry.clientRef);
  }
}

function findCycle(issueRefs, edges) {
  const dependentsByBlocker = new Map([...issueRefs].map((issueRef) => [issueRef, []]));
  for (const edge of edges) {
    dependentsByBlocker.get(edge.blockerRef).push(edge.dependentRef);
  }
  for (const dependents of dependentsByBlocker.values()) dependents.sort();

  const state = new Map();
  const stack = [];
  const stackIndex = new Map();

  function visit(issueRef) {
    state.set(issueRef, "visiting");
    stackIndex.set(issueRef, stack.length);
    stack.push(issueRef);

    for (const dependentRef of dependentsByBlocker.get(issueRef)) {
      if (state.get(dependentRef) === "visiting") {
        return [...stack.slice(stackIndex.get(dependentRef)), dependentRef];
      }
      if (state.get(dependentRef) !== "visited") {
        const cycle = visit(dependentRef);
        if (cycle) return cycle;
      }
    }

    stack.pop();
    stackIndex.delete(issueRef);
    state.set(issueRef, "visited");
    return undefined;
  }

  for (const issueRef of [...issueRefs].sort()) {
    if (state.has(issueRef)) continue;
    const cycle = visit(issueRef);
    if (cycle) return cycle;
  }
  return undefined;
}

function normalizeGraph(input) {
  const graph = requireObject(input, "graph");
  if (graph.schemaVersion !== 1) {
    fail("UNSUPPORTED_SCHEMA", "graph.schemaVersion must be 1", {
      detail: { schemaVersion: graph.schemaVersion },
    });
  }

  const rawProject = requireObject(graph.project, "graph.project");
  const project = {
    clientRef: requireString(rawProject.clientRef, "graph.project.clientRef"),
    teamId: requireString(rawProject.teamId, "graph.project.teamId"),
    title: requireString(rawProject.title, "graph.project.title"),
  };

  const milestones = requireArray(graph.milestones, "graph.milestones")
    .map((value, index) => {
      const milestone = requireObject(value, `graph.milestones[${index}]`);
      return {
        clientRef: requireString(milestone.clientRef, `graph.milestones[${index}].clientRef`),
        projectRef: requireString(milestone.projectRef, `graph.milestones[${index}].projectRef`),
        title: requireString(milestone.title, `graph.milestones[${index}].title`),
      };
    })
    .sort(compareRef);

  const issues = requireArray(graph.issues, "graph.issues")
    .map((value, index) => {
      const issue = requireObject(value, `graph.issues[${index}]`);
      const normalized = {
        clientRef: requireString(issue.clientRef, `graph.issues[${index}].clientRef`),
        projectRef: requireString(issue.projectRef, `graph.issues[${index}].projectRef`),
        title: requireString(issue.title, `graph.issues[${index}].title`),
        acceptanceIds: uniqueSortedStrings(
          issue.acceptanceIds,
          `graph.issues[${index}].acceptanceIds`,
        ),
      };
      if (issue.foundationReason !== undefined && issue.foundationReason !== null) {
        normalized.foundationReason = requireString(
          issue.foundationReason,
          `graph.issues[${index}].foundationReason`,
        );
      }
      if (issue.milestoneRef !== undefined && issue.milestoneRef !== null) {
        normalized.milestoneRef = requireString(
          issue.milestoneRef,
          `graph.issues[${index}].milestoneRef`,
        );
      }
      return normalized;
    })
    .sort(compareRef);

  const edges = requireArray(graph.edges, "graph.edges").map((value, index) => {
    const edge = requireObject(value, `graph.edges[${index}]`);
    if (!("dependentRef" in edge) || !("blockerRef" in edge)) {
      fail("INVALID_DIRECTION", "edges must use dependentRef -> blockerRef", {
        relation: { ...edge },
        detail: { index },
      });
    }
    return {
      dependentRef: requireString(edge.dependentRef, `graph.edges[${index}].dependentRef`),
      blockerRef: requireString(edge.blockerRef, `graph.edges[${index}].blockerRef`),
    };
  });

  return { schemaVersion: 1, project, milestones, issues, edges };
}

export function validateProjectGraph(input) {
  const graph = normalizeGraph(input);
  assertUniqueRefs(graph.milestones, "milestone");
  assertUniqueRefs(graph.issues, "issue");

  const rawEdgeByIssue = new Map();
  for (const edge of graph.edges) {
    if (!rawEdgeByIssue.has(edge.dependentRef)) rawEdgeByIssue.set(edge.dependentRef, edge);
    if (!rawEdgeByIssue.has(edge.blockerRef)) rawEdgeByIssue.set(edge.blockerRef, edge);
  }

  for (const milestone of graph.milestones) {
    if (milestone.projectRef !== graph.project.clientRef) {
      fail("CROSS_PROJECT", `milestone ${milestone.clientRef} belongs to another project`, {
        relation: { milestoneRef: milestone.clientRef, projectRef: milestone.projectRef },
      });
    }
  }

  const milestoneRefs = new Set(graph.milestones.map((milestone) => milestone.clientRef));
  for (const issue of graph.issues) {
    if (issue.projectRef !== graph.project.clientRef) {
      fail("CROSS_PROJECT", `issue ${issue.clientRef} belongs to another project`, {
        relation: rawEdgeByIssue.get(issue.clientRef) ?? {
          issueRef: issue.clientRef,
          projectRef: issue.projectRef,
        },
      });
    }
    if (issue.acceptanceIds.length === 0 && !issue.foundationReason) {
      fail("ACCEPTANCE_MISSING", `issue ${issue.clientRef} has no Acceptance coverage`, {
        detail: { issueRef: issue.clientRef },
      });
    }
    if (issue.acceptanceIds.length > 0 && issue.foundationReason) {
      fail(
        "COVERAGE_AMBIGUOUS",
        `issue ${issue.clientRef} cannot mix Acceptance ids and foundation coverage`,
        { detail: { issueRef: issue.clientRef } },
      );
    }
    if (issue.milestoneRef && !milestoneRefs.has(issue.milestoneRef)) {
      fail("UNKNOWN_MILESTONE", `issue ${issue.clientRef} names an unknown milestone`, {
        relation: { issueRef: issue.clientRef, milestoneRef: issue.milestoneRef },
      });
    }
  }

  const issueRefs = new Set(graph.issues.map((issue) => issue.clientRef));
  const seenEdges = new Set();
  for (const edge of graph.edges) {
    if (!issueRefs.has(edge.dependentRef) || !issueRefs.has(edge.blockerRef)) {
      fail("UNKNOWN_TARGET", `edge ${edgeLabel(edge)} targets an unknown issue`, {
        relation: edge,
      });
    }
    if (edge.dependentRef === edge.blockerRef) {
      fail("SELF_EDGE", `edge ${edgeLabel(edge)} is a self-dependency`, { relation: edge });
    }
    const key = edgeKey(edge);
    if (seenEdges.has(key)) {
      fail("DUPLICATE_EDGE", `edge ${edgeLabel(edge)} is duplicated`, { relation: edge });
    }
    seenEdges.add(key);
  }

  const sortedEdges = [...graph.edges].sort((left, right) =>
    edgeKey(left).localeCompare(edgeKey(right)),
  );
  const cycle = findCycle(issueRefs, sortedEdges);
  if (cycle) {
    const blockerRef = cycle.at(-2);
    const dependentRef = cycle.at(-1);
    fail("CYCLE", `dependency cycle detected: ${cycle.join(" -> ")}`, {
      relation: sortedEdges.find(
        (edge) => edge.blockerRef === blockerRef && edge.dependentRef === dependentRef,
      ),
      detail: { cycle },
    });
  }

  return { ...graph, edges: sortedEdges };
}

export function canonicalizeProjectGraph(input) {
  return validateProjectGraph(input);
}

export function hashProjectGraph(input) {
  const canonical = canonicalizeProjectGraph(input);
  const digest = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return `${HASH_PREFIX}${digest}`;
}

function requireClientRefMarker(description, clientRef, label) {
  const marker = `<!-- nuthouse-client-ref: ${clientRef} -->`;
  if (!description.includes(marker)) {
    fail("CLIENT_REF_MARKER_MISSING", `${label} is missing its exact client-ref marker`, {
      detail: { clientRef, marker },
    });
  }
}

export function foundationReasonMarker(reason) {
  const normalized = requireString(reason, "foundationReason");
  return `<!-- nuthouse-foundation-reason: ${Buffer.from(normalized, "utf8").toString("base64url")} -->`;
}

function assertSameRefs(kind, graphEntries, mutationEntries) {
  const graphRefs = graphEntries.map((entry) => entry.clientRef).sort();
  const mutationRefs = mutationEntries.map((entry) => entry.clientRef).sort();
  if (JSON.stringify(graphRefs) !== JSON.stringify(mutationRefs)) {
    fail("MUTATION_GRAPH_MISMATCH", `${kind} mutation refs do not match the graph`, {
      detail: { graphRefs, mutationRefs },
    });
  }
}

function mutationEdgeMap(graph) {
  const blockersByDependent = new Map(graph.issues.map((issue) => [issue.clientRef, []]));
  for (const edge of graph.edges) blockersByDependent.get(edge.dependentRef).push(edge.blockerRef);
  for (const blockers of blockersByDependent.values()) blockers.sort();
  return blockersByDependent;
}

export function validateMutationEnvelope(input) {
  const envelope = requireObject(input, "mutationEnvelope");
  if (envelope.schemaVersion !== 1) {
    fail("UNSUPPORTED_SCHEMA", "mutationEnvelope.schemaVersion must be 1", {
      detail: { schemaVersion: envelope.schemaVersion },
    });
  }

  const graph = validateProjectGraph(envelope.graph);
  const rawProject = requireObject(envelope.project, "mutationEnvelope.project");
  const project = {
    clientRef: requireString(rawProject.clientRef, "mutationEnvelope.project.clientRef"),
    name: requireExactString(rawProject.name, "mutationEnvelope.project.name"),
    description: requireExactString(rawProject.description, "mutationEnvelope.project.description"),
    teamIds: uniqueSortedStrings(rawProject.teamIds, "mutationEnvelope.project.teamIds"),
    statusId: requireString(rawProject.statusId, "mutationEnvelope.project.statusId"),
  };

  const milestones = requireArray(envelope.milestones, "mutationEnvelope.milestones")
    .map((value, index) => {
      const milestone = requireObject(value, `mutationEnvelope.milestones[${index}]`);
      return {
        clientRef: requireString(
          milestone.clientRef,
          `mutationEnvelope.milestones[${index}].clientRef`,
        ),
        projectRef: requireString(
          milestone.projectRef,
          `mutationEnvelope.milestones[${index}].projectRef`,
        ),
        name: requireExactString(milestone.name, `mutationEnvelope.milestones[${index}].name`),
        description: requireExactString(
          milestone.description,
          `mutationEnvelope.milestones[${index}].description`,
        ),
        targetDate: nullableDate(
          milestone.targetDate,
          `mutationEnvelope.milestones[${index}].targetDate`,
        ),
      };
    })
    .sort(compareRef);

  const issues = requireArray(envelope.issues, "mutationEnvelope.issues")
    .map((value, index) => {
      const issue = requireObject(value, `mutationEnvelope.issues[${index}]`);
      return {
        clientRef: requireString(issue.clientRef, `mutationEnvelope.issues[${index}].clientRef`),
        draftKey: requireString(issue.draftKey, `mutationEnvelope.issues[${index}].draftKey`),
        projectRef: requireString(issue.projectRef, `mutationEnvelope.issues[${index}].projectRef`),
        milestoneRef:
          issue.milestoneRef === undefined || issue.milestoneRef === null
            ? null
            : requireString(issue.milestoneRef, `mutationEnvelope.issues[${index}].milestoneRef`),
        teamId: requireString(issue.teamId, `mutationEnvelope.issues[${index}].teamId`),
        title: requireExactString(issue.title, `mutationEnvelope.issues[${index}].title`),
        description: requireExactString(
          issue.description,
          `mutationEnvelope.issues[${index}].description`,
        ),
        labelIds: uniqueSortedStrings(issue.labelIds, `mutationEnvelope.issues[${index}].labelIds`),
        blockedByRefs: uniqueSortedStrings(
          issue.blockedByRefs,
          `mutationEnvelope.issues[${index}].blockedByRefs`,
        ),
      };
    })
    .sort(compareRef);

  assertUniqueRefs(milestones, "milestone mutation");
  assertUniqueRefs(issues, "issue mutation");
  assertSameRefs("milestone", graph.milestones, milestones);
  assertSameRefs("issue", graph.issues, issues);

  if (
    project.clientRef !== graph.project.clientRef ||
    project.name !== graph.project.title ||
    project.teamIds.length !== 1 ||
    project.teamIds[0] !== graph.project.teamId
  ) {
    fail("MUTATION_GRAPH_MISMATCH", "project mutation does not match the graph project");
  }
  requireClientRefMarker(project.description, project.clientRef, "project description");

  const graphMilestones = new Map(graph.milestones.map((entry) => [entry.clientRef, entry]));
  for (const milestone of milestones) {
    const graphMilestone = graphMilestones.get(milestone.clientRef);
    if (
      milestone.projectRef !== graphMilestone.projectRef ||
      milestone.name !== graphMilestone.title
    ) {
      fail(
        "MUTATION_GRAPH_MISMATCH",
        `milestone mutation ${milestone.clientRef} does not match the graph`,
      );
    }
    requireClientRefMarker(
      milestone.description,
      milestone.clientRef,
      `milestone ${milestone.clientRef} description`,
    );
  }

  const graphIssues = new Map(graph.issues.map((entry) => [entry.clientRef, entry]));
  const blockersByDependent = mutationEdgeMap(graph);
  for (const issue of issues) {
    const graphIssue = graphIssues.get(issue.clientRef);
    if (
      issue.projectRef !== graphIssue.projectRef ||
      issue.milestoneRef !== (graphIssue.milestoneRef ?? null) ||
      issue.teamId !== graph.project.teamId ||
      issue.title !== graphIssue.title ||
      JSON.stringify(issue.blockedByRefs) !==
        JSON.stringify(blockersByDependent.get(issue.clientRef))
    ) {
      fail("MUTATION_GRAPH_MISMATCH", `issue mutation ${issue.clientRef} does not match the graph`);
    }
    requireClientRefMarker(
      issue.description,
      issue.clientRef,
      `issue ${issue.clientRef} description`,
    );
    if (
      graphIssue.foundationReason &&
      !issue.description.includes(foundationReasonMarker(graphIssue.foundationReason))
    ) {
      fail(
        "FOUNDATION_MARKER_MISSING",
        `issue ${issue.clientRef} is missing its encoded foundation reason marker`,
        { detail: { issueRef: issue.clientRef } },
      );
    }
  }

  return { schemaVersion: 1, graph, project, milestones, issues };
}

export function canonicalizeMutationEnvelope(input) {
  return validateMutationEnvelope(input);
}

export function hashMutationEnvelope(input) {
  const canonical = canonicalizeMutationEnvelope(input);
  const digest = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  return `${HASH_PREFIX}${digest}`;
}

function compareEntities(kind, expected, actual) {
  const differences = [];
  const expectedByRef = new Map(expected.map((entry) => [entry.clientRef, entry]));
  const actualByRef = new Map(actual.map((entry) => [entry.clientRef, entry]));

  for (const [clientRef, expectedEntry] of expectedByRef) {
    const actualEntry = actualByRef.get(clientRef);
    if (!actualEntry) differences.push(`${kind}_MISSING ${clientRef}`);
    else if (JSON.stringify(expectedEntry) !== JSON.stringify(actualEntry)) {
      differences.push(`${kind}_CHANGED ${clientRef}`);
    }
  }
  for (const clientRef of actualByRef.keys()) {
    if (!expectedByRef.has(clientRef)) differences.push(`${kind}_EXTRA ${clientRef}`);
  }
  return differences;
}

function compareEdges(expected, actual) {
  const differences = [];
  const expectedKeys = new Set(expected.map(edgeKey));
  const actualKeys = new Set(actual.map(edgeKey));
  const consumedActual = new Set();

  for (const edge of expected) {
    const key = edgeKey(edge);
    if (actualKeys.has(key)) {
      consumedActual.add(key);
      continue;
    }
    const reversed = { dependentRef: edge.blockerRef, blockerRef: edge.dependentRef };
    const reversedKey = edgeKey(reversed);
    if (actualKeys.has(reversedKey) && !expectedKeys.has(reversedKey)) {
      differences.push(`EDGE_REVERSED ${edgeLabel(edge)} actual=${edgeLabel(reversed)}`);
      consumedActual.add(reversedKey);
    } else {
      differences.push(`EDGE_MISSING ${edgeLabel(edge)}`);
    }
  }

  for (const edge of actual) {
    const key = edgeKey(edge);
    if (!expectedKeys.has(key) && !consumedActual.has(key)) {
      differences.push(`EDGE_EXTRA ${edgeLabel(edge)}`);
    }
  }
  return differences;
}

export function compareProjectGraphs(approvedInput, actualInput) {
  const approved = canonicalizeProjectGraph(approvedInput);
  const actual = canonicalizeProjectGraph(actualInput);
  const differences = [];

  if (JSON.stringify(approved.project) !== JSON.stringify(actual.project)) {
    differences.push("PROJECT_CHANGED");
  }
  differences.push(...compareEntities("MILESTONE", approved.milestones, actual.milestones));
  differences.push(...compareEntities("ISSUE", approved.issues, actual.issues));
  differences.push(...compareEdges(approved.edges, actual.edges));

  return {
    equivalent: differences.length === 0,
    differences,
    approvedHash: hashProjectGraph(approved),
    actualHash: hashProjectGraph(actual),
  };
}
