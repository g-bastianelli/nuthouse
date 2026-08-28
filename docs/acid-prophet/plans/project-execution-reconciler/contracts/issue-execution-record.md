# contract: issue execution record

## Shape

```ts
type IssueExecutionRecord = {
  marker: "nuthouse:maestro-execution";
  schemaVersion: 1;
  issueId: string;
  runId: string;
  outcome: "verified" | "partial" | "degraded" | "repaired";
  workspaceId: string;
  terminalId?: string;
  taskId: string;
  branch: string;
  agent: string;
  hostId: string;
  recordedAt: string;
  detail?: string;
};
```

## Origin

- source: Architecture / Durable control state:92
- producer: `monkey-maestro:spawn`, `monkey-maestro:reconcile`
- consumer(s): `monkey-maestro:reconcile`, human operators
- covers: AC-018, AC-034, AC-035, AC-036, AC-039, AC-041, AC-047, AC-048, AC-049, AC-050

## Invariants

- `issueId` is Linear's exact opaque team identifier and `taskId` is the distinct internal Superset task UUID returned by an exact task lookup; spawn verifies their provider binding before mutation and reconciliation fixtures prove correlation without equality.
- `verified` requires both `workspaceId` and `terminalId`; enforced by the record parser.
- `partial` preserves a created workspace and forbids an automatic duplicate; enforced by resolver actions.
- A missing Linear comment never invalidates an existing verified runtime; enforced by repair decisions.

## Errors

- `EXECUTION_AMBIGUOUS` reports every runtime claiming the same `taskId` and blocks only that issue.
- `EXECUTION_PARTIAL` records workspace identity when agent launch fails.
- `TRACEABILITY_DEGRADED` preserves runtime identity when the Linear comment write fails.
