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
4. Resolve the task with explicit `--tracker linear` using **Exact tracker binding** from
   the shared contract. Require its exact Linear issue and project binding. Set
   `bindingArgs = --task <rawLinearIssueUuid> --branch '<verifiedLinearBranch>'
--skip-branch-prefix --base-branch '<verifiedBaseBranch>'`. Resolve the base from
   repository instructions, not an assumed `main`; the explicit branch avoids depending
   on the host's different provider-task lookup. Render the workspace name from the uppercase
   issue identifier and the title; the name is never its identity.
5. Full delivery starts with `linear-devotee:deliver <issueId>` and the exact caller scope,
   issue/project/workspace, and control run/revision when supplied by a supervisor. Limited
   draft-PR delivery starts with `linear-devotee:greet <issueId>` and explicitly excludes
   merge/completed status authority. Preserve title, branch, and description verbatim.
   Extract scope, Acceptance, and checks only when the description states
   them; otherwise use `not specified in Linear` and never infer the missing content. Apply
   **Concurrent siblings** and **Worker boundary** from the shared contract to the proven
   sibling identifiers. Full delivery uses its done/waiting/blocked envelope. Started
   recovery continues the existing workspace/PR and does not repeat a status transition.
   Preserve supplied master destination, notification helper path, lead source binding,
   and worker-owned wait/continuation context. A recovered lead must confirm a changed
   destination before future delivery is represented as automatic; never silently reuse
   a closed or former master's address. No supervisory caller means no master notifications.
6. For an unknown launch outcome, direct the user to read-only
   `monkey-maestro:reconcile <projectId> <issueId>`.
