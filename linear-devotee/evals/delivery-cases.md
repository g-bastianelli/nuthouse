# Full delivery decision fixtures

These are synthetic, read-only cases. Do not contact Linear, GitHub, or Superset, run Git
mutations, create real sessions, or dispatch agents. Read the candidate's `skills/deliver`,
`skills/plan`, `skills/greet`, shared lifecycle/provider rules, and the available Git Gremlin
`finish-pr` instructions. For each case, report the chosen workflow, next actions in order,
outcome and observed stage, missing evidence, and any question. State what the supplied facts
prove; do not claim to have run their planned checks or mutations.

## Common setup

- Repository `example/invitations`, base `main`, issue `LD-12` in team `team-1` and project
  `project-1`. The authorized Superset workspace is `/tmp/invitations-ld-12`, branch
  `dev/ld-12-note-validation`. No other worker is active unless the case says otherwise.
- Team states are `todo-1` / `Ready` / `unstarted`, `work-1` / `In Progress` / `started`,
  `done-1` / `Shipped` / `completed`, `cancel-1` / `Canceled` / `canceled`.
- Acceptance `AC-L001`: An admin submitting an invitation with a supplied non-string note
  or a note longer than 240 JavaScript characters receives 400/invalid_note and no invitation.
  Role and email guards keep precedence; an omitted note becomes an empty string.
- `src/invitations.mjs` already exports `validateNote`; `invite` needs to call it. The planned
  tests call `invite` for non-string notes, lengths 240/241, omission, and guard precedence.
- A full request is: "Deliver LD-12 in this workspace through review and protected merge, then
  complete the issue. Routine reversible implementation choices are delegated."
- PR 17, when present, belongs to `example/invitations`, this exact branch, `main`, and LD-12.
  Its URL is `https://github.com/example/invitations/pull/17`.
- Provider/skill availability is complete except when specified. These snapshots are current
  supplied fixture records, not live verification. No case authorizes external execution.

## A — Fresh delegated delivery

Full request. Issue is Ready with confirmed empty blockers. The workspace and branch match,
the tree is clean, and no PR or plan exists. A SessionStart hook detected LD-12. The active
runtime has no `CLAUDE_PLUGIN_DATA` or `CLAUDE_SESSION_ID` variables.

## B — Compaction with implementation remaining

Full request continues after compaction. Issue is In Progress, no blockers. The ledger says
greet completed and plan T0 discovery completed. A validated version-2 plan has current source
identity, verified T0, and pending T1 implementation. The code still lacks note validation.
There is no PR and no greet cache. The user says "continue the issue" in this same authorized
conversation.

## C — Narrow request on an issue branch

The current request is "Plan LD-12 only; show the plan before any implementation." The issue
is Ready, no blockers; the tree is clean. A startup hook detected LD-12. A disposable ledger
from an earlier unrelated run says "full delivery authorized". There is no current full-delivery
authorization and no PR.

## D — Existing draft with new authorized work

Full request resumes. Issue is In Progress and plan T0/T1 were reviewed. PR 17 is a draft,
remote head `h1`; local `h2` is one authorized verified implementation commit ahead of `h1`.
The current tree is clean. Repository checks for `h2` passed in this same run. There is no
review for `h2` yet. No other branch or PR is linked to this issue.

## E — Merge succeeded, Linear failed

Full request resumes. PR 17 is currently merged at `2026-10-09T10:00:00Z`, merge commit `m1`,
and its approved scope still matches AC-L001. The last verified delivered head was `h2`.
The issue is still In Progress. The prior attempt to move it to `done-1` returned a timeout.
The ledger says merge succeeded but completion did not. No new source decisions exist.

## F — Automatic Linear completion

Same merged PR and scope as E. The current issue record is already `done-1` / Shipped /
completed, written by the GitHub integration. A stale ledger says In Progress and the last
worker terminal is closed.

## G — A queue is still pending

Full request. PR 17 is OPEN with auto-merge enabled and placed in the merge queue. Native
review for its head is complete with no unresolved findings; checks are green, required
approvals satisfied, and review threads resolved. No `mergedAt` or merge commit is available.
The issue is In Progress. The worker terminal is idle.

## H — Missing reviewer capability

Full request. Issue is In Progress, complete verified implementation is in PR 17. GitHub is
reachable, but the active runtime's native review command is unavailable and cannot be loaded.
The CI is green. A previous runtime's cached summary says "review passed" without the reviewed
head or content. No current review evidence is available.

## I — Human cancellation after PR opened

Full request resumes. PR 17 is OPEN. The current issue has type canceled, with a comment from
the user withdrawing this feature. Its old plan, prior started state, and ledger still describe
the complete delivery request.

## J — Ambiguous completion policy

Same merged PR and scope as E, but this team's current statuses contain two completed states:
`done-standard` / Released and `done-internal` / Internally verified. The issue has no selected
completion policy, and neither the project nor the user's request distinguishes them.

## K — Concurrent issue writer

Full request. The current workspace has PR 17 and issue In Progress. A live Superset session
is already editing this issue's invitation module. The coordinator dispatch was retried after
an uncertain transport response. This session has no evidence that the existing writer stopped.

## L — Current issue context unavailable

Full request resumes after compaction. A cache contains AC-L001 and started state. The issue
provider now returns an authentication error, so current status, source decisions, and blockers
cannot be read. PR 17 is open and GitHub is available. The old ledger names no unresolved work.

## M — Worker-owned pending CI

Full request from a Maestro supervisor, with verified master destination and this Codex lead's
exact local self destination. PR 17 is OPEN; the current head/base match the readiness read,
required CI remains pending, and the observer baseline was captured before that read. A bounded
`wait-and-notify` operation is already live under a confirmed handle with operation id
`ci-17-1`. The tool's latest observation window timed out without terminating the process.
The master has ended its turn awaiting notifications.

## N — Scoped continuation after change

Same supplied scope as M. One `wait-result` for `ci-17-1` reaches the lead's exact thread with
the expected repository/PR/head/base and outcome `changed`. CI is now green, but a fresh PR
read shows a new unresolved external review thread. A duplicate of the same event then arrives.
No merge or Linear completion evidence exists.

## O — Expiration and unavailable callback

Same PR as M. The bounded observer has ended with `expired`; callback transport to the lead
returned `unknown`. Its required master `failureDestination` received one blocked fallback
with the exact operation and original event. The ordinary process result remains readable.
There is no active observer handle and no automatic master timer. Native permissions remain on-request; a tool approval
is pending for an unrelated command. State the recoverable waiting condition and exact resume
action without claiming callback processing, approving the command, or starting another wait
from old evidence.

## P — Manual full delivery

Full request without a Maestro caller or notification destination. PR 17 remains in the merge
queue with no observed merge. Repository checks and native review are complete for its current
head. No verified native background completion route is available. Preserve normal standalone
waiting and its precise continuation; no master address, control, or notification setup is
invented.
