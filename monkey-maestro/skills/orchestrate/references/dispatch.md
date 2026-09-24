# Bounded Superset dispatch

Read this only after the Linear capacity calculation and selected-issue refresh have
produced the final issue set for the current pass.

## Create or reuse workspaces

Resolve the invoking workspace's groups using **Workspace groups** in the shared contract.
If placement is unresolved, report `degraded` without creating workspaces.

Render the workspace name from the uppercase issue identifier and the title returned by the
selected-issue read, following **Workspace identities**. The name is a display label and
`--task` carries the identity. Attempt exactly one branch-scoped create-or-reuse per issue,
without an embedded agent launch, with sibling attempts settled independently:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --name '<workspaceName>' \
  <tagArgs> \
  --json
```

Require the response to distinguish `created` from `reused` and return one exact
task-bound workspace id. Launch only after an explicit `created` result. A reused or
ambiguous result never launches an agent; report `already-existing` and the confirmed
recovery command `monkey-maestro:spawn <issueId>`. Workspace creation is the atomic
duplicate guard across concurrent orchestration invocations.

## Render the worker prompt after creation settles

Once every workspace attempt of the pass has settled, render the complete worker prompt for each
explicitly created workspace; only then is its sibling set knowable.

Start with `linear-devotee:greet <issueId>`. Preserve the selected issue's title, branch,
and description verbatim. Extract scope, acceptance criteria, and required checks only
when the description states them; otherwise label each missing section
`not specified in Linear`. Include the shared contract's ownership and handoff rules. The
worker must not merge, push, change dependencies, or infer Linear completion.

Apply **Concurrent siblings** from the shared contract. The set is exactly:

- every issue counted started in step 3, by identifier only;
- every other issue of this pass whose workspace returned explicit `created`, by identifier
  and title.

An issue whose workspace was reused or whose creation failed receives no worker and never
appears in a sibling list. A pass that fills the last free slot still renders the started
issues it dispatched into.

## Launch and classify

For each explicitly created workspace, attempt one launch:

```text
superset agents create \
  --workspace <workspaceId> \
  --host <targetHostId> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

Report dispatched only when the agent command confirms success. An explicit launch refusal
is `launch-failed`: preserve the workspace, do not retry, and report
`monkey-maestro:spawn <issueId>` as recovery. A transport error or malformed response is
`launch-unknown`; do not recommend immediate relaunch, and report
`monkey-maestro:reconcile <projectId> <issueId>` instead.
