---
name: create-project
description: Use when creating a Linear Project end-to-end from an Acid Prophet artifact set, a spec file, or vibe-mode Q&A. Drafts the project plus complete traceable issue packets and their dependency graph before one approval gate, then batch-creates everything on Linear and recommends the first startable issue. Supports idempotent resume after partial failure.
argument-hint: "[spec-file] [--fresh]"
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write, Agent, mcp__claude_ai_Linear__list_teams, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_project, mcp__claude_ai_Linear__save_milestone, mcp__claude_ai_Linear__save_issue
---

# linear-devotee:create-project

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Mode

**Full-cascade mode by default.** This skill drafts the project, its milestones, and complete issue bodies up front, validates Acceptance coverage plus the dependency graph, presents one global preview, asks **a single approval gate**, then batch-creates exactly those approved bodies on Linear in topological order. On success it recommends the first unblocked created issue to start, but does not invoke `linear-devotee:greet` automatically.

`linear-devotee:create-milestone` and `linear-devotee:create-issue` remain invocable standalone (add-on use cases) and double as **resume tools** when this skill's batch commit fails partway — they detect the chain-state file and pick up at the first `id: null` entry.

## Workflow

0. Session store: if `$CLAUDE_SESSION_ID` is set and `$ARGUMENTS` does not contain `--fresh`, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`.
   - If `acid-prophet.handoff_spec` is present and `acid-prophet._handoff_spec_path` equals `spec_path` (i.e. not stale), default to **file mode** with `handoff_spec.path` — skip asking the user. Announce: "using spec from session store: `<path>`".
   - If the store is absent, corrupt, or `handoff_spec` is stale, proceed normally (ask user).
   - When the invocation includes the named Acid Prophet fields `SPEC_FILE`, `PLAN_FILE`, `CONTRACTS_DIR`, `QUICKSTART_FILE`, `CODEBASE_MAP_FILE`, prefer those explicit values over session state and preserve all five as `ARTIFACT_SET`.

1. Resume detection: read `${CLAUDE_PLUGIN_DATA}/chain-${CLAUDE_SESSION_ID}.json` if present.
   - If `phase: "partial_failure"` and `project.id` exists: verify every pending issue has a non-empty pre-approved `sdd_body`. If yes, announce "resuming partial cascade" with created vs pending counts, then skip to **step 9 (batch commit)**. If a legacy pending entry lacks `sdd_body`, stop with `legacy_issue_body_missing` and route it through `linear-devotee:create-issue`; never generate an issue body after the cascade approval gate.
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
   - Any failure is blocking. Repair the owning issue packet or source spec, then repeat this pre-flight. Never create or renumber an `AC-###` id in this skill.

7. Assign client refs and write the preview file:
   - Mint a stable `client_ref` (UUID v4) for the project, every drafted milestone, and every drafted issue. These refs are the only stable identifiers until Linear assigns real ids; they unlock idempotent recovery on partial failure.
   - Resolve each issue packet's exact `milestone` name to one drafted milestone and persist that milestone's `client_ref` as `milestone_client_ref`. `_none_` maps to `null`. Missing or duplicate milestone-name matches are blocking preview errors; never defer this resolution to the mutation phase.
   - Resolve every `suggested-labels` name against the pre-approval `LABEL_MAP`. Before writing the preview, warn and drop unknown names, then persist both the approved names and their exact ids. The mutation phase must replay those ids; it does not reinterpret drafter suggestions.
   - Write `${CLAUDE_PLUGIN_DATA}/preview-${CLAUDE_SESSION_ID}.md` containing the full editable preview:

     ```markdown
     # Cascade preview — <project name>

     <project SDD body, unchanged from drafter>

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
     ```

   - The HTML comments are load-bearing — they tie each preview entry to its stable draft key and `client_ref` so an edited file can be re-parsed without losing identity. Map `depends-on` draft keys to client refs before writing.

8. Preview and approve:
   - Print: project name, team, status, milestone count, issue count, and `Preview written to: <path>`.
   - Ask `Create everything on Linear? (y / edit / cancel)`.
   - On `edit`: instruct the user to edit `<preview path>` directly. After they signal done, re-parse the file (preserving `client_ref` comments; new entries get a fresh ref, removed entries are dropped), re-run the complete traceability/dependency pre-flight from step 6 plus milestone and label resolution from step 7, re-print the summary, and re-ask. Loop until `y` or `cancel`.
   - On `cancel`: write chain-state with `phase: "cancelled"` and stop with `cancelled`.
   - Continue only on `y`. No further per-resource gate after this point.

9. Batch commit (the one place we mutate Linear):
   - Write chain-state immediately with `phase: "committing"` so a crash mid-flight is recoverable. Schema:
     ```json
     {
       "current": "create-project",
       "phase": "committing | partial_failure | committed | cancelled",
       "project": {
         "client_ref": "<uuid>",
         "id": "<linear id or null>",
         "url": "<url or null>",
         "name": "<name>",
         "team_id": "<team.id>",
         "team_key": "<team.key>"
       },
       "drafts": {
         "decomposition": "flat | phased",
         "milestones": [
           {
             "client_ref": "<uuid>",
             "id": "<id or null>",
             "name": "<name>",
             "scope": "<one line>",
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
       "blocked_by_pending": [],
       "created_at": "<ISO 8601>",
       "last_error": null
     }
     ```
   - **Idempotency rule**: at every sub-step, skip any entry where `id != null`. Re-invocations after partial failure replay only what's missing.
   - **9.a — Project**: if `project.id == null`, call `save_project` with `name`, `description` (Project-SDD sections only, excluding decomposition and issue packets), `teamIds`, `statusId`. On success, persist `id` + `url` to chain-state. On API error, set `phase: "partial_failure"`, surface verbatim, stop with `linear_error`.
   - **9.b — Milestones (in `drafts.milestones[]` order)**: for each with `id == null`, call `save_milestone` with `name`, `projectId`, `description` (scope line), optional `targetDate`. Persist `id` + `url` per entry. On error: persist, set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.c — Issues (topological order on `blocked_by_refs`)**: process only entries whose `blocked_by_refs` already resolve to created issues. For each:
     - Require the pre-approved `sdd_body`, `acceptance_refs`, and dependency fields persisted from the preview. If any are missing, set `phase: "partial_failure"`, set `last_error: "approved issue packet missing"`, and stop before this issue. Do not draft or expand content inside the mutation phase.
     - Resolve `milestone_client_ref` to exactly one entry in `drafts.milestones[]` and require that entry's `id` is non-null. Pass that id as `projectMilestoneId`. When `milestone_client_ref` is `null` / `_none_`, omit `projectMilestoneId`. A missing, duplicate, or uncreated reference sets `phase: "partial_failure"`, sets `last_error: "milestone_reference_unresolved"`, and stops before this issue; never guess from milestone name or array position.
     - Resolve `blocked_by_refs` to created issue identifiers (drop unresolved refs with a warning).
     - Use the persisted `label_ids` resolved before approval. Do not refetch or reinterpret labels for current-schema state. For legacy pending state without `label_ids`, fetch `list_issue_labels` once, resolve the already-approved `suggested_label_names` by exact name, persist the resulting ids, and warn/drop unknown names; never create a label.
     - Call `save_issue` with `teamId`, `title`, the exact pre-approved `sdd_body` as `description`, `projectId`, `projectMilestoneId`, persisted `label_ids` as `labelIds`, and `blockedBy` (resolved identifiers).
     - **`blockedBy` runtime guard**: if `save_issue` rejects `blockedBy` with a schema error, retry once without `blockedBy`, then append `{from_ref, to_ref}` edges to `blocked_by_pending` for a post-pass.
     - Persist `id`, `identifier`, `url` per entry.
     - On API error: set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.d — `blocked_by_pending` post-pass**: if non-empty, for each edge call the Linear MCP relation tool (`save_issue` with the relation field, or `mcp__claude_ai_Linear__*` relation create if exposed). Drop the entry from `blocked_by_pending` on success. Failures here are non-fatal: warn and leave the remainder in chain-state for manual fixup.
   - On full success: set `phase: "committed"`, write chain-state once more.

10. Patch source spec frontmatter when `SPEC_FILE` exists:
    - `linear-project: <project.id>`
    - `status: ready`
    - `last-reviewed: <today ISO date>`
    - Warn, do not abort, if frontmatter patch fails.
    - Do not alter Acceptance ids or bodies. The created issues already carry the approved `AC-###` references.

11. Recommend first issue:
    - On `phase: "committed"` and at least one created issue: pick the first startable issue (`drafts.issues[]` filtered by `id != null`, sorted by topological commit order, preferring entries with no `blocked_by_refs`; if every issue is blocked, pick the first issue whose blockers all have created Linear identifiers and clearly label that dependency assumption). Print `Recommended next issue: <identifier> - <title> - <url>` and `Start with: linear-devotee:greet <identifier>`. Do **not** write greet state, invoke `linear-devotee:greet`, invoke `linear-devotee:plan`, or continue automatically.
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
  Phase:             committed | partial_failure | cancelled | already-committed
  Last error:        <verbatim Linear error | _none_>
  Preview file:      <abs path>
  Chain state:       ${CLAUDE_PLUGIN_DATA}/chain-<session>.json
  Recommended next:  <identifier> - <title> - <url | _none_>
  Hand-off:          user-starts-greet <identifier> | resume via create-milestone / create-issue | stop | cancelled | linear_error
```

## Never

- Mutate Linear before the user types `y` at the single approval gate.
- Draft, expand, or materially rewrite an issue body after the single approval gate.
- Create an issue when its `sdd_body`, `acceptance_refs`, or dependency record is missing.
- Add per-resource `(y)` gates inside the batch commit phase — the single global gate is the contract.
- Drop or rewrite a `client_ref` once minted — they are the recovery keys.
- Retry failed Linear writes blindly inside one cascade (the resume path handles retries on the next invocation, after the user knows).
- Auto-rollback created entries on partial failure — Linear has no transaction; leave them and let the user decide.
- Run `git push`, `git commit`, or `git rebase`.
- Write outside plugin `data/`, except the confirmed spec frontmatter patch.
- Invoke another skill programmatically after the cascade commits.
