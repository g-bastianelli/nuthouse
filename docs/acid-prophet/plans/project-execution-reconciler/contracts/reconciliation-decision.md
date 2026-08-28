# contract: reconciliation decision

## Shape

```ts
type ReconciliationDecision = {
  schemaVersion: 1;
  projectId: string;
  runId: string;
  status: "ready" | "noop" | "blocked";
  availableSlots: number;
  active: Array<{
    issueId: string;
    taskId?: string;
    workspaceId: string;
    terminalId?: string;
    managed: boolean;
  }>;
  dispatch: Array<{ issueId: string; taskId: string; order: number }>;
  repair: Array<{ issueId: string; taskId: string; workspaceId: string; terminalId?: string }>;
  inspect: Array<{ issueId: string; resourceIds: string[]; reason: string }>;
  quarantined: Array<{ issueId: string; reasons: string[] }>;
  confirmations: Array<{ issueId: string; reason: string }>;
  blocked: Array<{ issueId: string; reasons: string[] }>;
  globalReasons: string[];
};
```

## Origin

- source: Architecture / Reconciliation lifecycle:116
- producer: `monkey-maestro/lib/reconciliation-state.mjs`
- consumer(s): `monkey-maestro:reconcile`, reconciliation state tests
- covers: AC-015, AC-016, AC-017, AC-018, AC-019, AC-020, AC-021, AC-022, AC-023, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033

## Invariants

- Dispatch count never exceeds `availableSlots`; enforced by the pure resolver and fixtures.
- Capacity includes only owned live task executions; unlinked/foreign workspaces and an
  exact recorded agent terminal with `exited: true` do not consume a slot.
- Dispatch order is the normalized Linear order with a stable id tie-break; enforced by sorting tests.
- Every dispatch binds an opaque Linear `issueId` to a distinct exact Superset `taskId`; missing or ambiguous bindings are inspected and never dispatched.
- Invalid nodes plus descendants are quarantined while disconnected valid components remain resolvable; enforced by component fixtures.
- Unknown required provider state produces no dispatch for the affected decision; enforced by normalization fixtures.

## Errors

- `LOCK_HELD` returns without external mutation before snapshot resolution.
- `PROVIDER_UNAVAILABLE` blocks new dispatch while preserving active executions.
- `GRAPH_COMPONENT_INVALID` lists the quarantined component and descendants.
- `RUNNABLE_EXPANSION_CONFIRMATION_REQUIRED` withholds only newly expanded work.
