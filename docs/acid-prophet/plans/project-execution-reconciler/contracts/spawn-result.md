# contract: spawn result

## Shape

```ts
type SpawnRequest = {
  schemaVersion: 1;
  issueId: string;
  authorization:
    | {
        kind: "project";
        projectId: string;
        runId: string;
        revision: number;
        decisionHash: `sha256:${string}`;
        lockToken: string;
      }
    | { kind: "manual" };
};

type SpawnResult = {
  outcome: "verified" | "partial" | "existing" | "ambiguous" | "failed" | "degraded";
  workspaceId?: string;
  terminalId?: string;
  taskId: string;
  linearRecorded: boolean;
  detail?: string;
};
```

## Origin

- source: Architecture / Spawn lifecycle:135
- producer: `monkey-maestro:spawn`
- consumer(s): `monkey-maestro:reconcile`, standalone user workflow
- covers: AC-034, AC-035, AC-036, AC-037, AC-038, AC-039, AC-040, AC-041, AC-045, AC-046, AC-050

## Invariants

- Project authorization exactly matches the active control revision/hash and held lock token; otherwise explicit manual approval is required, enforced by the skill mutation gate.
- Workspace creation always carries the internal Superset `task.id` whose exact Linear `externalKey` equals `issueId`; enforced by task lookup and post-create inspection.
- Agent creation occurs only after one exact workspace is verified; enforced by the ordered workflow.
- Spawn never changes Linear status; enforced by static ownership tests.

## Errors

- `SPAWN_UNAUTHORIZED` prevents all Superset writes.
- `WORKSPACE_AMBIGUOUS` blocks agent launch and reports all matches.
- `AGENT_LAUNCH_FAILED` returns `partial` without deleting or recreating the workspace.
- `LINEAR_RECORD_FAILED` returns a verified runtime with degraded traceability.
