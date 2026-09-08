---
name: create-project
description: Use to create a Linear project with complete issue bodies, meaningful milestones, and justified dependencies from a spec, Acid Prophet artifact set, or product interview. Also reviews existing projects with a read-only correction preview. Reviews the full proposal before authorized writes, verifies the resulting graph, and resumes partial creation by exact markers.
argument-hint: "[spec-file] [--fresh]"
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent, ToolSearch
---

# linear-devotee:create-project

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Resolve `PLUGIN_ROOT` from this skill's directory (`../..`) when needed. Read
`../../shared/planning-context.md` and `../../shared/provider-selection.md`. The full project,
milestones, issues, and relations are one proposal. Standalone additions use their own skills;
a partial cascade resumes here.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Sources and working artifacts

For review or revision of an existing project, go to **Review an existing project** below;
skip creation-only metadata, markers, and mutation preparation. Source authority still applies.

Resolve the repository before accessing local state. Prefer the explicit named Acid Prophet
handoff: `SPEC_FILE`, `PLAN_FILE`, `CONTRACTS_DIR`, `QUICKSTART_FILE`, `CODEBASE_MAP_FILE`, and
`CONSTITUTION_FILE`. Preserve all six absolute paths, including `_none_` for absent optional
artifacts. Read every supplied artifact; a missing named path is a blocker. Use an applicable
constitution even when discovered in the repository rather than explicitly passed. A justified
empty contracts directory is valid.

Keep one readable working directory in runtime plugin data, or under the repository's ignored
`.nuthouse/<project-slug>/` when no runtime data directory is available. Hold the brief, Acceptance
register, full draft, `preview.md`, `graph.json`, and `envelope.json` there. They are the actual
proposal artifacts, not a second workflow database. Report these paths so a later invocation
can find the approved proposal without a Claude session id.

The compaction ledger is `.nuthouse/<project-slug>/progress.md`. Before writing local artifacts,
ensure `.nuthouse/` is git-ignored, using `.git/info/exclude` when necessary. Its header identifies
this proposal and the preview/envelope paths; append `project/<client_ref>: created`,
`milestone/<client_ref>: created`, `issue/<client_ref>: created`, and
`relation/<dependent_ref>-<blocker_ref>: created` immediately after each confirmed operation.
Keep any confirmed Linear id in the human-readable line. Never mark a timed-out write created.
A missing ledger means reload Linear; it never means existing writes may be replayed blindly.
A different proposal gets a separate ledger, not the prior proposal's completed lines.

## Establish the product and destination

Read the spec or existing brief first. Ask about unknown outcomes, users, failure/access policy,
constraints, boundaries, and success measures only where they change the proposal. A vague idea
may need a substantial interview; a detailed approved spec should not repeat it. Do not force a
fixed questionnaire or ask the user to select a project/team already specified.

Extract the source's active Acceptance section, excluding history. Preserve every `AC-###` id
and its exact criterion text, order, and meaning. For an idea without a register, write a proposed
brief and observable WHEN/IF → outcome criteria with stable ids. Resolve consequential product
questions before drafting dependent work. Include that proposed register in the complete
cascade preview so it can be approved together with the decomposition; do not require a
separate approval of each intermediate document. Existing approved source criteria stay intact.

Resolve the Linear team, a valid initial project status, and exact existing label names/ids.
Reuse current metadata and ask only for ambiguous selections. Prefer `backlog`, then `planned`,
by status type when the user has not specified a state; never fabricate a named status. Discover
the provider's actual create/relation operations before promising the cascade. Metadata limits
may still permit a local draft, but block writes until resolved.

## Review an existing project

When asked to review or revise an existing project, use the existing-work procedure in
`../../shared/coordination-review.md`. Collect current complete affected packets, decision
sources, and the dependency closure as raw `LINEAR_CONTEXT`. Dispatch `project-drafter` in
`MODE: review` with that snapshot as `DRAFT_FILE`; preserve existing ids as stable draft keys.
Supply its full input contract: the current project brief/spec, exact active Acceptance register,
repository root, and named source artifacts (absent optional artifacts are `_none_`). If there
is no project register, extract the existing issues' active criteria verbatim for review and
surface conflicting ids/text; do not invent or silently ratify a replacement source.
Return current-state findings and an exact correction preview, then stop this review-only path.
Do not enter creation, mint replacement refs, or mutate existing issues/relations. State whether
corrections are merely proposed; an unapplied correction cannot justify a Maestro handoff.

## Draft and review the complete decomposition

Dispatch `linear-devotee:project-drafter` with `MODE: draft`, `PROJECT_ROOT`,
`ACCEPTANCE_REGISTER`, all named artifact paths, `VIBE_BULLETS` when applicable, and current raw
`LINEAR_CONTEXT`. Relevant existing files are discovery hints, not cached proof of architecture.

Review the project brief, milestones, complete issue packets, and coverage table together:

- Every source criterion has a real delivering issue and observable verification. Shared criteria
  have explicit contributions and an owner for final integrated verification.
- Each issue can be understood and reviewed as a coherent deliverable. Foundation-only issues
  identify enabled work and verify their own output. Do not impose an issue-count cap or phase
  threshold, and do not replace complete packets with titles to expand after approval.
- Every dependency names the output the dependent actually needs. The direction is always
  `dependentRef -> blockerRef`. Milestone ordering alone does not create a dependency.
- Apply `../../shared/coordination-review.md` to all interacting packets. Require a complete
  `COORDINATION_REVIEW: pass`, including justified independence and cycle evidence. Include the
  resolved Coordination sections in the exact issue bodies; missing decisions block readiness.
- Source wording, constraints, constitution, and validated architecture remain consistent.
  Optional blanks are not blockers; consequential `_unclear_` decisions are.

For multiple interacting issues, shared criteria, or substantial architecture, get a fresh
`linear-devotee:project-drafter` in `MODE: review` with `DRAFT_FILE` and the raw sources. Keep the
author's preferred verdict out of the review prompt. A small independent one-issue proposal can
be reviewed locally. Correct supported findings; after three unsuccessful review rounds, stop
with the unresolved decision/evidence instead of looping or silently shrinking scope.

## Prepare the exact preview

Mint stable `client_ref` UUIDs for project, milestones, and issues; retain draft keys and refs
through revisions. Resolve milestone names and dependency draft keys to those refs before
preview. Resolve labels to exact ids now; explain omitted unsupported suggestions, and resolve
explicitly requested unknown labels. Never drop an approved label during mutation.

Include `<!-- nuthouse-client-ref: <client_ref> -->` in every exact description. Foundation-only
issues also include `<!-- nuthouse-foundation-reason: <base64url UTF-8 reason> -->`; use the
existing `foundationReasonMarker` helper for this graph field. Markers belong in the preview,
not an addition made after approval.

Build `graph.json` using the existing graph contract: `schemaVersion: 1`, one project
(`clientRef`, `teamId`, `title`), milestones (`clientRef`, `projectRef`, `title`), issues
(`clientRef`, `projectRef`, nullable `milestoneRef`, `title`, `acceptanceIds`, optional
`foundationReason`), and edges (`dependentRef`, `blockerRef`). Foundation-only issues have
`acceptanceIds: []`; others use their assigned ids. Include it in the envelope below;
`validate-envelope` already validates the embedded graph, so no separate graph-validation
pass is needed. Source coverage and behavioral review remain the agent's job.

Build `envelope.json` with the exact fields accepted by that existing helper:

- `schemaVersion: 1` and `graph: <validated graph>`.
- `project`: `clientRef`, `name`, full marked `description`, `teamIds`, `statusId`.
- `milestones`: `clientRef`, `projectRef`, `name`, full marked `description`, nullable `targetDate`.
- `issues`: `clientRef`, `draftKey`, `projectRef`, nullable `milestoneRef`, `teamId`, `title`,
  full marked `description`, `labelIds`, `blockedByRefs`.

Run `node ${PLUGIN_ROOT}/scripts/project-graph.mjs validate-envelope <envelope-file>` and use its
canonical `envelope`. Validation errors block approval. Render `preview.md` from that envelope:
all complete descriptions, names, memberships, dates, labels, relations, source paths/register,
and canonical JSON must be visible and agree. Include the returned payload hash so the exact
reviewed content is identifiable. Do not independently edit a friendly summary into a different
payload. Include any proposed source-link update in the preview scope.

## Authorize and write

Show the whole preview and consequential decisions. If explicit authorization already covers
this exact scope and delegated choices, continue; otherwise ask for approval of the complete
cascade. No per-resource confirmations follow. Edits require revalidation and a consistent new
preview before writing; prior approval of different content is not reusable.

Immediately before the first write and on resume, reread sources, the approved preview, and
validated envelope. Require the canonical content and its payload hash to match the approved
preview. Changed source decisions or changed payload require a revised, reviewed proposal;
never reconstruct an approved body from memory or fabricate approval after compaction.

Create project, then milestones, then issues in topological dependency order. Project every
argument from the canonical envelope. Resolve each membership/blocker ref to exactly one
confirmed Linear id; missing mappings stop before that write. Use the previewed label ids and
complete bodies. An entity's creation enables id resolution; it does not mean its work is done.

Create blocking relations through the available provider operation. If a separate relation
post-pass is needed, keep the cascade incomplete until all approved edges are confirmed. Do
not retry issue creation without an unsupported field after an ambiguous error. Report the
actual response and recover by marker first. Update the ledger immediately after each confirmed
entity/relation. Never expand scope, silently adjust rejected fields, or roll back earlier writes
as an improvised transaction.

## Resume and verify

On partial failure, retain exact preview/envelope and ledger paths. The next invocation reads
those same artifacts and dispatches `linear-devotee:project-graph-loader` with `ENVELOPE_FILE`,
`PROJECT_CLIENT_REF`, `TEAM_ID`, and confirmed `PROJECT_ID` or `_unknown_`.
The loader reads that same approved envelope directly.

Reconcile ledger entries with the authoritative reload. Retry only operations confirmed absent;
unknown pagination, missing relation data, conflicting markers, or uncertain write outcomes
remain unresolved. Reuse confirmed entities even if the local ledger missed their creation.
When creation is complete but verification failed, resume that remaining step;
do not report already completed merely because all entity lines exist.

After creation, use one complete fresh loader result for both graph and field verification; do
not fetch the same resources again when the loader already supplied the required evidence. Run
`node ${PLUGIN_ROOT}/scripts/project-graph.mjs compare <approved-graph-file> <actual-graph-file>`.
Zero differences establishes graph equivalence; it does not prove description, label, date, or
status equality. Inspect the loader's field comparison and report any discrepancy against the
preview without overwriting it automatically. Its `fieldsVerified` must be true with
no field differences or unknowns before execution is ready. Changed Acceptance text under the
same id is a blocker even when the graph matches. Keep `field_verification_failed` visible and
withhold delivery/Maestro handoff until the discrepancy is resolved.

Successful graph comparison and field verification establish the creation result. Report that
evidence in the final handoff and retain it with the local proposal when needed for resume.
Subsequent work selection uses live Linear status and blockers.

If source linkage was included in the approved scope, update only the source's
`linear-project` value after verified creation. Preserve ratification status, Acceptance,
source version, and review metadata; creating Linear resources is not a fresh spec audit.

## Finish

Report project/link, created vs total milestones/issues, criterion coverage, graph and field
verification results, and any exact failure. For partial work, include the saved artifact/ledger
paths and the operation still unresolved; recovery uses this skill, never standalone creation.

Recommend a next issue only after verified creation and from live status/blocker evidence.
A blocker having a Linear id is not satisfied; startable work has no unfinished blockers. Use
`linear-devotee:next-issue` when selection needs further context. Show
`monkey-maestro:start <project-id>` only after a passing coordination review and verified Linear bodies and graph. Continue into delivery or Maestro
only if the user already requested it; otherwise finish with the useful recommendation.

Never commit, push, rebase, recreate confirmed resources, or mutate unrelated Linear work.
