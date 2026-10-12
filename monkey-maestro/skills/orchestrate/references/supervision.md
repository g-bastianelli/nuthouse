# Observe and continue issue delivery

Read for a specific worker event, an uncertain launch, or an explicit supervisor resume. Superset transports sessions; its task, terminal, and workspace counts never
replace Linear scheduling state.

## Contents

- [Observe the exact session](#observe-the-exact-session)
- [Verify the run group](#verify-the-run-group)
- [Continue in place](#continue-in-place)
- [Checkpoint locally](#checkpoint-locally)
- [Recover without a second worker](#recover-without-a-second-worker)

## Observe the exact session

Keep a compact in-session map of issue, host, Superset project, workspace, terminal id, provider session id,
PR, notification destination, last accepted event id, latest observed step, question, and
next action. Retain a compact set of processed event ids for this run; an event receipt
does not establish completed work. Retain exact creation-returned setup
terminal ids and the corresponding no-agent creation evidence when setup shells remain;
refresh their output and readiness after resume, never reconstruct ownership from labels.
Use **Checkpoint locally** only when compaction would lose needed context. Refresh
supervisor ownership from the shared contract on a cross-session handoff; a ledger names
an owner but does not elect one.

Use the exact terminal returned by launch:

```text
superset terminals read --workspace <workspaceId> --host <hostId> \
  --terminal <terminalId> --max-lines 240 --json
```

If the visible screen omits findings, questions, or completion evidence, read the durable
provider transcript:

```text
superset agents read --workspace <workspaceId> --host <hostId> \
  --terminal <terminalId> --json
```

Check that the transcript belongs to the lead's assigned issue conversation. During a
nested native review, `agents read` can return the review transcript even with the retained
lead terminal id. If the content belongs to that review or another session, fall back to
`terminals read` on the retained lead terminal for progress. A nested review report is not
the lead's delivery handoff. Keep the previously confirmed lead provider session id when
known; never replace it or change the follow-up recipient based on transcript recency.
Do not invent a provider-session selector. If lead evidence remains unavailable, report
that observation limit rather than infer completion or a new session binding.

After lost context or service restart, rediscover terminals for the exact task-bound
workspace, then correlate saved bindings and transcript. Terminal names, idle prompts,
attached state, and absence from the live list do not identify a completed issue. Unknown
or conflicting identity stops follow-up and recovery until resolved.
On resume, also verify the persisted run group using **Verify the run group** below.

Read only the affected session when an event needs transcript evidence, an action is
uncertain, or explicit recovery requires it. A validated completion event with fresh PR
and Linear evidence need not trigger a terminal read. Settle independent inspections
separately and retry a failed read at most twice for this observation. Report persistent
host/CLI failures; healthy sibling events remain actionable. End the turn while idle,
with no periodic reads, sleeps, model updates, or implicit service restart.

## Verify the run group

Read placement for every run-owned workspace on resume, and when dispatch readback lacks
the group. Use the current control's exact `workspaceGroup`; a different conversation,
caller folder, project name, or date never supplies a replacement. Correlate the exact
workspace id from
`superset workspaces list --host <workspaceHostId> --project <workspaceProjectId> --tag '<workspaceGroup>' --json` with
the task and branch returned by `superset workspaces get <workspaceId> --host <workspaceHostId> --json`.
Use that workspace's retained and verified host/project; a later transport override
applies only to new dispatch. If the prior binding is unknown, inspect exact workspace
evidence read-only until resolved. Do not list against the new default target or retag as
if the existing workspace had moved. Require the exact workspace id in the complete
successful tag-filtered result. Do not split the displayed `tags` or match substrings:
native exact tag filtering is the membership evidence. Unavailable or malformed evidence
blocks repair and any dependent new launch. Healthy existing workers and their scoped
supervision continue independently of a placement problem.

Ownership requires retained confirmed-creator evidence for this exact run/workspace or
the established prior worker/session evidence tying that workspace to this project/run.
Refresh the exact binding and inspect existing sessions as above. A matching branch, task,
tag, display name, or copied checkpoint alone proves no run ownership. An unknown,
foreign, or concurrently reused workspace receives read-only inspection; do not add the
group, adopt it, or launch another worker. A confirmed owned workspace keeps every other
group, including groups added since creation.

If this run's group is absent on a proven owned workspace, repair only under the same
current active control and established supervisor ownership:

1. Confirm the group is still absent with the exact native tag filter; if present, do
   nothing. Refresh the complete **unfiltered** host/project workspace listing immediately
   before mutation and recheck the exact workspace's binding/ownership. An empty `tags`
   string proves zero tags; a nonempty string with no comma proves one tag, retained
   intact. A comma-containing string could mean one embedded-comma tag or several tags.
   Report `exact tag set unavailable` and leave it unchanged; even ordinary multiple
   tags cannot safely be reconstructed from this display. Missing or malformed values
   also permit no update. Use no invented command, helper, or SDK to obtain the set.
2. For that unambiguous zero/one-tag set, form `tagArgs` from the retained tag, if any,
   plus the exact run group, each safely quoted as a separate `--tag` argument. Update
   only that workspace:

   ```text
   superset workspaces update <workspaceId> --host <workspaceHostId> <tagArgs> --json
   ```

   This command replaces the entire tag set; passing only the missing group would erase
   the other groups. Do not change a name, task, branch, or any other field.

3. Read the same host/project listing filtered by the run group and require the exact
   workspace id. If one prior tag was retained, also verify that id with a separate
   native `--tag '<retainedTag>'` listing. Correlate the current task/branch readback.
   Report verified placement only after those reads succeed. On timeout or uncertain
   update, inspect exact membership before deciding whether another attempt is needed;
   never retry with a stale or reconstructed tag set.

An inactive or unusable control permits no repair. Group repair neither claims an issue
nor changes readiness or capacity, and never targets the supervisor workspace.

## Continue in place

Inspect the result and surrounding transcript, not just its marker:

- `waiting`: preserve the workspace/PR and the exact pending condition. A worker-owned
  bounded PR observation supplies its own completion signal; retain its native handle or
  operation id, and do not send a timer-based follow-up. A missing/failed wait or callback
  is manual recovery, not a promise that the master will wake it later. An observation
  timeout alone does not prove the existing operation ended or permit a second one.
- `blocked` or `question`: resolve routine technical details within authority. Relay a real product
  question, contradiction, required human approval, or persistent failure with issue id,
  concrete options, and consequence. Native question-tool arguments may be absent from
  `agents read`; use the worker's preceding ordinary-prose question/options. If the terminal
  reports a pending question without that text, do not invent its content or blindly send
  input: obtain the missing question through the existing worker's normal dialogue when
  available, or report unavailable question content. Keep unrelated issues moving.
- `done`: require the exact issue/workspace, observed merged PR evidence, and completed
  Linear readback. Refresh the live project before capacity or dependencies advance. If
  the merge succeeded but Linear did not update, ask the same worker to reconcile only the
  missing status step.

When workers report possible interference, apply **Shared verification resources** from
the shared contract. Coordinate only the conflicting verification segment through existing
sessions, retaining its observed owner and handback condition in conversation. Resolve
the handoff without a user question when facts and authority suffice; otherwise report
the specific missing fact or permission. Linear dependencies and capacity stay unchanged.

Before sending input, distinguish an ordinary task question from a tool authorization or
permission dialog. Never auto-answer a permission prompt, select an approval option, or
change the worker's permission settings. Report the exact requested action/access for the
user to handle through the native approval surface; the affected worker remains waiting
while independent work continues. The delivery scope is not an answer to a permission UI.

Send an ordinary task answer or scoped follow-up only after evidence that the identified
provider is awaiting that kind of input. Unknown prompt types require inspection, not a
blind reply. Do not type into an unknown shell, interrupt active work, or resend an
unchanged instruction without a new actionable fact:

```text
superset terminals send --workspace <workspaceId> --host <hostId> \
  --terminal <terminalId> --text '<scoped answer or next missing step>' --json
```

The terminal command is only a scoped dialogue fallback for a verified ordinary input
prompt, never the event channel and never a way to submit an approval. The master Claude
session's inbound opt-in does not change a worker's settings. If a native message to a
Claude worker is held, report its native message-approval UI and keep the worker waiting;
do not relax its settings or treat the master's acceptance as inherited.

Retain the question and last answer sent so retries do not duplicate replies. If sending
times out, inspect output before resending; transport failure can occur after delivery.
Do not send new instructions under an inactive control. Already-authorized issue workers
keep their original scope until explicitly stopped by the user.

## Checkpoint locally

Keep the small ledger at `.nuthouse/<project-id>/progress.md` only when needed for recovery.
Before its first write, run `git check-ignore -v -- .nuthouse/<project-id>/progress.md`.
If it is not ignored, resolve the repository's local exclusion file with
`git rev-parse --path-format=absolute --git-path info/exclude`. Read that file, preserve
all existing content, and append only the missing `/.nuthouse/` pattern on its own line.
Do not replace the file or change tracked `.gitignore` for this disposable checkpoint.
Repeat `git check-ignore` and require it to succeed before writing the ledger. If exclusion
cannot be established, keep the checkpoint in conversation and report the local limitation.

The first line names the subject: `# ledger — maestro: <project-id>`. Record the authorized
project/run/revision/scope and exact workspace group, actual supervisor identity or known continuity,
the verified master notification destination and helper paths, processed event ids,
each issue's host/Superset project/workspace/session and PR bindings, setup provenance
when needed, and one line per completed step. Include
unresolved questions, any last answer sent, pending wait operation/handle, observed
evidence, and the next missing action.
Do not save credentials or treat this disposable note as scheduling or mutation authority.
On explicit resume, refresh live control, Linear state, group placement, and session
evidence before continuing. A same-session compaction retains its destination only after
confirming that exact provider identity and route still apply. A different supervisor
requires an ownership handoff and a newly proved destination; update existing leads with
that scoped context only when their identified runtime can accept it, then confirm it.
Until confirmed, do not claim their future events will reach the new master. The live
control supplies the group; the ledger never regenerates it.

## Recover without a second worker

An uncertain launch must first be correlated by exact workspace and transcript. An empty
terminal list immediately after a timeout is not proof of refusal: a delayed create can
still arrive. Preserve the workspace and checkpoint instead of issuing another launch.

For a confirmed terminated provider session, preserve its workspace and PR. After fresh
Linear/control checks and proof no other live or uncertain worker exists, use its actual
provider id with `superset agents create --resume-session <providerSessionId>`, the same
workspace/host/agent, and a scoped continuation prompt. Never pass a terminal id as a
provider session id, and do not fork to simulate resume. If the installed agent does not
support resume or the id is unavailable, use `monkey-maestro:spawn` only after a confirmed
failed/ended launch and a fresh exact workspace inspection; a replacement worker must
reconstruct current issue/Git/PR facts before editing.

Recovery inherits only the original authorized issue scope. It is not authority to revive
unrelated started work. When no progress is possible without external input, checkpoint
the bindings, pending conditions, and precise resume command. Explicit project automation
may wake a supervisor later; this session itself does not schedule a background wake-up.
