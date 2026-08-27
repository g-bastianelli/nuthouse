# contract: project graph

## Shape

```ts
type ProjectGraph = {
  schemaVersion: 1;
  project: { clientRef: string; teamId: string; title: string };
  milestones: Array<{ clientRef: string; projectRef: string; title: string }>;
  issues: Array<{
    clientRef: string;
    projectRef: string;
    milestoneRef?: string;
    title: string;
    acceptanceIds: string[];
  }>;
  edges: Array<{ dependentRef: string; blockerRef: string }>;
};

type ProjectGraphReceipt = {
  schemaVersion: 1;
  payloadHash: `sha256:${string}`;
  verified: boolean;
  verifiedAt?: string;
  differences: string[];
};
```

## Origin

- source: Components / data flow:148
- producer: `linear-devotee:project-drafter`, `linear-devotee:create-project`
- consumer(s): `linear-devotee:create-project`, `monkey-maestro:start`
- covers: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007

## Invariants

- All arrays and identifier lists are sorted canonically before hashing; enforced by runtime canonicalization and hash fixtures.
- Every edge points from `dependentRef` to `blockerRef`, stays inside one project, and is unique; enforced by graph validation and table tests.
- Every issue has at least one Acceptance id; enforced by the pre-mutation runtime guard.
- `verified` is true only after exact normalized post-write equivalence; enforced by the cascade state machine and drift tests.

## Errors

- `GRAPH_INVALID` identifies the exact unknown, self, duplicate, cross-project, reversed, or cyclic relation and surfaces before mutation.
- `APPROVAL_HASH_MISMATCH` surfaces at the mutation gate if the approved preview changed.
- `GRAPH_DRIFT` contains missing, extra, or reversed entities/edges and leaves the project unverified.
