# contract: maestro control record

## Shape

```ts
type MaestroControlRecord = {
  marker: "nuthouse:maestro-control";
  schemaVersion: 1;
  projectId: string;
  runId: string;
  active: boolean;
  repository: string;
  supersetProjectId: string;
  targetHostId: string;
  defaultAgent: string;
  maxConcurrency: number;
  executionIssueIds: string[];
  decisionBaseline: {
    issueIds: string[];
    edges: Array<{ dependentIssueId: string; blockerIssueId: string }>;
  };
  decisionHash: `sha256:${string}`;
  graphHash: `sha256:${string}`;
  revision: number;
  updatedAt: string;
};
```

## Origin

- source: Architecture / Durable control state:92
- producer: `monkey-maestro:start`, `monkey-maestro:reconcile`, `monkey-maestro:stop`
- consumer(s): `monkey-maestro:reconcile`, `monkey-maestro:spawn`
- covers: AC-008, AC-009, AC-010, AC-011, AC-012, AC-013, AC-014

## Invariants

- `maxConcurrency` is an integer from 1 through 10 and defaults to 4; enforced by the parser and unit tests.
- Revisions increase monotonically for one project; enforced by `start`/`stop` write instructions.
- `active: false` prevents dispatch but never implies runtime termination; enforced by reconciliation decisions.
- `executionIssueIds` is a sorted, unique ownership index for capacity-consuming runtime
  work that left the project; it never grants eligibility.
- The record is stored as a versioned Linear project comment, not local state; enforced by the shared execution contract and workflow gate.

## Errors

- `CONTROL_INVALID` blocks all mutations when fields or versions cannot be normalized.
- `CONTROL_INACTIVE` returns a successful no-dispatch report.
- `CONCURRENCY_OUT_OF_RANGE` rejects activation before writing a comment.
