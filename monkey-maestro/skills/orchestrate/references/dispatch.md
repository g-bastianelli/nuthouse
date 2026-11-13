# Reserve and dispatch selected issues

Read after a complete live Linear read selects candidates. Each issue's detail/task read,
creation, binding/placement verification, and setup form an independent preparation.
When one is ready, run its serialized reservation/verification/launch immediately while
siblings prepare. Use all-settled semantics to collect outcomes, not to await all
preparations before launching the first worker. Keep each issue's evidence and failure
separate; bound parallel calls by available runtime capacity.

## Contents

- [Create once](#create-once)
- [Reserve started before launch](#reserve-started-before-launch)
- [Render scoped delivery prompts](#render-scoped-delivery-prompts)
- [Launch once](#launch-once)

## Create once

Use the exact `workspaceGroup` from the validated active control under **Workspace groups**
in the shared contract. Pass only that tag, regardless of the supervisor workspace's groups.
An absent or invalid group creates nothing. Render the display name from the exact issue title;
the exact provider task binding carries identity.

After that issue's detail/task preparation, immediately before each create call, dispatch
`MODE: control` for the exact project and resolve its complete marker set with
`scripts/records.mjs resolve-controls`. Require the same active run and revision that authorized
selection, with `deliveryScope: issue-through-merge` and the same valid `workspaceGroup`.
Inactive, unavailable, invalid, or changed control prevents creation from that selection;
report the stop or missing evidence, or reconcile a changed active control before reselecting.
Do not reuse the initial batch control or another issue's pre-create read. This check belongs
to each independent preparation and does not wait for sibling setup.

A stop racing after this read cannot cancel a create already in flight. Preserve any returned
workspace/setup evidence without retrying or deleting it; the reservation rechecks below still
prevent reservation or worker launch once inactive control is observed.

Create without an embedded agent launch:

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
cannot verify tags. Share that listing across already-created, binding-verified siblings
on the same host/project/group under **Workspace groups**; never wait for another creation
or setup to batch it. A missing group follows **Verify the run group** in the supervision
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

Do not replace this with a combined create-and-start command: the installed CLI may reuse
the workspace and still start another agent, and does not wait for setup. Separate calls
preserve the creator, readiness, and unknown-launch boundaries.

## Reserve started before launch

If this source host's notification route is still unverified because no workspace existed
at activation, use the first confirmed new, ready workspace on that host for one bounded source-host probe
through the captured master destination. Apply the notification reference's exact-id
transport cleanup. Require actual master reception before the following reservation; a
queued/written receipt alone is insufficient. If the master must end its turn to receive
it, preserve creator/setup evidence and continue after that probe arrives. A failed route
leaves the issue unreserved and worker unlaunched; it does not justify a separate probe
workspace or a second issue workspace. Keep one pending probe per source host; siblings
on that host wait for its observed reception without starting duplicate probes. Other
already-proven hosts can proceed. Setup/probe waits occur before entering serialization.

For each ready workspace, serialize the following short sequence through the launch
attempt, then release it for the next ready sibling even when an outcome is unknown.
Inspect uncertain transport separately; never let recovery monopolize this sequence:

1. Dispatch one fresh `MODE: reservation` request for the exact issue. It supplies current
   issue/team/status ids, direct blockers, complete membership/statuses, and latest control.
   Require consistent issue membership/status,
   the same active control/run/revision, a currently ready issue, and a free slot counted
   from members alone. Conflicting observations require a fresh read before mutation.
   An issue another actor already started is not this supervisor's newly acquired work.
2. Use that returned exact team/status id; do not reread the issue just to obtain it.
   Resolve the installed `linear-devotee:deliver` skill and read its plugin's
   `shared/issue-lifecycle.md`, **Start authorized work**, for the same started-state policy
   used by direct delivery. List that team's statuses once as needed and require one
   resolved status id under that policy. Within this invocation, reuse the successful
   listing and resolved choice for the same team/policy or existing explicit selection.
   A changed team, invalid status response, contradictory readback, or changed explicit
   choice requires resolution again. Never carry a status cache across invocations.
   Save only the exact issue's status to that id. Existing scope, relations, assignee,
   description, and project are not mutation fields.
3. Dispatch one new `MODE: reservation` request after the write, including an uncertain
   write. Its exact issue/status id is the readback; do not add a duplicate `get_issue`
   or paired selected/members requests. Require the intended status id/type, consistent membership
   and status across reads, same active run/revision, every current direct blocker terminal,
   and `startedCount <= maxConcurrency`. Missing pages, changed relations, or conflicting
   observations require reassessment before launch. A timed-out write followed by the
   intended status still does not prove this supervisor acquired it; retain the uncertain
   reservation for scoped recovery. Unknown writes are inspected, not repeated.
4. If any check fails, do not launch. Preserve the workspace and observed reservation;
   report the concrete recovery need. Do not reset Linear automatically: another actor may
   have relied on the started state.

Separate creation, binding readback, and launch prevent accidental duplicate launches on
reuse. Neither Superset's branch reuse nor Linear status is a distributed task lock. One
supervisor owns a run; racing external writers can still exceed capacity, in which case
stop new launches and report the conflict.

## Render scoped delivery prompts

As each ready workspace passes its reservation checks, start its authorized prompt with
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

Apply **Concurrent siblings** from the shared contract. Include every project member counted
started in the fresh snapshot except this issue, plus all still-selected siblings, even
when their creation/setup remains pending. Mark selected/planned and observed started
separately; call a worker running only with confirmed launch/session evidence. Remove a
definitively failed selection from future prompts. Do not wait for siblings just to render
this context, and do not infer file ownership or sibling requirements.

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
