---
name: create-project
description: Use when creating a Linear Project end-to-end from an Acid Prophet artifact set, a spec file, or vibe-mode Q&A. Drafts the project plus complete traceable issue packets and their dependency graph before one approval gate, then batch-creates everything on Linear and recommends the first startable issue. Supports idempotent resume after partial failure.
argument-hint: "[spec-file] [--fresh]"
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write, Agent, mcp__claude_ai_Linear__list_teams, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_project, mcp__claude_ai_Linear__save_milestone, mcp__claude_ai_Linear__save_issue, mcp__claude_ai_Linear__save_comment
---

# linear-devotee:create-project

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Mode

**Full-cascade mode by default.** This skill drafts the project, its milestones, and complete issue bodies up front, validates Acceptance coverage plus the dependency graph, renders one complete cascade preview, asks **a single approval gate on that preview**, then batch-creates exactly those approved bodies and relations on Linear in topological order. It reloads Linear and publishes a verified graph receipt before any Maestro activation is allowed. On success it recommends the first unblocked created issue to start, but does not invoke `linear-devotee:greet` automatically.

`linear-devotee:create-milestone` and `linear-devotee:create-issue` remain invocable standalone. A
partially committed cascade resumes only by reinvoking `linear-devotee:create-project`, which
revalidates the source artifacts, the Acceptance register, and the approved preview before any retry.

## Source artifacts

Every artifact travels by **absolute path**. A caller may name any of `SPEC_FILE`, `PLAN_FILE`,
`CONTRACTS_DIR`, `QUICKSTART_FILE`, `CODEBASE_MAP_FILE`, and `CONSTITUTION_FILE`; `_none_` is
explicit absence. For each named artifact, require the path to exist and be readable before
drafting; a missing artifact blocks. Never substitute a prose summary for a path, and never treat
a path that failed to open as present.

The Acceptance register is the one source register this skill freezes: it is extracted once, shown
to the user, and approved before drafting. Never renumber, replace, or silently synthesize an
accepted `AC-###` id.

## The cascade ledger

The only state that must survive a compaction is _which entities already exist on Linear_. It lives
in one plain markdown file at `${PROJECT_ROOT}/.nuthouse/<project-slug>/progress.md`:

```text
# ledger — project: <project name> — envelope: <envelope client_ref>
project/<client_ref>: created            # <project name>
milestone/<client_ref>: created          # Phase 1 — foundations
issue/<client_ref>: created              # Wire the ingest route
relation/<dependent client_ref>-<blocker client_ref>: created
```

Every line is keyed by the `client_ref` minted at drafting, never by a human name — two issues may
legitimately share a title, and a title match is explicitly forbidden as confirmation (see `## Never`).
The trailing `#` comment is for the human reader and is never parsed.

The first line binds the ledger to one approved envelope. Every created entity appends exactly one
`<type>/<client_ref>: created` line, written immediately after Linear confirms that entity — never
before, never batched at the end. On resume, re-read the ledger and restart at the first entity of
the approved preview whose `client_ref` has no line.

**A ledger whose header names a different envelope than the one just approved is stale**: a previous
cascade was abandoned and redrafted, and its `created` lines would silently suppress mutations of the
new one. Move it aside to `progress-<timestamp>.md` and start a fresh ledger. Never append a new
cascade's lines under an old header.

The ledger lives in the **user's** repository, not in nuthouse. Before writing it, ensure
`.nuthouse/` is ignored there: if `${PROJECT_ROOT}/.gitignore` exists and lacks the entry,
append it; if the repository has no `.gitignore`, say so and write the ledger anyway. An
un-ignored ledger is swept into the next `git add -A`.

There is no manifest, no signature, and no hash beyond that envelope reference: the file is
append-only, git-ignored, disposable, and readable by a human. If it is missing, no entity is assumed
created and the authoritative Linear reload decides.

## Workflow

0. Session store: if `$CLAUDE_SESSION_ID` is set and `$ARGUMENTS` does not contain `--fresh`, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`.
   - If `acid-prophet.handoff_spec` is present and `acid-prophet._handoff_spec_path` equals `spec_path` (i.e. not stale), default to **file mode** with `handoff_spec.path` — skip asking the user. Announce: "using spec from session store: `<path>`".
   - If the store is absent, corrupt, or `handoff_spec` is stale, proceed normally (ask user).
   - When the invocation includes the named Acid Prophet fields `SPEC_FILE`, `PLAN_FILE`, `CONTRACTS_DIR`, `QUICKSTART_FILE`, `CODEBASE_MAP_FILE`, `CONSTITUTION_FILE`, prefer those explicit values over session state and preserve all six as `ARTIFACT_SET`.

1. Resume detection: read `${PROJECT_ROOT}/.nuthouse/<project-slug>/progress.md` if present, together with the approved preview at `${CLAUDE_PLUGIN_DATA}/preview-${CLAUDE_SESSION_ID}.md` and the envelope at `${CLAUDE_PLUGIN_DATA}/envelope-${CLAUDE_SESSION_ID}.json`.
   - Require both the preview and the envelope to exist and be readable. A missing artifact blocks: the approval that authorized those exact bodies is gone, so the cascade must be redrafted and re-approved from step 3. Never rebuild an approved body from memory or conversation prose.
   - Re-read every source artifact named in the preview and the Acceptance register. If any is missing, unreadable, or no longer matches the register the preview was built from, stop `source_artifact_changed`, invalidate the approved cascade, and return to drafting.
   - Re-run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate-envelope <envelope-file>` and require `ok: true`. Its returned canonical `envelope` is the only source of Linear mutation fields from here on.
   - Then dispatch `linear-devotee:project-graph-loader` with the approved project `client_ref`, the team id, and `PROJECT_ID: <ledger-recorded id | _unknown_>`. The loader must resolve an unknown id only by the exact project marker inside that team; zero or multiple matches stop `resume_state_unknown` without a write.
   - Reconcile: for every entity or relation the loader confirms on Linear, append its `created` line to the ledger if absent. Retry only entities and relations that are absent from both the ledger and the authoritative reload.
   - Announce "resuming partial cascade" with confirmed vs pending counts, then skip to **step 9 (batch commit)**.
   - If the ledger's last line already marks every previewed entity and relation as created, warn the user that the cascade already completed and exit `already-committed`. Suggest `--fresh` to start a new cascade.
   - Never generate or expand an issue body after the approval gate.

2. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`; abort clearly if unavailable. Read the available teams once and retain that snapshot for step 4. It is drafting context, not permission to mutate.
   - Verify git repo with `git rev-parse --is-inside-work-tree`. Capture `PROJECT_ROOT`.
   - Ensure `${CLAUDE_PLUGIN_DATA}` exists.
   - Read every supplied non-`_none_` artifact and the applicable repository instructions (`AGENTS.md`, `CLAUDE.md`) before drafting.

3. Input mode:
   - **Artifact-set mode**: named `SPEC_FILE` / `PLAN_FILE` / `CONTRACTS_DIR` / `QUICKSTART_FILE` / `CODEBASE_MAP_FILE` / `CONSTITUTION_FILE` fields were passed. Verify every non-`_none_` path exists and is readable, read the spec first, summarize the set in one paragraph, and continue without dropping optional artifacts.
   - **File mode**: `$ARGUMENTS` contains a path to an existing `.md` (or one was auto-detected from the session store in step 0); read it, summarize in one paragraph, confirm.
   - **Vibe mode**: ask one at a time — north star, why now, measurable outcomes, constraints, out of scope. Turn each observable outcome into a stable EARS criterion (`[AC-001] WHEN|IF ..., THE SYSTEM SHALL ...`), show the compact Acceptance register, and ask the user to approve or revise it. Persist the approved Q&A plus register to `${CLAUDE_PLUGIN_DATA}/vibe-${CLAUDE_SESSION_ID}.txt`. Never invent or silently renumber ids.
   - In every mode, write one concise normalized brief to `${CLAUDE_PLUGIN_DATA}/brief-${CLAUDE_SESSION_ID}.md`. Extract the exact active Acceptance section from the approved vibe register or source spec (heading `Acceptance`, stop at the next same/higher heading; exclude history), preserve criterion order and EARS text byte-for-byte, and reject duplicate ids. If a file/artifact input has no active Acceptance section, derive a proposed EARS register only from its observable outcomes (ask one focused question at a time when none are stated), show it, and require the user to approve or revise it exactly as in vibe mode; never silently synthesize criteria. Write the approved register to `${CLAUDE_PLUGIN_DATA}/acceptance-${CLAUDE_SESSION_ID}.md`. No downstream artifact may change it.

4. Linear workspace:
   - Reuse the team snapshot fetched in step 2 (refresh only if the provider explicitly invalidated it) and fetch existing project statuses with `list_projects`.
   - If multiple teams, ask user to choose.
   - Fetch the chosen team's existing issue labels with `list_issue_labels`. Capture an immutable `LABEL_MAP` of exact label name → id before drafting and approval; never create labels implicitly.
   - Pick initial project status by `status.type`: prefer `backlog`, fallback `planned`; never hardcode status names.

5. Draft project + decomposition:
   - If session store was read in step 0 and `relevant_files` is present, include it in the prompt.
   - Dispatch the logical `linear-devotee:project-drafter` agent with:
     ```text
     ACCEPTANCE_REGISTER: <absolute path to the approved register>
     SPEC_FILE: <abs path | _none_>
     PLAN_FILE: <abs path | _none_>
     CONTRACTS_DIR: <abs path | _none_>
     QUICKSTART_FILE: <abs path | _none_>
     CODEBASE_MAP_FILE: <abs path | _none_>
     CONSTITUTION_FILE: <abs path | _none_>
     VIBE_BULLETS: <abs path | _none_>
     PROJECT_ROOT: <git root>
     RELEVANT_FILES:
     - <abs path> (omit section when not available from session store)
     ```
   - Capture the returned Project-SDD, decomposition (`flat | phased`), milestones, and complete `## Issue packets` in deterministic dependency order. Each packet is the future Linear description, not a title-only placeholder. Require every returned `AC-###` id to exist in the approved register; an unknown or renumbered id blocks before preview. Downstream planning context may refine ordering and implementation details but never override source Acceptance truth.

6. Clarify:
   - Scan `_unclear_` and `Suggested clarifying questions` across the whole draft (project + milestones + issues).
   - Ask one blocking question at a time, patch the draft, repeat until clean or user ships as-is.
   - Run the traceability pre-flight before preview:
     - every source `AC-###` is covered by at least one issue packet;
     - every non-foundation issue covers at least one known source id;
     - every `foundation` issue has a concrete `foundation-reason`;
     - every `draft-key` is unique and every `depends-on` target exists;
     - the dependency graph is acyclic.
   - Materialize the exact `normalized_graph` contract with every dependency represented as `dependentRef -> blockerRef`. Every issue has `acceptanceIds`; a foundation-only issue uses `acceptanceIds: []` plus its non-empty `foundationReason`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate <graph-file>` and require `ok: true`. This executable gate additionally rejects unknown targets, self-edges, duplicate edges, cross-project membership, invalid/legacy direction, cycles, unknown milestones, missing coverage, and mixed Acceptance/foundation coverage. Any failure is blocking and must identify the exact entity or relation. Repair the owning issue packet or source spec, then repeat this pre-flight. Never create or renumber an `AC-###` id in this skill.

7. Assign client refs and write the preview file:
   - Re-read every source artifact and the Acceptance register. If any was added, removed, or changed during drafting, invalidate the cascade and rebuild the preview from step 5; never approve output derived from stale artifacts.
   - Mint a stable `client_ref` (UUID v4) for the project, every drafted milestone, and every drafted issue. These refs are the only stable identifiers until Linear assigns real ids; they unlock idempotent recovery on partial failure.
   - Resolve each issue packet's exact `milestone` name to one drafted milestone and persist that milestone's `client_ref` as `milestone_client_ref`. `_none_` maps to `null`. Missing or duplicate milestone-name matches are blocking preview errors; never defer this resolution to the mutation phase.
   - Resolve every `suggested-labels` name against the pre-approval `LABEL_MAP`. Before writing the preview, warn and drop unknown names, then persist both the approved names and their exact ids. The mutation phase replays those ids; it does not reinterpret drafter suggestions.
   - Add the stable marker `<!-- nuthouse-client-ref: <client_ref> -->` to the exact approved project, milestone, and issue descriptions. For a foundation-only issue also add `<!-- nuthouse-foundation-reason: <base64url UTF-8 reason> -->`. These markers are part of the previewed payload and are the only safe correlation keys after an ambiguous Linear timeout or authoritative reload; never add them after approval.
   - Write the canonical graph validator output to `${CLAUDE_PLUGIN_DATA}/graph-${CLAUDE_SESSION_ID}.json` as `normalized_graph`.
   - Materialize `${CLAUDE_PLUGIN_DATA}/envelope-${CLAUDE_SESSION_ID}.json` with schema version 1, the whole `normalized_graph`, and the exact project/milestone/issue mutation fields: project `clientRef`, `name`, full marked `description`, `teamIds`, `statusId`; milestone `clientRef`, `projectRef`, `name`, full marked `description`, `targetDate`; issue `clientRef`, `draftKey`, `projectRef`, nullable `milestoneRef`, `teamId`, `title`, full marked `description`, exact `labelIds`, and `blockedByRefs`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate-envelope <envelope-file>` and require `ok: true`. Re-run both validations after every preview edit; if the canonical content changes, replace both files before re-asking for approval.
   - Write `${CLAUDE_PLUGIN_DATA}/preview-${CLAUDE_SESSION_ID}.md` containing the one complete cascade preview. The preview is a deterministic rendering of the canonical envelope, not a second independently editable payload:

     ````markdown
     # Cascade preview — <project name>

     <project SDD body, unchanged from drafter>

     <!-- nuthouse-client-ref: <project uuid> -->

     - Project client ref: `<client_ref>`
     - Team ids: `<exact teamIds>`
     - Status id: `<exact statusId>`
     - Acceptance register: `<absolute path>`

     ## Milestones

     ### Phase 1: <name> <!-- client_ref: <uuid> -->

     - Scope: <one line>
     - Project ref: <project client_ref>
     - Target date: <YYYY-MM-DD | none>

     ### Phase 2: …

     ## Issues

     ### <issue title> <!-- draft_key: I-001 · client_ref: <uuid> -->

     - Milestone: <name | none>
     - Project ref: <project client_ref>
     - Milestone ref: <milestone client_ref | null>
     - Team id: <exact teamId>
     - Depends on: <client_ref list | none>
     - Covers: AC-001, AC-002 | foundation
     - Foundation reason: <text | n/a>
     - Suggested labels: <existing labels | none>
     - Label ids: <exact labelIds | none>

     <the complete Goal / Context / Files referenced / Constraints /
     Acceptance criteria / Non-goals body from the issue packet>

     <!-- nuthouse-client-ref: <issue uuid> -->

     ## Canonical mutation envelope

     ```json
     <the complete canonical mutation envelope JSON, byte-for-byte equivalent to the validated envelope file>
     ```
     ````

   - The HTML comments are load-bearing — they tie each preview entry to its stable draft key and `client_ref` so an edited file can be re-parsed without losing identity. Map `depends-on` draft keys to client refs before writing. The canonical JSON section makes every replay field human-visible, including project `teamIds`/`statusId`, milestone refs/target dates, and issue `teamId`/`labelIds`/`blockedByRefs`; the friendly sections must agree with it.

8. Preview and approve:
   - Print every project, milestone, issue, and normalized dependency, plus project name, team, status, counts, and `Preview written to: <path>`. This is the single global gate for the complete cascade; do not show or approve fragments separately.
   - Ask `Create everything on Linear? (y / edit / cancel)`.
   - On `edit`: instruct the user to edit `<preview path>` directly. After they signal done, re-parse the full file (preserving `client_ref` comments; new entries get a fresh ref, removed entries are dropped) and reject any disagreement between friendly fields and canonical JSON. Re-run the complete traceability/dependency pre-flight from step 6 plus milestone and label resolution from step 7, rebuild the envelope, overwrite the preview with the deterministic rendering and complete canonical JSON, re-print the full summary, and only then re-ask. Loop until `y` or `cancel`.
   - On `cancel`: stop with `cancelled`. Write no ledger.
   - Continue only on `y`. The approved preview file plus its validated envelope are the sole authority for every field sent to Linear. No further per-resource gate after this point.

9. Batch commit (the one place we mutate Linear):
   - Create `${PROJECT_ROOT}/.nuthouse/<project-slug>/progress.md` with its `# ledger — project: <project name> — envelope: <envelope client_ref>` first line before the first mutation, so a crash mid-flight is recoverable. If a ledger already exists under a different envelope reference, move it aside first as described in `## The cascade ledger`.
   - Immediately before the first mutation and again on every resumed run, re-read every source artifact and the Acceptance register, re-run `validate-envelope`, and require `ok: true`. Project every `save_*` argument and relation below directly from that freshly validated envelope; the friendly preview sections are an index only and may never override it.
   - **Idempotency rule**: an entity or relation is done when the ledger carries the `created` line for its exact `client_ref` **or** the resume loader confirmed it on Linear by its exact `nuthouse-client-ref` marker or relation reload. Skip every done operation; retry only the rest. Re-invocations never replay confirmed operations.
   - **9.a — Project**: if the project is not done, call `save_project` with the envelope project's exact `name`, `description`, `teamIds`, and `statusId`. On success, append `project/<client_ref>: created` to the ledger and hold its `id` + `url` for this run before continuing. On timeout or API error, surface the error verbatim and stop `partial_failure`; the next invocation reloads the marker before deciding whether a retry is safe.
   - **9.b — Milestones (in envelope order)**: for each milestone that is not done, call `save_milestone` with its exact `name`, resolved `projectId`, `description`, and nullable `targetDate`. Append `milestone/<client_ref>: created` per entry. On error: stop with `linear_error` and `partial_failure`.
   - **9.c — Issues (topological order on `blockedByRefs`)**: process only entries whose `blockedByRefs` already resolve to created issues. For each:
     - Take the `description`, `acceptanceIds`, and dependency fields from the approved envelope. If any is missing, stop `partial_failure` with `last_error: "approved issue packet missing"` before this issue. Do not draft or expand content inside the mutation phase.
     - Resolve `milestoneRef` to exactly one created milestone and require its Linear id. Pass that id as `projectMilestoneId`. When `milestoneRef` is `null` / `_none_`, omit `projectMilestoneId`. A missing, duplicate, or uncreated reference stops `partial_failure` with `last_error: "milestone_reference_unresolved"` before this issue; never guess from milestone name or array position.
     - Resolve every `blockedByRef` to exactly one created issue identifier. Any unresolved or duplicate mapping stops `partial_failure` with `last_error: "dependency_reference_unresolved"` before mutation; never drop, guess, or defer an approved dependency silently.
     - Use the envelope issue's exact `labelIds`; do not refetch or reinterpret labels after approval.
     - Call `save_issue` with the envelope issue's exact `teamId`, `title`, `description`, resolved `projectId`, resolved `projectMilestoneId`, exact `labelIds`, and `blockedBy` resolved only from its envelope `blockedByRefs`.
     - **`blockedBy` runtime guard**: if `save_issue` rejects `blockedBy` with a schema error, retry once without `blockedBy`, then keep those `{dependent, blocker}` edges for the post-pass.
     - Append `issue/<client_ref>: created` to the ledger before continuing.
     - On API error: stop `partial_failure` with `linear_error`.
   - **9.d — relation post-pass**: for each edge still missing, call the Linear relation mutation exposed by the provider. On success, append `relation/<dependent client_ref>-<blocker client_ref>: created` to the ledger. A relation failure leaves `partial_failure`; it is recoverable, but graph verification cannot pass and Maestro activation remains forbidden.
   - **9.e — authoritative reload and exact verification**: only after every entity and relation is done, dispatch `linear-devotee:project-graph-loader` and require `complete: true`. Write its `graph` to a scratch JSON and run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs compare <approved-graph> <actual-graph>`. Copy every missing/extra/changed/reversed difference it reports. Verification passes only on `ok: true` with zero differences; a loader unknown, an invalid actual graph, or any difference leaves it unverified. Never mutate Linear to paper over drift.
   - **9.f — durable verification receipt**: use the loader's exact client-ref → Linear-id map to build `decision_baseline: { issueIds, edges: [{ dependentIssueId, blockerIssueId }] }`. Build a project comment headed `<!-- nuthouse:project-graph-receipt schema_version=1 -->` with `verified`, `differences`, `decision_baseline`, and a timestamp. Write it through `save_comment(projectId: ...)`. Only an equivalent graph whose receipt comment succeeded is `verified`. A failed comment write reports `verification_record_failed` and refuses Maestro activation.

10. Patch source spec frontmatter when `SPEC_FILE` exists and the graph receipt is verified:
    - `linear-project: <project.id>`
    - `status: ready`
    - `last-reviewed: <today ISO date>`
    - Warn, do not abort, if frontmatter patch fails.
    - Do not alter Acceptance ids or bodies. The created issues already carry the approved `AC-###` references.

11. Recommend first issue:
    - On a fully created cascade with at least one created issue: pick the first startable issue (created issues sorted by topological commit order, preferring entries with no `blockedByRefs`; if every issue is blocked, pick the first issue whose blockers all have created Linear identifiers and clearly label that dependency assumption). Print `Recommended next issue: <identifier> - <title> - <url>`, `Start with: linear-devotee:greet <identifier>`, and `Project execution: monkey-maestro:start <project.id>`. The Maestro line is permitted only when the graph receipt is verified; otherwise print `Project execution: refused — graph unverified`. Do **not** write greet state, invoke `linear-devotee:greet`, invoke `linear-devotee:plan`, invoke Maestro, or continue automatically.

- On `partial_failure`: stop with a structured resume report (see Final Report). Do **not** chain. Tell the user to reinvoke `linear-devotee:create-project` for the same session; do not offer `create-milestone` or `create-issue`, because only this entry point re-reads the approved preview and re-validates both frozen source registers before retry.
- On `cancelled` or `already-committed`: stop.

## The approval gate is the only authority

**NOTHING REACHES LINEAR THAT THE USER DID NOT APPROVE IN THE PREVIEW.**

| Excuse                                       | Reality                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| "The user already said yes to the project"   | They approved one preview, not a body rewritten after it.                       |
| "This field is obviously what they meant"    | An unpreviewed field is an unapproved mutation. Rebuild the preview and re-ask. |
| "Only one issue is missing, I'll add it now" | An issue added after the gate never passed a gate. Redraft and re-approve.      |

The approved preview file and its validated envelope are the exact payload. If either is gone,
unreadable, or no longer agrees with the source artifacts, the cascade stops and returns to
drafting — it never resumes on a reconstructed body.

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
  Graph verification:<verified | unverified | not-run> · <N differences>
  Phase:             committed | partial_failure | cancelled | already-committed
  Last error:        <verbatim Linear error | _none_>
  Preview file:      <abs path>
  Ledger:            ${PROJECT_ROOT}/.nuthouse/<project-slug>/progress.md
  Recommended next:  <identifier> - <title> - <url | _none_>
  Hand-off:          user-starts-greet <identifier> + optional monkey-maestro:start <project.id> | resume by reinvoking linear-devotee:create-project | stop | cancelled | linear_error | graph_unverified
```

The cascade ends here. Print `Start with: linear-devotee:greet <identifier>` and let the user
run it — this skill never invokes another skill programmatically, and a `cancelled`,
`partial_failure`, or `graph_unverified` run recommends nothing at all.

## Never

- Mutate Linear before the user types `y` at the single approval gate.
- Draft, expand, or materially rewrite an issue body after the single approval gate.
- Create an issue when its approved description, acceptance ids, or dependency record is missing.
- Add per-resource `(y)` gates inside the batch commit phase — the single global gate is the contract.
- Drop or rewrite a `client_ref` once minted — they are the recovery keys.
- Retry failed Linear writes blindly inside one cascade (the resume path handles retries on the next invocation, after the user knows).
- Treat a local id or title match as confirmation after an ambiguous write; require the exact `nuthouse-client-ref` marker or relation reload before writing the ledger line.
- Mark a project verified, patch its source spec, or offer `monkey-maestro:start` unless exact comparison and the durable receipt comment both succeeded; otherwise refuse Maestro activation.
- Auto-rollback created entries on partial failure — Linear has no transaction; leave them and let the user decide.
- Run `git push`, `git commit`, or `git rebase`.
- Write outside plugin `data/` and the project ledger, except the confirmed spec frontmatter patch.
- Invoke another skill programmatically after the cascade commits.
- Treat an artifact path that failed to open as present.
- Continue from a changed source artifact without rebuilding and reapproving the complete cascade.
