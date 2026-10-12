# Reserve and dispatch selected issues

Read after a complete live Linear read and selected-issue refresh establish the next batch.

## Contents

- [Create once](#create-once)
- [Reserve started before launch](#reserve-started-before-launch)
- [Render scoped delivery prompts](#render-scoped-delivery-prompts)
- [Launch once](#launch-once)

## Create once

Use the exact `workspaceGroup` from the validated active control under **Workspace groups**
in the shared contract. Pass only that tag, regardless of the supervisor workspace's groups.
An absent or invalid group creates nothing. Render the display name from the exact issue title;
the exact provider task binding carries identity. Settle independent attempts with
all-settled semantics, without embedding an agent launch:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --branch '<verifiedLinearBranch>' \
  --skip-branch-prefix \
  --base-branch '<verifiedBaseBranch>' \
  --name '<workspaceName>' \
  --tag '<workspaceGroup>' \
  --json
```

Shell-quote the group as data with the same embedded-apostrophe escaping as the display
name. Require an exact workspace id, explicit `alreadyExists: false` versus `true`, and
branch/task association readback from `superset workspaces get`. For a confirmed new
workspace, also read
`superset workspaces list --host <targetHostId> --project <supersetProjectId> --tag '<workspaceGroup>' --json`
and require that exact workspace id in the successful complete result. This native
filter proves exact tag membership; the displayed comma-separated `tags` cannot. `get`
cannot verify tags. A missing group follows **Verify the run group** in the supervision
reference before reservation; absent or malformed readback never counts as placement.
The installed CLI reuses by project and resolved branch, not a unique
task lock; task id alone is not proof that this issue owns the returned workspace. Use the
raw Linear UUID and explicit verified branch as **Exact tracker binding** specifies;
do not depend on the host inferring a provider task's branch.
Only a confirmed creator with the expected binding, verified group, and established **Workspace setup**
readiness enters reservation. Retain setup terminal ids from this creation response and
inspect their command output; a setup shell that remains live after completion is not an
existing worker. Failed setup requires a reported readiness assessment before continuing.
A reused workspace may contain a prior worker
or PR: inspect its existing owner/session through the supervision reference, never launch a new
worker or retag it merely because reuse succeeded. Neither the run tag nor a matching
branch grants ownership. Ambiguous creation receives observation only.

## Reserve started before launch

If this source host's notification route is still unverified because no workspace existed
at activation, use the newly created and ready workspace for one bounded source-host probe
through the captured master destination. Apply the notification reference's exact-id
transport cleanup. Require actual master reception before the following reservation; a
queued/written receipt alone is insufficient. If the master must end its turn to receive
it, preserve creator/setup evidence and continue after that probe arrives. A failed route
leaves the issue unreserved and worker unlaunched; it does not justify a separate probe
workspace or a second issue workspace.

For each created workspace, sequentially:

1. Refresh the exact issue and direct blockers through `MODE: selected`, then refresh
   control and the complete project. Require the same active control/run/revision, a
   currently ready issue, and a free slot. An issue that another actor already started is
   not this supervisor's newly acquired work.
2. Read that exact issue's team/status id and its team's statuses with the available Linear
   read tools. Require one resolved started status id. If several team started statuses are
   plausible, collect that missing choice; never guess by display name.
   Save only the exact issue's status to that id. Existing scope, relations, assignee,
   description, and project are not mutation fields.
3. Read back the exact issue and refresh the complete project/control. Require the intended
   status id/type, same membership and active run/revision, all blockers terminal, and
   `startedCount <= maxConcurrency`. Unknown write results are inspected, not written again.
4. If any check fails, do not launch. Preserve the workspace and observed reservation;
   report the concrete recovery need. Do not reset Linear automatically: another actor may
   have relied on the started state.

Separate creation, binding readback, and launch prevent accidental duplicate launches on
reuse. Neither Superset's branch reuse nor Linear status is a distributed task lock. One
supervisor owns a run; racing external writers can still exceed capacity, in which case
stop new launches and report the conflict.

## Render scoped delivery prompts

After workspace attempts settle, start every authorized prompt with
`linear-devotee:deliver <issueId>`. Include exact project/run/control revision, issue,
workspace, and `deliveryScope: issue-through-merge`. Preserve selected title, branch, and
description verbatim. Extract Acceptance and checks only from explicit source sections;
missing information is `not specified in Linear`, not invented requirements.

Apply **Worker boundary** and the result envelope from the shared contract. The scope
authorizes started/completed, implementation and verification, commits/pushes/draft PR,
native review, corrections and justified review replies/resolution, then protected merge.
Include the verified master destination, absolute installed notification helper path on the
worker, and expected host/workspace/provider. The lead captures its own actual provider
session id before its first event; retain that same identity at the supervisor from launch
or correlated transcript evidence. A claimed source field alone cannot establish it.
Pass this context through `deliver` to its PR waiting handoff. Require each Codex lead to
capture and prove its own local self-completion route after launch, before its first
automatic wait, as described in the notification reference. Workers emit semantic events and own bounded waits; they
must not rely on periodic prompts from the master.
The issue is already reserved as started; continue idempotently. Resume prior PR/work and
ask only about consequential unresolved choices. Optional specialists receive bounded
responsibility; the issue lead owns integration and native review.

Apply **Concurrent siblings** from the shared contract. Include every issue counted started
in the fresh snapshot except this issue, plus other explicitly created batch workspaces
whose issue remains selected. Do not infer file ownership or sibling requirements.

## Launch once

Immediately before launch, inspect the exact workspace's terminals. An unreadable or
ambiguous listing prevents launch. Apply **Workspace setup** to identify only this
confirmed creator's setup terminals and verify readiness; any foreign, agent, or unknown
live session still prevents launch. Do not delete setup shells to manufacture an empty
listing. With readiness and ownership established, call once:

```text
superset agents create \
  --workspace <workspaceId> \
  --host <targetHostId> \
  --agent <defaultAgent> \
  --prompt <workerPrompt> \
  --json
```

Pass the prompt as safely quoted data, never executable shell interpolation. Require
`kind: terminal` and retain `sessionId` as the terminal id. Also retain the provider session
id once exposed; it is a different identity used for resume. A `kind: chat` result cannot
use terminal read/send: report unsupported transport, preserve it, and do not start a
second agent.

An explicit refusal is `launch-failed`. Preserve the reserved slot/workspace; after fixing
the cause, scoped `spawn` can recover it. Transport errors or malformed success are
`launch-unknown`; inspect terminals and provider transcript before any recovery. Neither
case clears started state or silently replaces the selected issue with another.
