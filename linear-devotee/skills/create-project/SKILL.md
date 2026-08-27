---
name: create-project
description: Use when creating a Linear Project end-to-end from an Acid Prophet artifact set, a spec file, or vibe-mode Q&A. Drafts the project plus complete traceable issue packets and their dependency graph before one approval gate, then batch-creates everything on Linear and recommends the first startable issue. Supports idempotent resume after partial failure.
argument-hint: "[spec-file] [--fresh]"
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write, Agent, mcp__claude_ai_Linear__list_teams, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_project, mcp__claude_ai_Linear__save_milestone, mcp__claude_ai_Linear__save_issue, mcp__claude_ai_Linear__save_comment
---

# linear-devotee:create-project

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Mode

**Full-cascade mode by default.** This skill drafts the project, its milestones, and complete issue bodies up front, validates Acceptance coverage plus the dependency graph, canonicalizes a complete mutation envelope containing every field later sent to Linear, presents its SHA-256 hash at one global preview, asks **a single approval gate bound to that hash**, then batch-creates exactly those approved bodies and relations on Linear in topological order. It reloads Linear and publishes a separately hash-bound verified graph receipt before any Maestro activation is allowed. On success it recommends the first unblocked created issue to start, but does not invoke `linear-devotee:greet` automatically.

`linear-devotee:create-milestone` and `linear-devotee:create-issue` remain invocable standalone (add-on use cases) and double as **resume tools** when this skill's batch commit fails partway — they detect the chain-state file and pick up at the first `id: null` entry.

## Workflow

0. Session store: if `$CLAUDE_SESSION_ID` is set and `$ARGUMENTS` does not contain `--fresh`, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`.
   - If `acid-prophet.handoff_spec` is present and `acid-prophet._handoff_spec_path` equals `spec_path` (i.e. not stale), default to **file mode** with `handoff_spec.path` — skip asking the user. Announce: "using spec from session store: `<path>`".
   - If the store is absent, corrupt, or `handoff_spec` is stale, proceed normally (ask user).
   - When the invocation includes the named Acid Prophet fields `SPEC_FILE`, `PLAN_FILE`, `CONTRACTS_DIR`, `QUICKSTART_FILE`, `CODEBASE_MAP_FILE`, prefer those explicit values over session state and preserve all five as `ARTIFACT_SET`.

1. Resume detection: read `${CLAUDE_PLUGIN_DATA}/chain-${CLAUDE_SESSION_ID}.json` if present.
   - If `phase: "committing" | "partial_failure" | "written"` and `project.id` exists: require `mutation_envelope`, `normalized_graph`, `payload_hash`, `approved_payload_hash`, `graph_hash`, and every pending issue's non-empty pre-approved `sdd_body`. Revalidate the complete envelope before any read or retry. Dispatch `linear-devotee:project-graph-loader` before retrying. Merge only exact marker/id and relation confirmations into `confirmed_operations`, fill matching null ids, remove confirmed edges from `blocked_by_pending`, and persist. Retry only operations still absent from this authoritative reload. Announce "resuming partial cascade" with confirmed vs pending counts, then skip to **step 9 (batch commit)**. If the loader reports unknown data, stop `resume_state_unknown`; if a legacy entry lacks the envelope/graph/hash/body fields, stop with `legacy_issue_body_missing` and route it through `linear-devotee:create-issue`. Never generate an issue body or retry an unclassified write after the cascade approval gate.
   - If `phase: "committed"`: warn the user that the cascade already completed for this session and exit `already-committed`. Suggest `--fresh` to start a new cascade.
   - Otherwise: continue from step 2.

2. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`; abort clearly if unavailable.
   - Verify git repo with `git rev-parse --is-inside-work-tree`.
   - Ensure `${CLAUDE_PLUGIN_DATA}` exists.

3. Input mode:
   - **Artifact-set mode**: named `SPEC_FILE` / `PLAN_FILE` / `CONTRACTS_DIR` / `QUICKSTART_FILE` / `CODEBASE_MAP_FILE` fields were passed. Verify every non-`_none_` path exists, read the spec first, summarize the set in one paragraph, and continue without dropping optional artifacts.
   - **File mode**: `$ARGUMENTS` contains a path to an existing `.md` (or one was auto-detected from the session store in step 0); read it, summarize in one paragraph, confirm.
   - **Vibe mode**: ask one at a time — north star, why now, measurable outcomes, constraints, out of scope. Turn each observable outcome into a stable EARS criterion (`[AC-001] WHEN|IF ..., THE SYSTEM SHALL ...`), show the compact Acceptance register, and ask the user to approve or revise it. Persist the approved Q&A plus register to `${CLAUDE_PLUGIN_DATA}/vibe-${CLAUDE_SESSION_ID}.txt`. Never invent or silently renumber ids.

4. Linear workspace:
   - Fetch teams with `list_teams` and existing project statuses with `list_projects`.
   - If multiple teams, ask user to choose.
   - Fetch the chosen team's existing issue labels with `list_issue_labels`. Capture an immutable `LABEL_MAP` of exact label name → id before drafting and approval; never create labels implicitly.
   - Pick initial project status by `status.type`: prefer `backlog`, fallback `planned`; never hardcode status names.

5. Draft project + decomposition:
   - If session store was read in step 0 and `relevant_files` is present, include it in the prompt.
   - Dispatch the logical `linear-devotee:project-drafter` agent with:
     ```text
     SPEC_FILE: <abs path | _none_>
     PLAN_FILE: <abs path | _none_>
     CONTRACTS_DIR: <abs path | _none_>
     QUICKSTART_FILE: <abs path | _none_>
     CODEBASE_MAP_FILE: <abs path | _none_>
     VIBE_BULLETS: <abs path | _none_>
     PROJECT_ROOT: <git root>
     RELEVANT_FILES:
     - <abs path> (omit section when not available from session store)
     ```
   - Capture the returned Project-SDD, decomposition (`flat | phased`), milestones, and complete `## Issue packets` in dependency order. Each packet is the future Linear description, not a title-only placeholder.

6. Clarify:
   - Scan `_unclear_` and `Suggested clarifying questions` across the whole draft (project + milestones + issues).
   - Ask one blocking question at a time, patch the draft, repeat until clean or user ships as-is.
   - Run the traceability pre-flight before preview:
     - every source `AC-###` is covered by at least one issue packet;
     - every non-foundation issue covers at least one known source id;
     - every `foundation` issue has a concrete `foundation-reason`;
     - every `draft-key` is unique and every `depends-on` target exists;
     - the dependency graph is acyclic.
   - Materialize the exact `normalized_graph` contract with every dependency represented as `dependentRef -> blockerRef`. Every issue has `acceptanceIds`; a foundation-only issue uses `acceptanceIds: []` plus its non-empty `foundationReason`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate <graph-file>`. This executable gate additionally rejects unknown targets, self-edges, duplicate edges, cross-project membership, invalid/legacy direction, cycles, unknown milestones, missing coverage, and mixed Acceptance/foundation coverage. Any failure is blocking and must identify the exact entity or relation. Repair the owning issue packet or source spec, then repeat this pre-flight. Never create or renumber an `AC-###` id in this skill.

7. Assign client refs and write the preview file:
   - Mint a stable `client_ref` (UUID v4) for the project, every drafted milestone, and every drafted issue. These refs are the only stable identifiers until Linear assigns real ids; they unlock idempotent recovery on partial failure.
   - Resolve each issue packet's exact `milestone` name to one drafted milestone and persist that milestone's `client_ref` as `milestone_client_ref`. `_none_` maps to `null`. Missing or duplicate milestone-name matches are blocking preview errors; never defer this resolution to the mutation phase.
   - Resolve every `suggested-labels` name against the pre-approval `LABEL_MAP`. Before writing the preview, warn and drop unknown names, then persist both the approved names and their exact ids. The mutation phase must replay those ids; it does not reinterpret drafter suggestions.
   - Add the stable marker `<!-- nuthouse-client-ref: <client_ref> -->` to the exact approved project, milestone, and issue descriptions. For a foundation-only issue also add `<!-- nuthouse-foundation-reason: <base64url UTF-8 reason> -->`. These markers are part of the previewed payload and are the only safe correlation keys after an ambiguous Linear timeout or authoritative reload; never add them after approval.
   - Write the canonical graph validator output to `${CLAUDE_PLUGIN_DATA}/graph-${CLAUDE_SESSION_ID}.json` as `normalized_graph` and capture its `graphHash` as `graph_hash`.
   - Materialize `${CLAUDE_PLUGIN_DATA}/envelope-${CLAUDE_SESSION_ID}.json` with schema version 1, the whole `normalized_graph`, and the exact project/milestone/issue mutation fields: project `clientRef`, `name`, full marked `description`, `teamIds`, `statusId`; milestone `clientRef`, `projectRef`, `name`, full marked `description`, `targetDate`; issue `clientRef`, `draftKey`, `projectRef`, nullable `milestoneRef`, `teamId`, `title`, full marked `description`, exact `labelIds`, and `blockedByRefs`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate-envelope <envelope-file>`. Persist its canonical `envelope` as `mutation_envelope`, its `payloadHash` as `payload_hash`, and require its `graphHash` to equal `graph_hash`. Re-run both validations after every preview edit; if canonical content changes, replace both files and hashes before re-asking for approval.
   - Write `${CLAUDE_PLUGIN_DATA}/preview-${CLAUDE_SESSION_ID}.md` containing the full editable preview:

     ```markdown
     # Cascade preview — <project name>

     <project SDD body, unchanged from drafter>

     <!-- nuthouse-client-ref: <project uuid> -->

     **Approved mutation payload hash:** `sha256:<64 lowercase hex>`
     **Verified graph hash:** `sha256:<64 lowercase hex>`

     ## Milestones

     ### Phase 1: <name> <!-- client_ref: <uuid> -->

     - Scope: <one line>
     - Target date: <YYYY-MM-DD | none>

     ### Phase 2: …

     ## Issues

     ### <issue title> <!-- draft_key: I-001 · client_ref: <uuid> -->

     - Milestone: <name | none>
     - Depends on: <client_ref list | none>
     - Covers: AC-001, AC-002 | foundation
     - Foundation reason: <text | n/a>
     - Suggested labels: <existing labels | none>

     <the complete Goal / Context / Files referenced / Constraints /
     Acceptance criteria / Non-goals body from the issue packet>

     <!-- nuthouse-client-ref: <issue uuid> -->
     ```

   - The HTML comments are load-bearing — they tie each preview entry to its stable draft key and `client_ref` so an edited file can be re-parsed without losing identity. Map `depends-on` draft keys to client refs before writing.

8. Preview and approve:
   - Print every project, milestone, issue, normalized dependency, the exact `payload_hash` and `graph_hash`, plus project name, team, status, counts, and `Preview written to: <path>`.
   - Ask `Create everything on Linear? (y / edit / cancel)`.
   - On `edit`: instruct the user to edit `<preview path>` directly. After they signal done, re-parse the file (preserving `client_ref` comments; new entries get a fresh ref, removed entries are dropped), re-run the complete traceability/dependency pre-flight from step 6 plus milestone and label resolution from step 7, re-print the summary, and re-ask. Loop until `y` or `cancel`.
   - On `cancel`: write chain-state with `phase: "cancelled"` and stop with `cancelled`.
   - Continue only on `y`. Immediately persist `approved_payload_hash: <payload_hash>` plus immutable copies of `mutation_envelope` and `normalized_graph` in chain-state. Before the first and every resumed mutation, run `validate-envelope` again and require its `payloadHash` to equal both `payload_hash` and `approved_payload_hash`, and its `graphHash` to equal `graph_hash`; otherwise stop `approval_hash_mismatch` and return to preview. No further per-resource gate after this point.

9. Batch commit (the one place we mutate Linear):
   - Write chain-state immediately with `phase: "committing"` so a crash mid-flight is recoverable. Schema:
     ```json
     {
       "current": "create-project",
       "phase": "committing | partial_failure | written | committed | cancelled",
       "project": {
         "client_ref": "<uuid>",
         "id": "<linear id or null>",
         "url": "<url or null>",
         "name": "<name>",
         "team_id": "<team.id>",
         "team_key": "<team.key>",
         "description": "<exact approved marked Project-SDD body>",
         "status_id": "<approved status id>"
       },
       "drafts": {
         "decomposition": "flat | phased",
         "milestones": [
           {
             "client_ref": "<uuid>",
             "id": "<id or null>",
             "name": "<name>",
             "scope": "<one line>",
             "description": "<exact approved marked scope>",
             "target_date": "<YYYY-MM-DD or null>",
             "url": "<url or null>"
           }
         ],
         "issues": [
           {
             "client_ref": "<uuid>",
             "draft_key": "I-001",
             "id": "<id or null>",
             "identifier": "<TEAM-N or null>",
             "title": "<title>",
             "milestone_client_ref": "<uuid>",
             "blocked_by_refs": ["<uuid>"],
             "acceptance_refs": ["AC-001", "AC-002"],
             "foundation_reason": "<string or null>",
             "suggested_label_names": ["<existing label name>"],
             "label_ids": ["<pre-approved label id>"],
             "sdd_body": "<exact approved Goal/Context/Files/Constraints/Acceptance/Non-goals markdown>",
             "url": "<url or null>"
           }
         ]
       },
       "preview_file": "<abs path>",
       "spec_file": "<abs path | _none_>",
       "source_acceptance_ids": ["AC-001", "AC-002"],
       "normalized_graph": {
         "schemaVersion": 1,
         "project": {},
         "milestones": [],
         "issues": [],
         "edges": []
       },
       "mutation_envelope": {
         "schemaVersion": 1,
         "graph": {},
         "project": {},
         "milestones": [],
         "issues": []
       },
       "graph_file": "<abs path to graph json>",
       "envelope_file": "<abs path to complete mutation envelope json>",
       "graph_hash": "sha256:<graph hash>",
       "payload_hash": "sha256:<64 lowercase hex>",
       "approved_payload_hash": "sha256:<same exact hash>",
       "confirmed_operations": [],
       "blocked_by_pending": [],
       "graph_receipt": {
         "marker": "nuthouse:project-graph-receipt",
         "schema_version": 1,
         "verified": false,
         "approved_hash": "sha256:<graph hash>",
         "actual_hash": null,
         "differences": [],
         "verified_at": null,
         "linear_comment_id": null
       },
       "created_at": "<ISO 8601>",
       "last_error": null
     }
     ```
   - **Approval invariant**: run `project-graph.mjs validate-envelope` on `mutation_envelope` and require the returned `payloadHash` to equal both `payload_hash` and `approved_payload_hash`, the returned `graphHash` to equal `graph_hash`, and the returned canonical graph to equal `normalized_graph`. A mismatch stops before Linear mutation. Every `save_*` argument and relation below must be projected directly from that freshly validated envelope; duplicated convenience fields in chain-state are indexes only and may never override it.
   - **Idempotency rule**: `confirmed_operations` is an append-only ledger keyed by `<kind>:<client_ref>` and `relation:<dependent_ref><-<blocker_ref>`. At every sub-step, skip an operation confirmed either by a successful response already persisted or by the resume loader's exact Linear marker/relation reload. `id != null` is a required projection of that ledger, not the only retry guard. Re-invocations replay only operations not confirmed by Linear.
   - **9.a — Project**: if `project:<client_ref>` is unconfirmed, call `save_project` with the envelope project's exact `name`, `description`, `teamIds`, and `statusId`. On success, persist `id` + `url` and the confirmed operation before continuing. On timeout or API error, set `phase: "partial_failure"`, surface verbatim, and stop; the next invocation reloads the marker before deciding whether a retry is safe.
   - **9.b — Milestones (in `drafts.milestones[]` order)**: for each unconfirmed `milestone:<client_ref>`, locate exactly one same-ref envelope milestone and call `save_milestone` with its exact `name`, resolved `projectId`, `description`, and nullable `targetDate`. Persist `id` + `url` and its confirmed operation per entry. On error: persist, set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.c — Issues (topological order on `blocked_by_refs`)**: process only entries whose `blocked_by_refs` already resolve to created issues. For each:
     - Require the pre-approved `sdd_body`, `acceptance_refs`, and dependency fields persisted from the preview. If any are missing, set `phase: "partial_failure"`, set `last_error: "approved issue packet missing"`, and stop before this issue. Do not draft or expand content inside the mutation phase.
     - Resolve `milestone_client_ref` to exactly one entry in `drafts.milestones[]` and require that entry's `id` is non-null. Pass that id as `projectMilestoneId`. When `milestone_client_ref` is `null` / `_none_`, omit `projectMilestoneId`. A missing, duplicate, or uncreated reference sets `phase: "partial_failure"`, sets `last_error: "milestone_reference_unresolved"`, and stops before this issue; never guess from milestone name or array position.
     - Resolve every `blocked_by_ref` to exactly one created issue identifier. Any unresolved or duplicate mapping sets `phase: "partial_failure"`, sets `last_error: "dependency_reference_unresolved"`, and stops before mutation; never drop, guess, or defer an approved dependency silently.
     - Use the envelope issue's exact `labelIds`; do not refetch or reinterpret labels after approval. A current-schema state whose duplicated `label_ids` projection differs is `approval_hash_mismatch`. Legacy pending state without a complete mutation envelope is not replayable; never repair it by resolving labels after approval.
     - Call `save_issue` with the envelope issue's exact `teamId`, `title`, `description`, resolved `projectId`, resolved `projectMilestoneId`, exact `labelIds`, and `blockedBy` resolved only from its envelope `blockedByRefs`.
     - **`blockedBy` runtime guard**: if `save_issue` rejects `blockedBy` with a schema error, retry once without `blockedBy`, then append `{from_ref, to_ref}` edges to `blocked_by_pending` for a post-pass.
     - Persist `id`, `identifier`, `url`, and `issue:<client_ref>` in `confirmed_operations` per entry before continuing.
     - On API error: set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.d — `blocked_by_pending` post-pass**: for each unconfirmed normalized edge call the Linear relation mutation exposed by the provider. On success, persist `relation:<dependent_ref><-<blocker_ref>` before dropping it from `blocked_by_pending`. A relation failure leaves `phase: "partial_failure"`; it is recoverable, but graph verification cannot pass and Maestro activation remains forbidden.
   - **9.e — authoritative reload and exact verification**: only after every entity and relation operation is confirmed, set `phase: "written"`, dispatch `linear-devotee:project-graph-loader`, and require `complete: true`. Write its `graph` to a scratch JSON and run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs compare <approved-graph> <actual-graph>`. Require the returned `approvedHash` to equal `graph_hash`, store its returned `actualHash`, copy every missing/extra/changed/reversed difference, and keep `"verified": false` on any loader unknown, hash mismatch, invalid actual graph, or comparison difference. Never compare the graph hash to the separate mutation `approved_payload_hash`, and never mutate Linear to paper over drift.
   - **9.f — durable verification receipt**: use the loader's exact client-ref → Linear-id map to add `decision_baseline: { issueIds, edges: [{ dependentIssueId, blockerIssueId }] }` to the receipt; this is the durable payload later bound by Maestro's `decision_hash`. Build a project comment headed `<!-- nuthouse:project-graph-receipt schema_version=1 -->` with `approved_hash`, `actual_hash`, `verified`, `differences`, `decision_baseline`, and timestamp. Write it through `save_comment(projectId: ...)`. Only an equivalent graph whose receipt comment succeeded becomes `graph_receipt.verified: true` and `phase: "committed"`. A failed comment write leaves `phase: "written"`, reports `verification_record_failed`, and refuses Maestro activation.

10. Patch source spec frontmatter when `SPEC_FILE` exists and `graph_receipt.verified === true`:
    - `linear-project: <project.id>`
    - `status: ready`
    - `last-reviewed: <today ISO date>`
    - Warn, do not abort, if frontmatter patch fails.
    - Do not alter Acceptance ids or bodies. The created issues already carry the approved `AC-###` references.

11. Recommend first issue:
    - On `phase: "committed"` and at least one created issue: pick the first startable issue (`drafts.issues[]` filtered by `id != null`, sorted by topological commit order, preferring entries with no `blocked_by_refs`; if every issue is blocked, pick the first issue whose blockers all have created Linear identifiers and clearly label that dependency assumption). Print `Recommended next issue: <identifier> - <title> - <url>`, `Start with: linear-devotee:greet <identifier>`, and `Project execution: monkey-maestro:start <project.id>`. The Maestro line is permitted only when `graph_receipt.verified === true`; otherwise print `Project execution: refused — graph unverified`. Do **not** write greet state, invoke `linear-devotee:greet`, invoke `linear-devotee:plan`, invoke Maestro, or continue automatically.
    - On `phase: "partial_failure"`: stop with a structured resume report (see Final Report). Do **not** chain.
    - On `phase: "cancelled"` or `already-committed`: stop.

## Final Report

```text
linear-devotee:create-project report
  Project:           <name> - <url | (not created)>
  Team:              <team.key>
  Status:            <status.name> (<status.type>)
  Decomposition:     <flat: N | phased: M phases>
  Milestones:        <created>/<total>
  Issues:            <created>/<total>
  AC coverage:       <covered>/<source total> · <N foundation issues>
  Approved hash:     <sha256:... | _none_>
  Graph hash:        <sha256:... | _none_>
  Graph verification:<verified | unverified | not-run> · <N differences>
  Phase:             committed | written | partial_failure | cancelled | already-committed
  Last error:        <verbatim Linear error | _none_>
  Preview file:      <abs path>
  Chain state:       ${CLAUDE_PLUGIN_DATA}/chain-<session>.json
  Recommended next:  <identifier> - <title> - <url | _none_>
  Hand-off:          user-starts-greet <identifier> + optional monkey-maestro:start <project.id> | resume via create-milestone / create-issue | stop | cancelled | linear_error | graph_unverified
```

## Never

- Mutate Linear before the user types `y` at the single approval gate.
- Draft, expand, or materially rewrite an issue body after the single approval gate.
- Create an issue when its `sdd_body`, `acceptance_refs`, or dependency record is missing.
- Add per-resource `(y)` gates inside the batch commit phase — the single global gate is the contract.
- Drop or rewrite a `client_ref` once minted — they are the recovery keys.
- Retry failed Linear writes blindly inside one cascade (the resume path handles retries on the next invocation, after the user knows).
- Treat a local id or title match as confirmation after an ambiguous write; require the exact `nuthouse-client-ref` marker or relation reload and append it to `confirmed_operations`.
- Mark a project verified, patch its source spec, or offer `monkey-maestro:start` unless exact comparison and the durable receipt comment both succeeded; otherwise refuse Maestro activation.
- Auto-rollback created entries on partial failure — Linear has no transaction; leave them and let the user decide.
- Run `git push`, `git commit`, or `git rebase`.
- Write outside plugin `data/`, except the confirmed spec frontmatter patch.
- Invoke another skill programmatically after the cascade commits.
