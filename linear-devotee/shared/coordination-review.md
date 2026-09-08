# Resolve coordination before orchestration

Apply this review when drafting or revising projects, issues, or implementation plans.
It is a planning check, never a Maestro scheduling input.

**UNRESOLVED MANDATORY COORDINATION PREVENTS READINESS.** A phrase such as “coordinate the
ack contract with NOT-583” in NOT-582 is a decision to investigate, even with no Linear blocker.
Search bodies, relevant decision comments, source contracts, and proposed changes for required
agreement, shared interfaces, producer/consumer outputs, and coupled edits. Keywords and file
overlap are discovery hints; read the behavior before deciding whether an edge is needed.

| Excuse                                                         | Reality                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| There is no blocking relation, so the draft is parallel-ready. | Draft review must resolve required agreement before publishing the work.           |
| Both issues touch the same file, so one must block the other.  | File ownership alone says nothing about behavioral dependence.                     |
| The agents will agree after they start.                        | Required contracts belong in the reviewed tickets before dispatch.                 |
| The graph validator passed.                                    | It proves graph structure, not that all required decisions were found or resolved. |

## Inspect and decide

For each interaction, record in a **Coordination** section: the participating draft keys or
existing Linear ids; source evidence; interface or affected paths/symbols and intended changes;
required agreement or output; chosen resolution and reason; decision provenance; and observable
verification with an owner. Use `none` with a short scope-based reason when there is no interaction.
Do not introduce a separate runtime registry or require a list of every file in the project.

Choose a supported resolution:

- **Contract fixed upstream:** record the concrete agreed shape and semantics (including applicable
  error, acknowledgement, retry, compatibility, and ownership rules) in a stable source and in
  each affected packet by exact reference/version or sufficient inline detail. Name producer,
  consumers, and how each verifies conformance. Parallel work is justified only if neither needs
  the other's implementation output to deliver its own Acceptance. A fixed shape alone does not
  remove an integration or migration prerequisite.
- **Ordered output:** identify the producer's bounded deliverable and completion evidence, then
  make each consumer depend on that producer: `dependentRef -> blockerRef`. Explain what the
  consumer cannot implement or verify without it. If the missing deliverable is a contract decision,
  a bounded discovery/contract issue may produce it; its acceptance must define how the decision
  becomes authoritative and is propagated before consumers start. A vague “coordinate” task
  is insufficient. The consumer is blocked, not parallel-ready.
- **Regroup:** when responsibilities require inseparable agreement or mutually dependent edits,
  propose one coherent issue. Preserve all Acceptance contributions and integrated verification,
  update references and edges, and remove self-edges introduced by regrouping. Existing issues
  are never closed, deleted, or replaced without an authorized concrete revision.
- **Independent edits:** even within one file, explain the separate symbols/responsibilities,
  unchanged shared invariants/interface, and why either change can deliver and be verified without
  the other's output. A possible textual merge conflict is not a semantic dependency. Conversely,
  disjoint files can still require ordering when they change the same protocol or state invariant.

If evidence or authority is missing, return the exact unresolved decision and affected issues
as `needs_changes`; do not guess an agreement. A proposed fix is not an applied or agreed fix.

## Validate the complete proposal

Check each interaction against every participating packet, its Acceptance, and the proposed
relations. Reject dangling “coordinate with X”, contradictory contracts, and unsupported claims
of independence. Ensure each edge has a necessary output; do not serialize by milestone, file,
team, or a blanket foundation phase. Check the complete affected dependency closure for cycles,
including existing edges and paths through issues outside the immediate edit. Missing relation
data leaves cycle verification unknown. Resolve mutual prerequisites by fixing the common
contract first or regrouping; never arbitrarily reverse an edge to make validation pass.

For a project graph supported by `scripts/project-graph.mjs`, run its existing `validate`
command (or `validate-envelope` for creation). It checks targets, direction shape, self-edges,
and cycles. No new graph fields are required: coordination decisions live in exact issue bodies,
and ordering lives in edges. Semantic completeness and edge justification remain reviewer work;
the validator does not inspect prose or discover missing dependencies. Inspect cross-project
closure separately rather than inserting unsupported external refs into that graph schema.

Return `COORDINATION_REVIEW: pass | needs_changes`, the reviewed interactions and evidence,
necessary edges or justified independence, cycle-check evidence/unknowns, and remaining decisions.
A pass means the proposal resolves coordination, not that proposed Linear changes already exist.
Include decisions in the complete preview and rerun affected review after any material revision.

## Existing projects and issues

Reload the affected issue bodies, relevant decision comments, live relations and their dependency
closure. Preserve issue ids, active Acceptance, completed work, and unrelated edges. Review the
current state first, then prepare an exact before/after correction proposal: affected bodies,
contract decisions, relation additions/removals with reasons, and any regrouping. A currently
unresolved project remains `needs_changes` even if the proposed correction passes review.

Creation skills use their review-only path for existing work; do not replay a creation cascade
or create replacement issues as a shortcut. Issue planning remains read-only toward Linear.
If application is outside the invoked workflow or authorization, return the concrete correction
for the owner to apply. After authorized application, require fresh readback of all affected
bodies and relations and recheck the closure before declaring the existing project ready.

**LINEAR REMAINS THE ONLY EXECUTION AUTHORITY.** Persist agreed contracts in the authorized Linear
bodies/references and actual ordering as blocking relations before delivery/Maestro handoff.
An unapplied proposal, local plan, or review report cannot repair Linear readiness. Maestro
continues selecting from live Linear statuses and blockers; it must not parse this review,
infer locks from common files, or discover additional runtime blockers.
