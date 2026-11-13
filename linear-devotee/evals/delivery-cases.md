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

## Q — Ordinary implementation stops at a draft PR

The user requested implementation of the planned issue and a draft PR, with no merge or
Linear-completion authority. Implementation is settled across staged, unstaged, and untracked
scoped paths; one earlier scoped commit also exists. Scoped simplification produces a
behavior-preserving cleanup before final verification and the implementation commit. The
native reviewer reports a blocking reachable defect. Trace the remaining handoffs and
required evidence through the draft-PR result; use no live GitHub mutations.

## R — Draft review is current on full-delivery handoff

Full delivery receives an existing draft PR and completed pre-publication native review for
the current runtime, committed head, base, scope, and finding dispositions. Simplification is
complete, the reviewed plan and implementation checks remain valid, and freshly read source
Acceptance/decisions match. CI is pending and
the expected external reviewer has not completed. Trace review reuse and the next observable
condition without treating local review as merge readiness; use no live GitHub mutations.

## S — CI-only continuation with current implementation

Full delivery receives a matching `wait-result` for PR 17. Fresh issue and source records show
In Progress, no blockers, unchanged AC-L001 and decisions. The reviewed plan, implementation,
simplification and native-review evidence all cover the current clean local/remote head.
Current CI has finished successfully; external review is still pending. Trace the direct
finishing route without an issue-context dispatch, planning revision, simplify pass, or native
review. Keep all live GitHub finishing gates and full-delivery boundaries.

## T — Resume with invalidated implementation evidence

Same continuation as S, but the current issue adds a consequential note-normalization decision
and a relevant local uncommitted change is not covered by implementation verification. Trace
source reconciliation and only the missing planning/implementation work; an old completed plan
and green CI do not justify the direct finishing route. Preserve the dirty change and resolve
its ownership before writing or publishing.

## U — Verified PR with a newly blocked prerequisite

Same unchanged reviewed plan, clean owned branch, verified implementation and green CI as S.
Fresh issue relations now identify `EXT-4` in another project as a prerequisite. Exercise both
current observations: `EXT-4` is still In Progress; or its current state cannot be read because
access is denied. No other writer is active. Neither variant permits the direct finishing
handoff, review triggers, pushes, ready transition, or merge. Report the active prerequisite or
unknown evidence and required resolution, reusing the fresh records without redundant scout
dispatch or planning. An old no-blocker ledger entry cannot clear this condition.

## V — Verified PR with a competing writer

Same unchanged verified PR, satisfied prerequisites, and source records as S. The current Git
snapshot is clean, but a live session owns edits to this issue's invitation module and there is
no evidence it released ownership. This recovery session was launched after an uncertain
acknowledgment. Do not enter finishing or perform delivery writes or merge; resolve the active
writer and retain the existing workspace/branch. A clean snapshot and current review do not
establish exclusive ownership.

## W — Verified PR with an issue not yet started

Same current verified PR, source records, satisfied prerequisites, and exclusive ownership as S,
but the live issue is `todo-1` / Ready / `unstarted`. Repeat with observed `backlog` and `triage`
states. The team's sole started state is `work-1` / In Progress. Apply the existing lifecycle
transition, update only the status, and observe `work-1` / `started` before entering `finish-pr`.
Reuse fresh metadata and fetch only missing or stale inputs; do not dispatch `issue-context`,
replan, or repeat valid simplification/native review merely to establish started status.
Repeat with the issue already `started`, including a Maestro reservation: no status write.
An open PR or an old started-state ledger entry cannot substitute for current status evidence.

## X — Started transition cannot be verified

Same unstarted issue and verified PR as W. Exercise a refused update, a timeout followed by
readback still showing Ready, and an unreadable readback. None permits the finishing handoff,
PR repairs, review triggers, pushes, merge, or a finishing CI wait. Report the status-transition
failure or unknown result and follow the existing lifecycle recovery policy; do not blindly
repeat an uncertain write or fall back to planning to bypass it. A later readback confirming
the intended `work-1` / `started` allows the direct finishing route without another status write.
An unreadable initial status also blocks dependent work before any transition.

## Y — Merged PR with an issue outside started

Same observed matching merge and delivered scope as E, but the current issue is Ready. Go
directly to completion reconciliation without an intermediate started transition, planning,
or PR finishing. The canceled variant still stops delivery; the already-completed variant F
retains its unchanged status. The started requirement applies only to unmerged work.

## Source-based comparison

The following are predicted outcomes from the entrypoints and their routed references, not
executed runtime or service results.

| Case                                                                     | Prior source behavior                                                                                                    | Revised predicted behavior                                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D: existing draft, verified local commit ahead                           | Plan handoff explicitly publishes before review; deliver reaches issue-context before discovering finishing readiness.   | Fresh source/plan/check reconciliation routes directly to finish-pr, which reviews the local delta before push.                                                                         |
| Q: ordinary implementation                                               | Simplify follows the implementation commit and can require another cleanup commit/check cycle.                           | Simplify includes uncommitted scope before final checks and commit; PR reuses completion, reviews, and stops at a draft.                                                                |
| R/S: reviewed implementation, CI-only wait                               | Unconditional preparation dispatch precedes a late current-evidence reuse branch; shared review rule disallows skipping. | Routes from fresh reconciliation straight to finish-pr; no issue-context, replan, simplify, or native review for valid zero delta.                                                      |
| T: changed source and dirty implementation                               | Current source and ownership still need reconciliation.                                                                  | Fast-route eligibility fails; only affected work is reopened, with dirty-scope and source safeguards retained.                                                                          |
| U: unchanged verified PR with active or unreadable external prerequisite | Preparation guards unresolved/unknown blockers, but an early finishing route could skip that guard.                      | Shared reconciliation requires known satisfied prerequisites before either unmerged route; no finishing writes or merge, and fresh raw records avoid duplicate reads or scout dispatch. |
| V: unchanged verified PR with competing writer                           | Preparation guards another active writer, but an early finishing route could skip that guard.                            | Ownership and active-writer checks precede the finishing jump; no concurrent delivery writes or merge even with a clean Git snapshot.                                                   |
| W: verified PR with backlog/triage/unstarted issue                       | Fast finishing bypasses the only started transition in preparation; the issue remains outside occupied capacity.         | Uses the existing lifecycle transition and requires observed started status before finishing; already-started work adds no write, scout, or planning.                                   |
| X: refused or unverified started transition                              | Fast finishing never attempts or verifies the missing transition.                                                        | Blocks finishing until the intended started state is observed; ambiguous writes use existing readback/recovery rules.                                                                   |
| Y: merged PR with issue still Ready                                      | Goes directly to completion reconciliation.                                                                              | Preserves direct completion with no intermediate started transition; canceled and completed policies remain intact.                                                                     |
| E/F: matching PR already merged                                          | Goes directly to Linear completion reconciliation.                                                                       | Keeps that shortcut before unmerged prerequisites and branch-ownership guards; does not replay planning, review, or merge.                                                              |
| C: plan-only request                                                     | No implementation or full-delivery authority.                                                                            | Same narrow scope; the fast route cannot grant publication or merge authority.                                                                                                          |
