# Issue lifecycle transitions

Read the relevant transition only when the caller has authority to perform it. A requested
implementation authorizes starting its issue. Full delivery through merge also authorizes
completing that issue after the matching PR is observably merged. A brief, plan-only request,
branch identifier, or remembered ledger never supplies that authority. Reuse existing authority
without an additional confirmation for the same issue and scope.

## Resolve and observe

1. Read the issue's current id, team, and status id/name/type through the selected provider.
   Use [`provider-selection.md`](provider-selection.md) in this directory; Claude-specific tool
   names are not a Codex requirement.
2. Never reopen a `completed` or `canceled` issue as a side effect. A canceled issue stops
   delivery even when its PR has since merged. An already-completed issue needs the matching
   merged PR before full delivery can report done.
3. Resolve state ids from this issue's actual team statuses. An explicit selected state must
   belong to that team and have the requested type. Missing or ambiguous metadata is unknown,
   never permission to invent an id or infer the type from a name.
4. Re-read immediately before the update if planning or other work intervened. Update only the
   issue's status field; preserve description, relations, assignee, and other metadata.
5. Read back the issue after writing. A successful tool response without the intended observed
   status is incomplete. After a timeout or ambiguous failure, read first; retry only a change
   that is still missing and authorized. Report the provider's actual failure, not success.

## Start authorized work

- If the status type is already `started`, record `Status: <name> (unchanged)` and continue.
  Maestro may already have reserved the issue; started status does not prove any implementation.
- Otherwise use an explicit selected state, or a current brief's `Started state id`, verified
  against the team's `started` statuses. Without either, use the sole `started` state; with
  several, use the unique one named exactly `In Progress`. Ask only when this policy leaves
  no unique choice. Scouts and Maestro reservations use this same selection policy.
- Move to that state and verify the readback before implementation. A refused update blocks
  delivery because the project coordinator counts live started issues for capacity.

## Complete observed delivery

- First verify the exact PR belongs to this repository and issue and has a current observed
  merged state, merge timestamp, and merge commit. Open PRs, enabled auto-merge, a merge queue,
  successful checks, closed threads, or an idle agent do not establish that merge occurred.
- If the issue is already type `completed`, record its actual state id/name unchanged. GitHub's
  Linear integration may have completed it automatically; do not send another write.
- Otherwise choose the team's actual `completed`-type state: use an already selected completion
  policy, or the sole matching state. When multiple outcomes remain possible, ask which one
  represents completion rather than assuming a name such as `Done` is correct.
- Update and read back that state. On failure, retain the merged PR and report the unfinished
  Linear reconciliation. Resuming retries only this missing transition after fresh reads;
  it never opens another PR, reruns implementation, or moves the issue back to started.
