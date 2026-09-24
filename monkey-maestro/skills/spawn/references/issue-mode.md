# Issue-mode spawn

Issue mode starts from one exact Linear issue identifier. Before dispatch, read
`${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`.

1. Resolve `monkey-maestro:linear-reader` and dispatch `MODE: selected` for the exact issue.
   Require exact project id, title, branch, description, status, blocker ids, and direct blocker
   rows.
2. A completed or canceled issue returns `already-terminal`. A blocked issue or any unknown
   membership, project, status, or blocker fact refuses dispatch. Ready and explicitly named
   started issues may proceed; manual spawn never calculates project capacity.
3. Dispatch `MODE: project` once for the same project solely to build the sibling set. Include
   every issue counted `started` except the spawned issue itself. Discard everything else that read
   returns, including its marker comments. Capacity, readiness, and the control stay outside manual
   spawn. Missing project evidence makes the sibling set unknown but does not itself refuse
   dispatch.
4. Resolve `superset tasks get <issueId> --json` and require its exact Linear issue and project
   binding. Bind the workspace with `--task <taskId>`. Render the workspace name from the uppercase
   issue identifier and the title; the name is never its identity.
5. The worker prompt starts with `linear-devotee:greet <issueId>` and preserves title, branch, and
   description verbatim. Extract scope, Acceptance, and checks only when the description states
   them; otherwise use `not specified in Linear` and never infer the missing content. Apply
   **Concurrent siblings** from the shared contract to the proven sibling identifiers.
6. For an unknown launch outcome, direct the user to read-only
   `monkey-maestro:reconcile <projectId> <issueId>`.
