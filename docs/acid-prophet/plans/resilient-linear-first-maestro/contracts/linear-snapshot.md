# contract: linear-snapshot

## Shape

```ts
type LinearIssueFact = {
  issueId: string;
  projectId: string;
  statusType: "backlog" | "triage" | "unstarted" | "started" | "completed" | "canceled" | "unknown";
  blockerIssueIds: string[];
  dataState: "known" | "unknown";
};

type LinearSnapshot = {
  schemaVersion: 1;
  projectId: string;
  scope: { mode: "full" | "targeted"; requestedIssueIds: string[] };
  issues: LinearIssueFact[];
  unknown: { issueId?: string; code: string; detail: string }[];
};
```

## Origin

- source: Architecture:132
- producer: Linear retrieval adapter
- consumer(s): in-memory cache, `planLinearFrontier`, `status`
- covers: AC-001, AC-002, AC-003, AC-026

## Invariants

- Exact requested scope is enforced by runtime validation and fixtures.
- Relations come only from live `blockedBy` detail responses.
- Inputs are sorted and deduplicated by the pure validator.

## Errors

- Missing requested issue surfaces as issue-scoped `SNAPSHOT_INCOMPLETE`.
- Expanded scope or malformed JSON is rejected before cache mutation.
