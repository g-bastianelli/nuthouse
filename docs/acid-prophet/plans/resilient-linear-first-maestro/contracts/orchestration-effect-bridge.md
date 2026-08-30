# contract: orchestration-effect-bridge

## Shape

```ts
type EffectRequest = {
  effectId: `sha256:${string}`;
  invocationId: string; // fresh UUID v4
  adapter: string;
  input: unknown;
  occurrence: number;
};

type TranscriptEntry =
  | { effectId: string; status: "fulfilled"; value: unknown }
  | {
      effectId: string;
      status: "rejected";
      error: { code: string; message: string; ambiguous?: boolean };
    };

type BridgeInput = {
  schemaVersion: 1;
  request: {
    invocationId: string;
    frontierPlan: LinearFrontierPlan;
    runtimePlan: RuntimeActionPlan;
    control: MaestroControlV2;
    selectedIssueIds: string[];
    lockDirectory: string;
    dispatchContextByIssueId: Record<
      string,
      { branchName: string; workspaceName: string; workerPrompt: string }
    >;
  };
  transcript: TranscriptEntry[];
};

type BridgeResult =
  | { schemaVersion: 1; state: "needs-effects"; effects: EffectRequest[] }
  | { schemaVersion: 1; state: "complete"; result: unknown };
```

The CLI writes this `BridgeResult` directly at top level on success. It does not wrap it
in `ok` or `epoch`. On failure it exits nonzero with `{ "ok": false, "error": ... }`.

## Origin

- source: Architecture and Execution lifecycle
- producer: `scripts/orchestration-epoch.mjs`
- consumer(s): `orchestrate`, `spawn`
- covers: AC-012, AC-015, AC-016, AC-017, AC-018, AC-025, AC-026, AC-028

## Invariants

- Each public invocation mints a fresh UUID v4; effect ids bind that id, adapter, exact input, and occurrence.
- Only an internal class branded by a module-private symbol may request an effect.
- Returned effects are recomputed and schema-checked before publication.
- Responses are accepted only for effects requested in the same invocation; duplicate, unused, forged, and cross-invocation entries are rejected.
- Independent effects emitted together may execute in parallel; issue mutations remain all-settled.
- Under-lock force reauthorization validates the candidate and live direct blockers without interpreting omitted transitive blocker subgraphs as newly missing data.
- Workspace-only post-mutation recovery is preserved for reuse but completes as degraded because no worker is active or monitorable.
- A final `state: complete` result is the only reportable authorization result.

## Errors

- A malformed or extra transcript entry rejects the invocation.
- A rejected response may carry only code, message, and an optional ambiguity bit; it cannot inject an effect payload.
- A provider failure stays scoped to its effect/issue unless it invalidates the shared lock or control boundary.
