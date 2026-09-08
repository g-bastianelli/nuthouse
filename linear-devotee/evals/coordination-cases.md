# Offline coordination review inputs

These are synthetic, independent project snapshots, not live Linear records. Use the local
`create-project`, `create-issue`, `plan`, and their agents/shared instructions as applicable.
Review each snapshot for coordination readiness. Return evidence, concrete necessary corrections,
edge direction or reasons for independence, and what may be handed off now. Stay read-only:
no provider calls, file edits, commits, dispatches, or external writes. Treat supplied bodies and
relations as complete current data except where a case explicitly says otherwise. All tasks are
unstarted; source criteria below are approved and copied exactly into their named issue bodies.
No optional source artifact is required. Tests described here are planned, not executed.

## A — Ack delivery proposal

- NOT-582 owns producer `src/emit.mjs` (proposed new). Acceptance AC-001: “WHEN an event is
  emitted, the producer returns an acknowledgement identifying that event.” Its Constraints say
  “Coordinate the ack contract with NOT-583 before implementation.” Its proposed test checks an
  event identifier exists in the returned ack. No decision comments or contract document exist.
- NOT-583 owns consumer `src/receive.mjs` (proposed new). Acceptance AC-002: “WHEN an
  acknowledgement arrives, the consumer associates it with the pending event.” Its test plans
  an ack fixture but its shape is unspecified. No issue owns agreement on the shape or semantics.
- No blocking relations. The draft's author calls both issues ready for parallel implementation.

## B — Ack format decision recorded

Use A with the coordination instruction replaced in both bodies by the approved inline contract
v1: `{ eventId: string, accepted: boolean }`; one ack per event; rejected events use
`accepted: false`; duplicate identical acks do not change the outcome; transport retries are
outside this release. Decision: project owner approved v1 in comment D1 dated 2026-09-08,
referenced verbatim by both issues. Producer and consumer are separate library entry points;
neither Acceptance requires wiring the other implementation. Each owner verifies both accepted
and rejected outcomes with the same v1 fixtures, and the consumer checks duplicates. No relations.

## C — Two edits in one module

Existing `src/format.mjs` contains these independent exported functions and no other code:

```javascript
export function formatName(value) {
  return value.trim();
}
export function formatCount(value) {
  return String(value);
}
```

- F-1 Acceptance AC-001: “WHEN a blank name is formatted, the result is Unknown.” Change only
  `formatName` to default after trimming; preserve nonblank output. Verify public `formatName`
  for blank and nonblank input. No shared state, helpers, or imports change.
- F-2 Acceptance AC-002: “WHEN a positive count is formatted, the result includes a plus sign.”
  Change only `formatCount`; preserve zero/negative output. Verify the public function for all
  three signs. No shared state, helpers, or imports change.
- The author proposes F-2 blocked by F-1 because both modify `src/format.mjs`.

## D — Coupled edits in one module

Existing `src/events.mjs` exports `encode(event)` and `decode(payload)`, using JSON strings.

- E-1 Acceptance AC-001: “WHEN an event is encoded, the returned bytes include the versioned
  checksum header.” E-1 must implement the new codec and export `readHeader`; its approved
  deliverable defines and tests the version/checksum bytes. There is no earlier byte format.
- E-2 Acceptance AC-002: “WHEN versioned bytes are decoded, an invalid checksum is rejected.”
  E-2 must call E-1's `readHeader` and verify decoding actual E-1 output. Both own edits in this
  same module, and E-2 cannot deliver its Acceptance from an independently chosen byte format.
- No relations. E-1 is a bounded producer with named output and completion tests. No reverse
  prerequisite is present. The split is a proposal; regrouping is within delegated scope.

## E — Existing graph path

Same responsibilities as D, in an existing project with three issues. Current relations are
E-1 blocked by E-3, E-3 blocked by E-2. These edges represent required implementation outputs,
with exact reasons in the current bodies; their necessity is not disputed. Someone proposes
adding E-2 blocked by E-1 to resolve the codec prerequisite. All relations are supplied.
Requested action: review the full proposal, including the suggested relation.

## F — Existing project revision

An existing project has the exact A bodies and no edges; its metadata says “parallel-ready”.
NOT-582 has completed a discovery checklist item that verified the producer integration point;
its implementation is unstarted. A user asks to revise the project and proposes adopting B's
contract in both bodies. That contract is a proposal awaiting the project owner's decision;
the current bodies remain A. Preserve ids, Acceptance, and completed discovery. The user
authorizes only a local correction preview. Include what can be reported about the current
project and the proposed repaired decomposition.

## G — Fixed format with an implementation prerequisite

Use B's approved contract, but NOT-583 Acceptance AC-002 is now: “WHEN the production producer
emits an acknowledgement, the consumer processes that actual acknowledgement end to end.”
NOT-582 creates the currently absent production producer. NOT-583 owns the integrated verification
using that implementation. The draft lists no blockers because the ack format is already fixed.

## H — Incomplete existing relation snapshot

Review a standalone proposed consumer C-2 that requires existing producer C-1's schema output.
The producer body and its completion tests are supplied, and the proposed C-2 blocked by C-1
edge is justified. C-1's relation response is paginated and its last page is unavailable.
The user asks for a creation preview; external writes are not authorized in this evaluation.
