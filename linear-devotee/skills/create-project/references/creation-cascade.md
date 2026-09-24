# Linear project creation cascade

Before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`.

## Contents

- Product and destination
- Draft and review
- Exact preview
- Authorization and writes
- Resume and verification

## Product and destination

Ask only about unknown outcomes, users, access/failure policy, constraints, boundaries, and success
measures that change the proposal. Do not repeat a complete approved spec or force a fixed
questionnaire.

Resolve the exact Linear team, a valid initial project status, and existing label ids. Reuse named
metadata; when unspecified prefer status type `backlog`, then `planned`, without fabricating a
display name. Discover actual create and relation operations before promising writes. Tool limits
may permit drafting but block mutation.

The active Acceptance section excludes history. Preserve every `AC-###` id, exact text, order, and
meaning. Proposed criteria for a new idea use observable WHEN/IF → outcome phrasing and stable ids.

## Draft and review

Dispatch `linear-devotee:project-drafter` in `MODE: draft` with `PROJECT_ROOT`,
`ACCEPTANCE_REGISTER`, named artifact paths, optional `VIBE_BULLETS`, and raw `LINEAR_CONTEXT`.
Existing files are discovery hints, not cached architectural proof.

Review the brief, milestones, full issue packets, and coverage table together:

- Every criterion has a delivering issue and observable verification. Shared criteria name each
  contribution and the final integration owner.
- Each issue is a coherent deliverable. Foundation-only work names the work it enables and proves
  its own output; do not replace full packets with titles or impose an issue-count cap.
- Every dependency names the exact required output and points `dependentRef -> blockerRef`.
  Milestone order alone is not a dependency.
- Apply `${CLAUDE_PLUGIN_ROOT}/shared/coordination-review.md` to interacting packets. Require a complete passing
  review, justified independence, and cycle evidence; put resolved Coordination sections in the
  actual issue bodies.
- Source wording, constitution, constraints, and validated architecture stay consistent.
  Consequential `_unclear_` items block readiness; optional blanks do not.

For interacting issues, shared criteria, or substantial architecture, run a fresh drafter in
`MODE: review` without the author's verdict. A small independent one-issue proposal may be reviewed
locally. After three unsuccessful review rounds, stop with the unresolved evidence or decision.

## Exact preview

Mint stable UUID `client_ref` values for project, milestones, and issues and retain draft keys across
revisions. Resolve labels and dependency keys before preview. Include
`<!-- nuthouse-client-ref: <client_ref> -->` in every description. Foundation-only issues also use
the existing base64url foundation-reason marker helper.

Build `graph.json` with `schemaVersion: 1`, one project, milestones, issues (including
`acceptanceIds` and optional `foundationReason`), and `dependentRef`/`blockerRef` edges.

Build `envelope.json` with that graph plus exact provider payloads:

- project: client ref, name, marked description, team ids, status id;
- milestones: refs, name, marked description, nullable target date;
- issues: refs, draft key, team, title, marked description, label ids, blocked-by refs.

Run `node ${PLUGIN_ROOT}/scripts/project-graph.mjs validate-envelope <file>` and use its canonical
envelope. Render every complete field and the returned payload hash in `preview.md`; do not maintain
a friendly summary that can diverge from the payload. Include source/register paths and any proposed
source-link update.

## Authorization and writes

Immediately before the first write or a resume, reread the sources, approved preview, and validated
envelope. Require the canonical payload hash to match. Create project, milestones, then issues in
topological dependency order, projecting every argument from the envelope. Resolve each ref to one
confirmed Linear id before dependent writes.

Create every approved blocking relation. A post-pass leaves the cascade incomplete until all edges
confirm. Never retry an ambiguous creation without a field; recover by marker first. Append a
human-readable confirmed id to `progress.md` immediately after each confirmed entity or relation.
Never mark a timeout as created or improvise rollback of earlier successful writes.

## Resume and verification

On partial failure retain the exact preview, envelope, graph, and ledger. Dispatch
`linear-devotee:project-graph-loader` with `ENVELOPE_FILE`, project client ref, team id, and confirmed
project id or `_unknown_`. Reconcile the ledger against its authoritative result and retry only
operations proven absent. Unknown pagination, missing relation data, conflicting markers, or
uncertain outcomes remain unresolved.

Use one fresh loader result for graph and field verification. Run
`node ${PLUGIN_ROOT}/scripts/project-graph.mjs compare <approved-graph> <actual-graph>` and require
zero graph differences plus `fieldsVerified: true` with no unknowns or field differences. Changed
Acceptance text under the same id is a blocker. Never overwrite a discrepancy automatically.

Update a source `linear-project` link only when that edit was in the approved preview and creation
fully verifies. Preserve ratification, Acceptance, source version, and review metadata.
