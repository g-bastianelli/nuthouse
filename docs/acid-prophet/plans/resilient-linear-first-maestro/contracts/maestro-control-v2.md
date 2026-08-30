# contract: maestro-control-v2

## Shape

```ts
type MaestroControlV2 = {
  schemaVersion: 2;
  projectId: string;
  runId: string;
  active: boolean;
  targetHostId: string;
  supersetProjectId: string;
  defaultAgent: string;
  maxConcurrency: number;
  revision: number;
  updatedAt: string;
};
```

## Origin

- source: Architecture:105
- producer: `start`, `stop`, record serializer
- consumer(s): `status`, `orchestrate`, `spawn`
- covers: AC-021, AC-022, AC-023, AC-027

## Invariants

- No graph, hash, waiver, or runtime ownership field is scheduler authority.
- Revision remains a positive monotonic integer.
- v1 readers project only operational fields.
- Control resolution reports `sourceSchemaVersion` beside the projected control so `start` can migrate an active v1 record without polluting control v2.
- `start` skips a write only for an active source-v2 control with no explicit override; migration and explicit configuration updates use the normal preview and verified successor write.

## Errors

- Missing active or transport fields surfaces as unusable control.
- Malformed obsolete v1 fields are warnings, never parser failures.
