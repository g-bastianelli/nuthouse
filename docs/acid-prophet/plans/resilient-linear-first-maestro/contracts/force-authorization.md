# contract: force-authorization

## Shape

```ts
type ForceAuthorization = {
  invocationId: string;
  issueIds: string[];
  confirmedAt: string;
  bypassedBlockerIssueIds: Record<string, string[]>;
  bypassedUncertainties: Record<string, Array<{ issueId: string | null; code: string }>>;
};

type ForceRefusal =
  | "terminal"
  | "identity-missing"
  | "runtime-ambiguous"
  | "control-inactive"
  | "configuration-missing"
  | "lock-held";
```

## Origin

- source: Solution:70
- producer: grouped user confirmation in `orchestrate` or `spawn`
- consumer(s): `planLinearFrontier`, dispatch authorization
- covers: AC-009, AC-010, AC-011, AC-012

## Invariants

- Authorization exists only in the active invocation.
- Named issues, bypassed blockers, and canonical uncertainty tokens are explicit and sorted.
- Every named issue has both map entries, including empty arrays.
- The forced frontier row is the deterministic preview producer; callers never parse reason text.
- Pre-dispatch Linear refresh invalidates authorization when either fresh scope widens.

## Errors

- Any hard refusal prevents only the named issue.
- A refused prompt creates no durable record.
