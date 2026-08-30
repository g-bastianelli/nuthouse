# contract: dispatch-lock-owner

## Shape

```ts
type DispatchLockOwner = {
  schemaVersion: 2;
  projectId: string;
  hostId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
};

type LockInspection = {
  state: "free" | "held" | "stale" | "empty" | "legacy-transition";
  owner?: DispatchLockOwner;
};

type DispatchLockVerification = {
  directory: string;
  projectId: string;
  hostId: string;
  token: string;
  verifiedAt: string;
  expiresAt: string;
};
```

## Origin

- source: Error handling:241
- producer: project lock helper
- consumer(s): `orchestrate`, `spawn`
- covers: AC-011, AC-012, AC-028

## Invariants

- Acquisition is exclusive.
- Release requires the matching token.
- Every transport mutation first verifies the token, owner, host, and unexpired lease against the live lock artifact.
- The dispatch envelope returns the helper's exact inner `verification` as `lockVerification`.
- Recovery never acquires the stale artifact being recovered.

## Errors

- Live owner surfaces as `LOCK_HELD`.
- Missing, changed, or expired ownership refuses the transport mutation.
- Empty, expired, and legacy transition artifacts are recoverable.
