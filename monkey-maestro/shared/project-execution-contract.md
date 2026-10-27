# Linear-first project execution contract

This contract is shared by every public Monkey Maestro skill.

Read **Authority**, **Delivery control**, **Supervisor role**, and **Mutation boundary** for every invocation.
For dispatch, also read **Workspace identities**, **Exact tracker binding**, **Workspace
groups**, **Workspace setup**, and **Worker boundary**. Project supervisors use **Project orchestration**;
manual launches use **Manual spawn**. Status and stop do not need transport procedures.

## Authority

For Linear-backed work, Linear is the sole scheduling authority. Superset only transports
selected work. A manual quick fix has no scheduling state and never pretends to be a
Linear issue.

- `completed` and `canceled` are terminal.
- Every `started` issue counts against `maxConcurrency`, whether or not a workspace or
  terminal exists.
- `backlog`, `triage`, and `unstarted` issues are candidates.
- A candidate is ready only when every identifier in its current `blockedBy` relation is
  present in the same live project read and terminal.
- Unknown issue, status, membership, or blocker facts never become ready facts.

For project orchestration:

```text
slots = max(0, maxConcurrency - startedIssueCount)
selected = first slots ready issues, sorted by issue identifier
```

Started issues reserve capacity. Existing workers notify and resume in place, never
redispatched merely because their issue is started. Superset workspace or terminal counts
never change this calculation, and a blocked worker keeps its Linear slot.

## Workspace identities

Issue-backed orchestration and manual issue spawn use the same identity: the Superset
`--task <taskId>` binding. The workspace name is a display label only — Superset stores it
verbatim, enforces no character rules, and derives no worktree path from it — so it is
never a matching key. Build it by joining the uppercase Linear issue identifier, a spaced
em dash, and the issue title exactly as Linear returned it, then truncate to 100
characters and trim trailing whitespace:
`NOT-613 — Corriger le retry et le redéploiement à froid des ZIP`. Fall back to the bare
uppercase identifier when the title is empty or unknown. A later retitle changes the label
and nothing else.

A title is free-form text, so pass the name as one single-quoted `--name` argument with
every embedded `'` replaced by `'\''`. Unquoted, a name silently truncates at its first
space and the shell expands any `$`, backtick, or quote the title carries.

For a quick fix, normalize the exact objective by trimming it and replacing every
whitespace run with one ASCII space. Build its readable slug by lowercasing, applying
Unicode NFKD, removing combining marks, replacing every run outside `a-z0-9` with one
hyphen, trimming hyphens, taking the first 48 characters, and trimming a final hyphen
again. Use `quick-fix` if empty. Calculate the first eight hexadecimal characters of
SHA-256 over the normalized objective. Name the branch `quick/<slug>-<digest>` and the
workspace `quick-<slug>-<digest>`. Bind it with `--branch <branchName>` and
`--skip-branch-prefix`; the stored branch must remain exactly the derived identity used by
recovery matching. A quick fix has no task to bind, so unlike issue mode its name is part
of that identity and is not free to read well.

## Exact tracker binding

Resolve Linear-backed tasks explicitly with
`superset tasks get <issueId> --tracker linear --json`. The CLI's default tracker can be
Superset, so an unqualified `Task not found` does not prove the Linear issue is unavailable.
If direct lookup is unsupported, use `tasks list --tracker linear --status all` with a
title search and pagination, then require the exact Linear identifier and issue UUID;
fuzzy title hits are not bindings. Cross-check project and branch against the selected
Linear details. Never create a second task or change the organization's tracker setting
to make lookup work.

For issue creation, pass the raw Linear issue UUID as `--task`, the exact branch verified
from Linear as `--branch`, and `--skip-branch-prefix`. Also pass `--base-branch` with the
repository's verified target base. Do not assume that omitting `--branch` resolves a Linear
task's branch: the host can use a different task API for that lookup. Do not add a provider
prefix to the UUID or invent a branch. Read back the workspace using
`superset workspaces get <workspaceId> --host <hostId> --json` and require the exact
`taskId` and branch before proceeding. A missing or mismatched binding is a transport blocker.

## Workspace groups

Superset sidebar groups are workspace tags. Passing `--tag <tag>` during creation places
the workspace in that group; there is no separate folder-creation step. Tags are
presentation only: they never select issues, establish readiness, identify a workspace,
or prove ownership. Superset trims and lowercases tags, with a 64 UTF-16-code-unit limit
per tag and at most 32 tags per workspace. Never change the supervisor workspace's groups.

### Project runs

Each project run has one `workspaceGroup` in its validated Linear control. Use that exact
stored tag for every new issue workspace in the run, with a single shell-quoted
`--tag <workspaceGroup>` argument. Do not add the invoking workspace's tags. The group
survives continued dispatch, compaction, a cross-conversation handoff, project renaming,
date changes, runtime/transport changes, and stop. None of those events regenerates it.
A fresh activation after an inactive control creates a new run and a different group.

Verify placement with
`superset workspaces list --host <workspaceHostId> --project <workspaceProjectId> --tag '<workspaceGroup>' --json`
on that workspace's retained and verified host/project. Current control targets apply to
new dispatch only. A transport override does not relocate an existing workspace; an
unknown prior binding requires read-only discovery, never substitution of the new target.
Correlate the exact workspace id with the task and branch verified by `workspaces get`;
`get` does not expose tags. The native `--tag` filter checks exact normalized tag
membership before formatting. Its complete successful result must contain the exact
workspace id. Never infer membership by splitting or searching the displayed `tags`:
Superset permits commas inside tags, so one tag `design, review` and two tags `design`
and `review` have the same display. Show the stored run group in previews and reports.

On resume, verify placement for workspaces already proven owned by this run. A missing
group may be restored only after the supervision reference's ownership checks, with a
fresh unfiltered listing before the update and exact-membership readback afterward.
`workspaces update --tag` replaces the whole tag set. Repair from the listing only when
`tags` is empty or contains no comma, proving zero or one current tag to preserve before
adding the run group. A comma-containing display makes the exact tag set unavailable;
leave it untouched and report unresolved placement. Do not invent a structured tag read.
An ambiguous update requires observation before another attempt. Placement failure blocks
a new launch, while healthy existing workers and their supervision continue. Do not
retag, claim, or adopt foreign, unknown, or concurrently reused workspaces based on a tag
or branch match.

### Manual spawn

New manual workspaces inherit the invoking workspace's sidebar groups. Manual `spawn`
never reads or creates a project control or allocates a run group. A recovered workspace
keeps all its existing groups, including a group from an earlier orchestration run.

Before creating workspaces, read `superset workspaces list --local --json` once. Resolve
the source by exact `SUPERSET_WORKSPACE_ID` when set; otherwise use the unique workspace
whose `worktreePath` most specifically contains the current directory (compare complete
path segments). Read the source on the local host, even when dispatch targets another
host or project. Never select the source by the destination project, issue, branch, or
display name. `workspaces get` does not expose tags in the current CLI.

The listing's `tags` field is a comma-separated string: split on commas, trim each entry,
and discard empty entries. Preserve the stored values and spaces within each tag. Set
`tagArgs` to one separately shell-quoted `--tag <tag>` pair per distinct tag, or no
arguments when the source has an empty tag string. For example, `lot 2` becomes
`--tag 'lot 2'`. Inherit all tags when the source belongs to several groups.

A successful listing with no enclosing workspace and no Superset workspace environment
or worktree path means this invocation is outside Superset: use no tags. An unreadable
listing, missing declared source, ambiguous path match, or missing/malformed `tags` is
unresolved placement; report it before creation instead of silently spawning at root.

Resolve this once per manual invocation. Reused or recovered workspaces keep their
existing groups; do not retag them or filter duplicate/recovery matches by tags. Include
inherited groups (or root) in creation previews and reports, and show existing placement
when recovering a workspace.

## Workspace setup

A successful workspace creation can itself return `terminals` for setup and `agents: []`
even when no agent or command was requested. Retain the exact terminal ids from that
creator response. A setup shell may remain `exited: false` after its command ends; the
shell's lifetime is not setup completion or evidence of an existing agent.

Before reserving or launching, inspect those exact setup terminals with
`superset terminals read --workspace <workspaceId> --host <hostId> --terminal <terminalId>
--max-lines 240 --json`. Correlate the expected setup command and its completion/output
with the repository instructions and actual prerequisites. A terminal is exempt from the
existing-worker guard only when its id came from this confirmed creation without an
embedded agent/command, setup readiness is established, and current output shows no
subsequent agent activity. Never exempt a foreign or unknown session based on its title,
an idle prompt, or a guessed role. Preserve creator evidence across a checkpoint if needed.

If setup is still running, use the runtime's native wait/yield for that exact pending
operation. Without a native handle, permit at most two setup-only inspections separated
by one `sleep 15` each, then report setup pending with its exact resume inspection.
This bounded startup check is not a worker-supervision timer and never repeats after
launch. Keep each wait under 60 seconds and remain responsive to user input. If setup failed, report the failing command and
resolve actual repository readiness before launch. For example, a stale setup step may
copy a `.env` that the repository explicitly does not use; that failure is not evidence
that required dependencies failed to install. Verify the relevant prerequisites and
report what is ready or still missing. Do not silently modify project settings, rerun
the entire setup, start a second setup, or delete/close its shell. Unresolved readiness
keeps the worker unlaunched.

## Linear retrieval boundary

Linear-backed public skills never hydrate a whole Linear project into their main context.
They dispatch the read-only `monkey-maestro:linear-reader` and consume only its marker
comments, status types, blocker identifiers, and scoped unknowns. Full descriptions are
returned only for exact selected issue ids when rendering worker prompts. The reader
never decides readiness, capacity, or runtime actions. Quick-fix spawn does not dispatch
the reader at all.

## Delivery control

The latest usable Linear project control contains only:

```text
schemaVersion: 3
projectId
runId
workspaceGroup
active
deliveryScope: issue-through-merge
targetHostId
supersetProjectId
defaultAgent
maxConcurrency
revision
updatedAt
```

The three selectors and `workspaceGroup` are non-empty strings. A workspace group is one
canonical lowercase tag, at most 64 UTF-16 code units, without commas or control characters.
Its stored value is immutable within
the same run: successor controls, including stop, preserve it byte-for-byte. A new run
requires an explicit different group. `maxConcurrency` defaults to four and must be
between one and ten. Use the existing `scripts/records.mjs` control parser: pass
`{ projectId, comments }` to `resolve-controls`, and use `build-control` for successors.
Historical controls remain append-only and are never deleted automatically. Only a valid
schema-v3 record with the explicit delivery scope grants project delivery authority. An
unsupported, malformed, or ambiguous control, including a missing or invalid group, grants none: explain the observed failure and
use `start` for explicit activation, never infer permission from dispatch history.

An inactive control prevents future project dispatch. It does not govern manual `spawn`.
`stop` never touches existing Superset work.

## Start discovery and approval

Resolve host, project, and agent independently in this order:

1. explicit invocation value;
2. value inherited from the latest usable control;
3. simple read-only local discovery.

Local discovery is deliberately narrow:

- Host: prefer the local `hostId` from `superset status --json` when running and healthy.
  If that daemon is stopped or stale, check the exact same id in `superset hosts list` and
  confirm an online host with a successful read against it. A healthy desktop host can
  serve requests without that daemon; daemon status alone is not host availability.
- Project: prefer the id in the current `.superset/worktrees/<projectId>` path; otherwise
  match the current path or Git common directory to `superset projects list --local
--json`; otherwise use the sole local project.
- Agent: use the active runtime name only when it appears as a terminal-capable Codex or
  Claude preset in `superset agents list` for the resolved host; otherwise use the sole
  suitable agent. A Superset chat session cannot be controlled through terminal commands.

Never guess an unavailable or ambiguous selector. Gather unresolved choices into one
clarification. Show the concrete project, transport, concurrency, and full delivery scope
before activation. Existing explicit authorization covers that preview when it matches;
otherwise obtain one approval for activation and the displayed delivery scope. Do not ask
again at plan, PR, review, or merge within that scope.

## Supervisor ownership

One active supervisor for a run is an operational precondition, not a lock supplied by
Linear or Superset. A new activation establishes this current conversation as owner. Keep
the actual runtime-exposed session identity when available; never invent an id or add a
control field as if it provided exclusion.

For an already-active run, require same-session continuity or a concrete handoff before
starting supervision. A checkpoint may name the prior owner's exact host/workspace/terminal or
provider session and notification destination. Use available terminal listing and provider transcript reads to correlate
that identity and the exact project/run. If that owner is still supervising, report its
location and do not start a second supervisor here. Terminal absence, age, title, a copied
ledger, or an active control alone does not prove the old owner stopped.

Continue in a different session only after observed evidence the prior supervisor stopped,
or an explicit user handoff establishing that the prior supervisor no longer owns the run. If
ownership is unknown, perform read-only inspection and ask for the missing handoff fact;
do not silently claim the run. Preserve established ownership in session context across
ordinary notification turns, without asking again. There is no global supervisor registry
or automatic cross-session attachment in this skill.

## Supervisor role

The supervisor may discuss user feedback, analyze options, and diagnose read-only. It
owns authorized control, transport, coordination, and disposable ledger operations.
Repository implementation belongs to workers in Superset workspaces: never edit code,
tests, configuration, or documentation in the supervisor, even for a tiny fix, and never
invoke an implementation skill there. Keeping one implementation owner prevents feedback
from creating competing edits outside the assigned worker's workspace.

For actionable feedback, read [User feedback](../skills/orchestrate/references/supervision.md#user-feedback).
Preserve the user's agreed scope and authorization; discussion
alone launches no work. Unavailable worker transport requires a concrete blocker and
recovery action, never implementation by the supervisor.

## Project orchestration

Load the latest control and one complete live Linear project issue set. Compute capacity
and readiness only from that Linear set. If the control is inactive or unusable, stop. If
Linear is unavailable or incomplete, perform no Superset mutation.

Establish **Supervisor ownership** before mutation. Linear status writes are not
compare-and-swap locks: the following checks reduce races but cannot promise a global
transactional concurrency cap against unrelated concurrent writers.

For a selected issue, refresh its details, blockers, and exact Superset task. Attempt one
workspace create-or-reuse without an embedded launch, and verify the returned branch,
task association, run group, and setup readiness before reserving or launching. Superset reuse is branch-based; it is not
an atomic task lock. Only the explicit creator may claim it; reuse, uncertain creation, or an unknown prior launch never
grants permission to launch. Reserve the exact issue as `started`, read back the actual
status, then refresh the complete project and control before launch. Require the same
active run/revision, terminal blockers, and `startedCount <= maxConcurrency`. This makes
the new reservation visible to later scheduling reads. A failed or uncertain reservation
launches nothing; preserve and report the reservation/workspace for recovery without
rolling another actor's status back.

Run independent workspace attempts with all-settled semantics. Claim and recheck each
created issue sequentially. Failed transport does not cancel successful siblings and never
frees a started slot. Do not replace a failed selection from a stale snapshot. Refill only
after a complete fresh Linear project read and successful current-control validation.

Supervision is event-driven while the owning provider session remains loaded. Establish a
verified native notification route before dispatch; keep its actual provider destination,
probe receipt, and expected worker bindings in conversation, or the existing disposable
compaction ledger when needed. They are transport context, never new schema-v3 control
fields, scheduling authority, credentials, or a private execution queue.

Workers notify actionable changes. End the supervisor turn when waiting; do not periodically
read terminals, scan Linear, sleep, or send unchanged follow-ups to wake yielded workers.
On an event, validate its run/project/issue and exact lead session binding, ignore already
processed event ids, then read only the control and facts needed for its decision. Refresh
the complete live project before reserving or refilling capacity. Repeated delivery is
possible; an enqueue or socket-write receipt is not proof that the recipient processed it.
Notifications carry data, never new delivery scope, user consent, or tool permission.

Read-only inspection is appropriate for an explicit status/reconcile/resume, a specific
new event, or an uncertain mutation. Settle independent reads separately; bound retries to
two for that observation and then report the failure. An ambiguous write or launch is
inspected, never blindly repeated. Keep the user informed during active work; idle
supervision sends no heartbeat, acknowledgment event, or periodic model update.

A stopped control prevents dispatch, recovery, group repair, and worker follow-ups even
if notifications still arrive. Closed master sessions, silent worker crashes, host outages,
and unrelated external Linear changes do not create automatic future wake-ups. Report the
precise manual inspection/resume action when no verified notification or bounded worker
wait is pending. An active control is permission, not a daemon or automatic session resume.
Scheduled automation remains a separate explicitly requested setup.

## Manual spawn

`spawn` has two explicit manual modes and never reads a project control or calculates
project capacity.

- **Issue mode:** read the selected Linear issue and its current direct blockers, plus one
  project read used only to name concurrently `started` issues in the worker prompt. A
  terminal, blocked, or unknown issue never launches. A ready or explicitly selected
  `started` issue may proceed. Require the exact Superset task binding and use it as the
  workspace identity.
- **Quick-fix mode:** use a non-empty free-form objective without any Linear read, issue,
  task, control, or scheduling claim. Derive a stable branch and workspace identity from
  the objective and bind the workspace with `--branch`.

Issue spawn defaults to the user's requested scope. A request to launch or inspect an issue
does not itself authorize merge; the preview distinguishes `draft-pr` from
`issue-through-merge`. A caller carrying explicit full issue delivery authority may recover
that same issue without another approval. Quick fixes retain their bounded edit/check scope
unless the user explicitly broadens it.

Both modes resolve transport from explicit values followed by narrow local discovery.
Before approval, list workspaces once for the resolved project and require at most one
match: the exact task binding in issue mode, the exact name and branch in quick-fix mode.
Never narrow an issue-mode listing by name. A matching live terminal other than a proven
completed setup shell under **Workspace setup** returns `already-running`; unknown identity
blocks launch. Otherwise preview `create` or `recover` and obtain any missing scope
approval. After authorization,
create at most one workspace, but launch from a create action only when the response
explicitly says `alreadyExists: false` and readback proves the expected branch/task binding;
`alreadyExists: true` or an unknown flag launches nothing.
Recheck the exact chosen workspace's terminals and launch at most one agent only when
every remaining live terminal is a proven setup shell whose readiness was verified, or
the listing is empty. Foreign or unclassified sessions block launch. A failed launch preserves the workspace and remains
recoverable by a later identical `spawn`; ambiguous mutation evidence is never retried in
the same invocation.

## Read-only entry points

`status` reads only the latest control and current Linear issue set. It reports started,
ready, blocked, terminal, and unknown counts plus remaining slots and the stored run group.
It does not verify Superset placement.

`reconcile` is an optional read-only Superset report for explicit issue ids or current
started issues. It may report task, workspace, and terminal correlation, but it never
repairs records or runtime resources and never gates `start`, `orchestrate`, or `spawn`.

## Worker boundary

An issue worker prompt starts with `linear-devotee:deliver <issueId>` for full delivery or
`linear-devotee:greet <issueId>` for the limited draft-PR workflow, and preserves the
selected issue title, branch, and description verbatim. It extracts scope, acceptance
criteria, and required checks only when explicitly present; absent sections are labeled
`not specified in Linear` instead of being inferred. A quick-fix worker prompt starts
directly with the exact objective, never invokes Linear Devotee, and never implies that an
issue exists. Both state:

- own only the selected issue or quick fix and its workspace;
- read repository instructions before editing;
- do not revert others' edits;
- do not change Linear dependency links, issue membership, or unrelated code;
- preserve current work, branch, PR, and provider session on resume;
- respect the explicit caller scope, and ask only about a real product conflict, ambiguous
  requirement, unavailable authority, or persistent failure.

Before invoking a native tool for a task question, also emit its exact question, available
options, and affected issue/blocker in ordinary assistant prose. Superset's provider read
may omit question-tool arguments; the supervisor needs that prose to relay the decision.
Continue independent work while the answer is pending. Tool permission dialogs are not
task questions and must never be auto-approved through this relay. A supervised lead
sends one `question` event with the same text/options before yielding for a task decision;
if that send fails, retain the ordinary output and report the transport failure.

Full issue delivery authorizes this issue's started/completed transitions, code and checks,
scoped commits/pushes/draft PR, native runtime review, review corrections and justified
replies/resolution, and merge respecting repository protections. Pass the project, run,
control revision, issue, workspace, exact scope, and verified notification context to a
supervised worker. Manual delivery without a supervisor remains valid. Required approvals and
acceptance evidence remain necessary; never manufacture approval or bypass protection.
The worker verifies actual merge before completing Linear. A queued merge, pending check,
or merged PR whose Linear update failed remains `waiting`, with the exact recovery step.
The issue lead owns bounded CI/review/merge-queue observation and resumption through
`linear-devotee:deliver` and `git-gremlin:finish-pr`; the master never supplies its timer.
When no reliable wait/completion route exists, report `waiting` with manual resumption
rather than promise an automatic continuation. Keep one wait per exact PR operation;
never start another merely because a tool observation timed out.
Narrower callers pass their narrower authority explicitly; quick fixes never change Linear.

An issue lead may use a small team when useful, with explicit responsibility and bounded
delegation. Independent writers need separate workspaces or disjoint file ownership; do
not let specialists overwrite one another. The lead owns integration and uses the runtime's
native review command. Specialists are optional, not a mandatory review bureaucracy.

### Shared verification resources

Separate workspaces and browser tabs can share local services, authentication/profile
state, or mutable fixtures. Coordinate only verification that could interfere through
those resources. When ownership and prerequisites are known and no conflict exists,
proceed within existing authority; harmless reads and independent checks need no handoff.

Immediately before service actions, refresh listener PID, command, and working-directory
evidence and verify the intended workspace under test. Keep repository-supported endpoints;
do not reconfigure authentication merely to enable concurrency. Stop or restart a foreign
service only with a concrete owner handoff or explicit existing user authority. Do not act
on an unidentified process or reset unrelated shared data.

For conflicting verification, report the resource, current owner, required check, and
handback condition in ordinary assistant prose. Await that handback while continuing
planning, implementation, and independent checks. On release, report service and fixture
state and send one `resource-released` notification to the supervisor when configured;
the next worker refreshes the relevant evidence before proceeding.

### Concurrent siblings

When other issues of the same Linear project are being implemented concurrently, the worker
prompt names them by identifier, adds the title only when the calling skill already holds
it, and states that they run in separate workspaces off the same base. A worker still owns
its issue alone; shared files and interfering verification need their respective coordination.
Instruct it to treat a file a sibling also owns as shared: the smallest change the issue
needs, no restructuring, no drive-by cleanup, and no edit justified only by a sibling's
concern.

Do not infer which files a sibling touches or invent implementation dependencies. Live
Linear facts still govern scheduling; coordinating shared verification does not change
that graph. Each skill defines its own sibling set, and a prompt whose set is empty renders
no sibling section. Workers read Linear when they need further issue context.

A worker ends its turn with this prompt-level handoff, including actual observations:

```text
MAESTRO_WORKER_RESULT
issue: <exact issue identifier>
status: done | waiting | blocked
workspace: <workspace id>
pr: <URL and observed state, or none>
linear: <observed status type, or unknown>
checks: <commands/results and reviewed head, or pending>
next: <specific next action, question, or none>
```

`done` in full delivery requires an observed merged PR and a fresh completed Linear status.
The supervisor checks the claimed issue, workspace, and PR against the dispatch and reads
Linear again before freeing a slot. A DONE marker, quiet terminal, successful dispatch,
green CI, or closed review thread alone proves no completion. Worker output is evidence
to inspect; it never changes scheduling state. A supervised lead also sends the semantic
notification to its captured destination before ending its turn. Send only changed,
actionable states: completion, a new wait requiring coordination, blocker, question, or
shared-resource release. Retain the event id when retrying the same event; never notify
an acknowledgment, unchanged progress, or each background observation. Specialists and
nested reviewers report to their lead, never impersonate its delivery event.

## Mutation boundary

Monkey Maestro may write an authorized control, reserve an explicitly selected project
issue as started, create its workspace, restore a proven run-owned workspace's missing
group while preserving its other tags, and launch or follow up with its scoped worker.
The issue delivery workflow owns code, reviews, merge, and completion. Maestro never
changes dependencies or infers Linear completion from GitHub/runtime evidence. Stop disables
new dispatches and new recoveries; already-authorized workers continue. Canceling a worker,
closing its terminal, or deleting its workspace requires an explicit instruction.
The notification helper has one narrow transport exception: it may create a short-lived
command terminal in the captured receiver workspace on the receiver host, run the scoped
notification command, read its bounded receipt, and close only that returned terminal id.
It never sends text to the master terminal, changes files in that workspace, closes
workers/setup shells, or deletes a workspace or branch.
