# contract: linear-frontier-plan

## Shape

```ts
type FrontierRow = {
  issueId: string;
  blockerIssueIds: string[];
  linearStatusType: LinearIssueFact["statusType"];
  classification: "terminal" | "ready" | "started" | "blocked" | "unknown";
  reason?: string;
  forced: boolean;
  forceBypassedBlockerIssueIds?: string[];
  forceBypassedUncertainties?: Array<{ issueId: string | null; code: string }>;
};

type LinearFrontierPlan = {
  rows: FrontierRow[];
  readyIssueIds: string[];
  startedIssueIds: string[];
  confirmationIssueIds: string[];
  unknownIssueIds: string[];
  degraded: boolean;
  globalUnknown: { code: string; detail: string }[];
};
```

## Origin

- source: Architecture:144
- producer: `planLinearFrontier`
- consumer(s): `status`, `orchestrate`, `spawn`
- covers: AC-004, AC-005, AC-006, AC-007, AC-008, AC-010, AC-029

## Invariants

- Terminal Linear status wins before runtime access.
- Readiness depends only on live status and blockers.
- Force is ephemeral and cannot reclassify a terminal issue.
- Every forced row is the canonical producer of its exact blocker and uncertainty preview scopes.
- An absent blocker is a nonterminal bypass plus canonical relation uncertainty; it never crashes force planning.
- A known `started` row remains `started` through relation-only defects so runtime monitoring and capacity accounting cannot lose active work. Unknown identity, membership, data, or status still produces `unknown`.
- `linearStatusType` preserves the validated live status underneath a force overlay.
- Project-wide retrieval uncertainty sets `degraded` even when the returned issue set is empty.

## Errors

- Invalid components produce scoped `unknown` rows.
- Duplicate issue identifiers reject the affected snapshot.
