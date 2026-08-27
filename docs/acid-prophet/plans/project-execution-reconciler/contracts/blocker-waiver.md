# contract: blocker waiver

## Shape

```ts
type BlockerWaiver = {
  marker: "nuthouse:maestro-waiver";
  schemaVersion: 1;
  dependentIssueId: string;
  blockerIssueId: string;
  reason: string;
  approver: string;
  approvedAt: string;
  revokedAt?: string;
};
```

## Origin

- source: Architecture / Durable control state:92
- producer: explicit human Linear comment
- consumer(s): `monkey-maestro:project-snapshot-loader`, `monkey-maestro:reconcile`
- covers: AC-021, AC-022, AC-023, AC-024

## Invariants

- A waiver applies to exactly one blocker-to-dependent relation; enforced by exact id matching.
- Only a non-revoked, complete, human-attributed record is valid; enforced by parser guards.
- A canceled blocker without this record remains blocking; enforced by eligibility fixtures.

## Errors

- `WAIVER_INVALID` ignores the malformed record and reports the issue as blocked.
- `WAIVER_RELATION_MISMATCH` refuses to satisfy any other edge.
