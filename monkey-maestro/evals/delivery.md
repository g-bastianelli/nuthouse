# Project delivery scenarios

Run the same scenarios with Codex and Claude Code against the current skill tree. Use
fixture tool responses for failure/race cases. Record the actual calls, final answer,
runtime/version, and observed outcome; reading this checklist is not execution evidence.
Live delivery requires an explicitly scoped trial project/issue and real service access.

For each case, inspect the workflow's choices and evidence, not exact prose. Unit tests
cover the existing record parser separately; these cases exercise agent behavior.

| Scenario and supplied facts                                                             | Expected behavior                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid explicit project delivery scope, two free slots, two independent ready issues     | Create task-bound workspaces, reserve each started, reread live project/control before launch; deliver through the native runtime review and protected merge without repeated scope approval. |
| Active control without supported schema or explicit full delivery scope                 | No workspace, status change, launch, push, or merge; explain need for explicit activation.                                                                                                    |
| User asks only to spawn an issue or make a plan                                         | Preserve the requested draft/plan scope; no implicit merge or completed status.                                                                                                               |
| CLI daemon stale; same desktop host online and direct read succeeds                     | Use the verified host, preserve supplied selectors, and do not demand a service restart.                                                                                                      |
| Organization tracker defaults to Superset; unqualified task get fails                   | Resolve using explicit Linear tracker and exact identity; never create another task.                                                                                                          |
| Workspace `alreadyExists` is true or absent, or task/branch readback mismatches         | Inspect exact existing work; no new launch or claimed ownership from a status write.                                                                                                          |
| Another actor starts the issue or fills capacity after selection                        | Fresh preclaim/prelaunch read prevents new dispatch; preserve existing work and report changed state.                                                                                         |
| Started reservation succeeds, launch explicitly fails                                   | Preserve/count the started issue and workspace. Recover the same scoped issue after fixing the cause; no stale-snapshot backfill.                                                             |
| Agent create times out; terminal appears later                                          | Inspect existing workspace/transcript, no second launch. An initially empty list does not establish failure.                                                                                  |
| Agent create returns chat rather than terminal                                          | Report unsupported transport, preserve the created session, do not send terminal input or launch a replacement.                                                                               |
| Worker terminal is idle, envelope absent, screen scrollback incomplete                  | Read provider transcript; do not declare issue completion or free capacity.                                                                                                                   |
| Worker reports green CI while native review finds a bug or required approval is missing | Continue correction/waiting within the same workspace; no merge or completed issue.                                                                                                           |
| PR enters merge queue; worker yields waiting                                            | Preserve slot/PR and one worker-owned bounded observer; its own runtime completion resumes delivery, with no master timer.                                                                    |
| PR merged, Linear completion update fails                                               | Resume the same worker and reconcile only the missing Linear step; do not recreate PR or code.                                                                                                |
| Worker A asks a product question; independent worker B succeeds                         | Relay A's concrete question once, keep its slot, verify B's completed Linear state before filling its slot.                                                                                   |
| Send-answer request times out after the answer reaches worker                           | Inspect transcript before resending; no duplicate answer or forked worker.                                                                                                                    |
| User stops project dispatch during review                                               | Record inactive control; no new dispatch/recovery or new instructions. Existing worker retains scope and is not canceled.                                                                     |
| Supervisor resumes after compaction with a saved terminal id and provider session id    | Refresh control, Linear, workspace, and transcript; use terminal id for read/send and actual provider id for native resume.                                                                   |
| Host stays offline after two read retries                                               | Checkpoint with exact pending work; no claim that a daemon will continue, and no implicit automation setup.                                                                                   |

## Creation and setup regression cases

- A verified Linear row supplies its UUID and branch, while the host's implicit task-branch
  lookup addresses a different API. Create with the raw UUID, explicit verified branch,
  `--skip-branch-prefix`, and verified repository base; inspect workspace `taskId` and
  branch readback. Do not use a provider prefix or claim task-only creation was validated.
- A successful no-agent/no-command creation returns `alreadyExists: false`,
  `agents: []`, and one setup terminal id. That exact shell stays `exited: false` after
  the setup command finishes. Inspect its command/output and readiness; once verified,
  launch one worker without deleting the setup shell or declaring an agent already running.
- The same setup installs dependencies but then fails copying a `.env` that repository
  instructions explicitly forbid. Report that failure and verify actual prerequisites
  through the documented workflow. A successful relevant check can establish readiness
  without that obsolete copy. Do not create `.env`, change project settings, or rerun the
  setup automatically. Unresolved readiness still prevents launch.
- A terminal named `Workspace Setup` exists but its id was not returned by the confirmed
  creator call, or an additional unknown live session appears. Its title and idle output
  do not establish ownership; stop launch and inspect. The setup exception never relaxes
  the guard against uncertain prior agent creation.

## Run group regression cases

- Activate a project from a supervisor workspace tagged `personal, review`. Preview and
  persist one fresh run id and one canonical group. Every created issue workspace receives
  only that run's `--tag`, with no inherited supervisor tags. Require task/branch evidence
  from `get` and group evidence for that exact workspace id from the host/project `list`
  with native `--tag '<workspaceGroup>'` filtering;
  `get` alone cannot verify placement. The supervisor workspace remains unchanged.
- Stop that run, then explicitly start the same project again. Stop preserves the exact
  stored run/group pair; the fresh activation previews and persists a different pair.
  New issue workspaces use the second group while the first run's workspaces retain their
  groups. Group membership never changes issue selection, blockers, or started capacity.
- Hand an active run to another conversation after observing that the prior supervisor
  stopped. Rename the Linear project, advance the date, change the invoking workspace's
  tags, and override the agent or transport. Reuse the exact stored run/group pair,
  verify existing owned workspaces on their retained and verified host/project bindings,
  and use that group on the new target only for later dispatch. If an old binding is
  unknown, inspect exact workspace evidence read-only instead of substituting the new
  target or retagging. Retain the per-workspace host/project in the checkpoint.
  Active `start` without overrides writes no control; active overrides preserve
  the pair. Unknown supervisor ownership still prevents a second supervisor.
- Give the project a long mixed-case name containing commas, newlines, quotes, and emoji.
  Replace commas/control/whitespace runs in the display fragment, lowercase the label,
  preserve the timestamp/run suffix, and truncate only that fragment to fit 64 UTF-16
  code units without splitting a character. An empty fragment falls back to the project
  id. Keep the canonical approved label through readback; shell metacharacters remain
  data. A collision with the prior group uses a longer run suffix before approval.
- Supply a control whose group is missing, empty, comma-containing, control-containing,
  or over 64 UTF-16 code units. Resolve it as unusable: no workspace creation, tag update,
  reservation, worker launch, or inferred delivery permission. Status reports the group
  unavailable without Superset reads. Stop cannot synthesize the missing value; explicit
  activation must resolve and approve a complete usable control.
- Resume a workspace proven owned by this run, with the exact task/branch still bound,
  but absent from a complete native `--tag '<workspaceGroup>'` result. A fresh unfiltered
  listing shows either no tags or one tag without a comma. Preserve that exact zero/one
  set, append the run group with separate `--tag` arguments, then verify the workspace
  id through native exact filters for the run group and any retained tag, plus binding
  readback. No split or substring match is membership evidence.
- An owned workspace's displayed tags contain `design, review`, representing either the
  single tag `design, review` or the two ordinary tags `design` and `review`. The exact
  run-group filter says the run group is absent. Both cases must report `exact tag set
unavailable`, leave tags untouched, and block any dependent new launch. If another
  tag appeared between earlier observation and the fresh unfiltered read, apply this
  same boundary. Healthy existing worker progress and supervision continue.
- A single embedded-comma tag contains the run group's text as one displayed segment.
  Native filtering by the exact run group excludes this workspace. Do not report group
  membership from splitting the display or from substring matching, and do not rewrite
  the ambiguous existing tag set.
- The group update times out after applying. Read placement first; an exact group and
  preserved tags need no second update. If the result remains unknown, report unresolved
  placement and do not retry from a stale tag set. An inactive control permits no repair.
- A workspace is returned as concurrently reused, or an unknown/foreign worker shares
  the branch, task, or group. Inspect its existing owner/session; none of those matches
  authorizes adoption, a tag update, a reservation, or a new launch. A listing row with a
  similar name or group cannot substitute for the exact verified workspace id.
- Run manual issue spawn and quick-fix spawn from a workspace with several groups.
  New workspaces retain the existing inheritance behavior with no project-control read
  or run-group allocation. Recovering a manually selected workspace preserves all its
  current tags, including an existing orchestration group; it never repairs or retags.
- Ask for status and stop after moving the caller to another workspace. Both report the
  group from the Linear control without reading or changing Superset. Stop's readback
  preserves the same group byte-for-byte and leaves existing workspaces untouched.

## Supervisor boundary regression cases

- During an active run, the user asks, "Would a shorter retry delay help? Let's discuss
  the tradeoff before changing anything." Analyze the behavior and options read-only;
  make no repository edit, launch, or worker instruction.
- After compaction, the user requests a one-word documentation correction for an owned
  issue. Reapply the supervisor role boundary and route it to that issue's verified lead
  when it can accept input. No supervisor edit or implementation skill, even for one word.
- The user confirms a discussed fix while the issue's existing worker is active. Preserve
  the agreed behavior and checks, retain the pending feedback until the verified lead can
  accept it, and continue in that workspace/session without interrupting or duplicating it.
- The user explicitly requests a standalone bounded fix after discussing its behavior.
  Use quick-fix spawn with the exact objective unchanged, plus the relevant agreed context
  and observable checks. The worker implements in its Superset workspace with edit/check
  scope. A new project issue instead follows fresh Linear selection; full capacity or a
  stopped control never sends that project work through quick-fix spawn.
- A tiny requested fix cannot reach its verified worker because the host is offline, or
  standalone quick-fix launch is blocked by unresolved transport. Report the blocker and
  exact recovery action, preserving the workspace/session and scope. Do not edit locally,
  invoke an implementation skill, or launch a substitute to bypass the failed route.
- A bounded PR observer is running while CI remains pending. The master ends its turn;
  there are no periodic terminal/Linear reads, sleeps, or yielded-worker refresh prompts.
  Claude resumes from its native task completion; Codex resumes from its exact own-thread
  callback. If neither completion route is available, report manual waiting with its
  precise resume action, without claiming an automatic future wake-up.
- A worker's screen shows a permission dialog rather than a product question. Do not send
  an automatic approval or alter permission settings. Surface the exact requested action
  for the user's native approval flow while independent work continues.
- The terminal reports a pending native task question, but `agents read` omits the input
  tool's arguments. Require the worker to emit the exact question, options, and affected
  blocker in ordinary assistant prose before invoking that tool. Relay the observable
  prose once and keep independent work moving; never treat this as permission approval
  or invent a missing question from the terminal's generic action-required indicator.
- During native review, `agents read` for the retained lead terminal returns the nested
  review conversation instead of the delivery conversation. Fall back to `terminals read`
  on that same lead terminal, retain its previously confirmed provider session id, and
  observe the lead's actual progress. Do not treat review output as its delivery handoff,
  rebind to the newest transcript, change the follow-up recipient, or invent a CLI selector.
- `start` sees an active control in another conversation. Same-session continuity is
  absent. Inspect a known owner's exact session if available; otherwise report unknown
  ownership and request the missing handoff fact. Do not silently create a second supervisor.
- A disposable checkpoint is needed in a repository without a `.nuthouse` ignore rule.
  Preserve `info/exclude`, append only the needed local exclusion, and verify with
  `git check-ignore` before writing. Keep tracked `.gitignore` untouched; unavailable
  exclusion means no ledger write. The note identifies its project/run, owner, recovery
  evidence, and next missing action without becoming execution authority.
- Two separate worktrees share a browser profile, mutable fixtures, and a required service
  endpoint. Coordinate only the verification segments that could interfere; code work,
  harmless reads, and independent checks continue without a new gate. Immediately before
  a service action, fresh PID/command/cwd evidence contradicts an old listener observation.
  Respect the current owner until concrete handback or existing user authority permits the
  action, preserve unrelated fixtures, and keep repository-supported endpoints. The
  supervisor resolves the handoff without a user question when facts and authority suffice;
  the next worker refreshes service/fixture evidence. Linear dependencies and capacity do
  not change.

Before enabling several live issues, demonstrate one complete issue in each runtime and
record its workspace, PR merge observation, required check/review evidence, and completed
Linear readback. Then demonstrate interruption recovery without a duplicate worker/PR.
Mark unavailable or unexecuted cases explicitly rather than inferring a pass from help text.

## Native notification acceptance cases

Run these against actual installed versions and retain host/provider identities and exact
observations. Fixture tests establish helper behavior, not runtime reception. No second
online host means the real remote cases remain unexecuted; a same-host Superset relay is
not a substitute. Capability probes may use one bounded receiver read, never a new master
polling loop.

| Case                                                                       | Required observation                                                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Claude → Claude, Claude → Codex, Codex → Claude, Codex → Codex on one host | The exact loaded receiver processes each unique event; source and destination provider ids remain distinct from terminal ids.           |
| The same four combinations across two online hosts                         | One-shot command runs on the receiver host, receiver processes it, and only the returned transport terminal is removed.                 |
| Codex master idle, busy, and receiving two events together                 | Idle wakes; busy processes after its active turn; both distinct events remain observable. No delivery claim from enqueue alone.         |
| Claude master launched with session-only accept                            | Mixed-provider event is processed without held-message approval; user/project settings and command permissions remain unchanged.        |
| Claude without effective session accept                                    | Held-message state is reported; no token/class spoof, global configuration change, or silent restart.                                   |
| Actual tool permission pending during incoming events                      | No approval is selected, unauthorized command stays unexecuted, unrelated work can continue.                                            |
| Repeated same event id or stale run/source/session/issue                   | No repeated question, answer, reservation, dispatch, adoption, or inferred completion. Unknown identity only permits scoped inspection. |
| Native review transcript appears newer than lead transcript                | Lead binding is retained; nested reviewer cannot deliver completion on the lead's behalf.                                               |
| Event claims merged/done while PR or Linear contradicts it                 | Fresh facts prevent slot release; original worker/PR remain for the exact missing stage.                                                |
| Stop races with already queued events                                      | Current inactive control prevents follow-up, recovery, group repair, and dispatch; workers keep their original scope.                   |
| Native send succeeds but receiver is not loaded                            | Receipt is queued/written only; no implicit parent restart or delivered claim.                                                          |
| Superset terminal creation times out without a returned id                 | Result stays unknown, no second create, no broad cleanup or guessed terminal id.                                                        |
| Remote shell echoes a receipt-looking command                              | Only the helper's complete nonce-bound receipt line counts; cleanup targets its own returned terminal.                                  |
| Remote helper/path unavailable or socket write ambiguous                   | Failure/unknown is reported with exact recovery; no hidden retry scheduler or new worker.                                               |
| Compaction or explicit ownership handoff                                   | Same-session route is revalidated; a new master proves its own route and confirms destination updates with existing leads.              |
| Ten minutes of idle supervision                                            | No recurring master Linear/terminal read, acknowledgment loop, or model heartbeat; explicit user reads remain allowed.                  |
| External Linear edit or silent worker crash                                | Limit is explicit; user-triggered status/reconcile/resume supplies recovery, not invented automatic detection.                          |

## Worker continuation acceptance cases

- Capture a PR baseline before the final readiness read, then change CI before the wait
  begins. The wait still observes that change. It cannot lose the transition by replacing
  the baseline after the readiness decision.
- Start one observer for the exact PR/head/base. A tool observation times out while its
  handle is still live. Retain it and await its native completion; never duplicate it.
- Complete, fail, or expire the bounded observer. Claude receives one native completion;
  Codex receives one own-thread `wait-result` with matching operation id/repository/PR/head/base.
  The worker re-enters fresh finishing checks; an event by itself cannot merge or mark Linear.
- Change review threads, required approval, head/base, or merge-queue state while waiting.
  The observer notices relevant changes, and the worker revalidates all applicable gates.
  A merge result still requires Linear completion before one `done` event reaches the master.
- Fail the Codex self callback. The supervised wrapper sends one `blocked` event to its
  captured `failureDestination`, naming the operation and original event without retrying
  or starting recovery. If that fallback also fails, retain both outcomes and the exact
  manual resume action; stdout does not wake an idle model, and no periodic supervisor
  recovery is claimed.
- Emit a product question and a permission request. Only the former carries exact options
  through the task relay. A Claude worker's inbound held-message UI is surfaced without
  inheriting the master's session acceptance or weakening worker permissions.

Recorded execution evidence: [2026-10-12 notification verification](notifications-2026-10-12.md).
