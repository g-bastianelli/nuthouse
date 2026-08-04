---
name: state-machine
description: State-machine discipline for TypeScript lifecycle, workflow, reducer, and state-machine files — make illegal states unrepresentable, keep transitions pure and exhaustive, and design for replay and concurrency.
user-invocable: false
paths:
  - "**/*state-machine*.ts"
  - "**/*state-machine*.tsx"
  - "**/*lifecycle*.ts"
  - "**/*workflow*.ts"
  - "**/*reducer*.ts"
---

# subroutine — state-machine discipline

Apply this to lifecycle transitions. The nearest `AGENTS.md` and event contracts
define the vocabulary.

## Model states and events, not boolean combinations

- Give each state variant only valid fields; avoid booleans plus optionals.
- Model events separately and match with `.exhaustive()` so additions fail
  compilation until handled.
- Return a typed error for an illegal transition; never throw it or silently
  retain the old state.

```ts
type JobState =
  | { status: "idle" }
  | { status: "running"; runId: string; startedAt: Date }
  | { status: "failed"; runId: string; reason: string };

type JobEvent =
  | { type: "START"; runId: string; at: Date }
  | { type: "FAIL"; runId: string; reason: string };

function transition(state: JobState, event: JobEvent): Result<JobState, TransitionError> {
  return match(event)
    .with({ type: "START" }, ({ runId, at }) =>
      state.status === "idle"
        ? ok<JobState>({ status: "running", runId, startedAt: at })
        : err<TransitionError>({ code: "INVALID_TRANSITION", from: state.status, event: "START" }),
    )
    .with({ type: "FAIL" }, ({ runId, reason }) =>
      state.status === "running" && state.runId === runId
        ? ok<JobState>({ status: "failed", runId, reason })
        : err<TransitionError>({ code: "INVALID_TRANSITION", from: state.status, event: "FAIL" }),
    )
    .exhaustive();
}
```

## Keep transitions deterministic

- Keep transitions pure: no I/O, clock, UUID, logging, or mutation. Pass generated
  values as explicit inputs and execute effects afterward.
- Define duplicate, stale, and out-of-order behavior. Use stable event IDs or
  aggregate versions when delivery repeats.
- Enforce writes with a transaction or optimistic version at persistence, never
  an in-memory guard.

Test valid/invalid transitions and duplicate/stale behavior. Assert the next
state; test separate effect plans at their boundary.
