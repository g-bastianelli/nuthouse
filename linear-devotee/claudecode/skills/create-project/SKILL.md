---
name: linear-devotee:create-project
description: Use when creating a Linear Project end-to-end from a spec file or vibe-mode Q&A. Drafts project + milestones + issues in advance, presents one editable preview, asks a single approval gate, then batch-creates everything on Linear and auto-chains to greet on the first issue. Falls back to per-skill resume via create-milestone / create-issue on partial failure.
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write
context_policy: session
---

# linear-devotee:create-project

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Mode

**Full-cascade mode by default.** This skill drafts the project, its milestones, and its issues up front, presents one global preview, asks **a single approval gate**, then batch-creates everything on Linear in topological order. On success it auto-chains to `linear-devotee:greet` on the first created issue.

`linear-devotee:create-milestone` and `linear-devotee:create-issue` remain invocable standalone (add-on use cases) and double as **resume tools** when this skill's batch commit fails partway — they detect the chain-state file and pick up at the first `id: null` entry.

## Workflow

0. Session store (`context_policy: session`): if `$CLAUDE_SESSION_ID` is set and not invoked with `--fresh`, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`.
   - If `acid-prophet.handoff_spec` is present and `acid-prophet._handoff_spec_path` equals `spec_path` (i.e. not stale), default to **file mode** with `handoff_spec.path` — skip asking the user. Announce: "using spec from session store: `<path>`".
   - If the store is absent, corrupt, or `handoff_spec` is stale, proceed normally (ask user).

1. Resume detection: read `${CLAUDE_PLUGIN_ROOT}/data/chain-${CLAUDE_SESSION_ID}.json` if present.
   - If `phase: "partial_failure"` and `project.id` exists: announce "resuming partial cascade" with the counts of created vs pending entries, then skip to **step 9 (batch commit)** with the remaining entries. Do **not** redraft.
   - If `phase: "committed"`: warn the user that the cascade already completed for this session and exit `already-committed`. Suggest `--fresh` to start a new cascade.
   - Otherwise: continue from step 2.

2. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`; abort clearly if unavailable.
   - Verify git repo with `git rev-parse --is-inside-work-tree`.
   - Ensure `${CLAUDE_PLUGIN_ROOT}/data` exists.

3. Input mode:
   - **File mode**: argument is an existing `.md` (or auto-detected from session store in step 0); read it, summarize in one paragraph, confirm.
   - **Vibe mode**: ask one at a time — north star, why now, measurable outcomes, constraints, out of scope. Persist Q&A to `${CLAUDE_PLUGIN_ROOT}/data/vibe-${CLAUDE_SESSION_ID}.txt`.

4. Linear workspace:
   - Fetch teams and existing project statuses.
   - If multiple teams, ask user to choose.
   - Pick initial project status by `status.type`: prefer `backlog`, fallback `planned`; never hardcode status names.

5. Draft project + decomposition:
   - If session store was read in step 0 and `relevant_files` is present, include it in the prompt.
   - Dispatch `linear-devotee:project-drafter` with:
     ```text
     SPEC_FILE: <abs path | _none_>
     VIBE_BULLETS: <abs path | _none_>
     PROJECT_ROOT: <git root>
     RELEVANT_FILES:
     - <abs path> (omit section when not available from session store)
     ```
   - Capture the returned Project-SDD, decomposition (`flat | phased`), milestones list with one-line scope each, and suggested issues grouped per milestone.

6. Clarify:
   - Scan `_unclear_` and `Suggested clarifying questions` across the whole draft (project + milestones + issues).
   - Ask one blocking question at a time, patch the draft, repeat until clean or user ships as-is.

7. Assign client refs and write the preview file:
   - Mint a stable `client_ref` (UUID v4) for the project, every drafted milestone, and every drafted issue. These refs are the only stable identifiers until Linear assigns real ids; they unlock idempotent recovery on partial failure.
   - Write `${CLAUDE_PLUGIN_ROOT}/data/preview-${CLAUDE_SESSION_ID}.md` containing the full editable preview:
     ```markdown
     # Cascade preview — <project name>

     <project SDD body, unchanged from drafter>

     ## Milestones

     ### Phase 1: <name>  <!-- client_ref: <uuid> -->
     - Scope: <one line>
     - Target date: <YYYY-MM-DD | none>

     ### Phase 2: …

     ## Issues

     ### <Phase 1: name>
     - <title>  <!-- client_ref: <uuid> -->
     - <title> [blocked-by: <client_ref>]  <!-- client_ref: <uuid> -->

     ### <Phase 2: name>
     - …
     ```
   - The HTML comments are load-bearing — they tie each preview entry to its `client_ref` so an edited file can be re-parsed without losing identity.

8. Preview and approve:
   - Print: project name, team, status, milestone count, issue count, and `Preview written to: <path>`.
   - Ask `Create everything on Linear? (y / edit / cancel)`.
   - On `edit`: instruct the user to edit `<preview path>` directly. After they signal done, re-parse the file (preserving `client_ref` comments; new entries get a fresh ref, removed entries are dropped), re-print the summary, and re-ask. Loop until `y` or `cancel`.
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
           { "client_ref": "<uuid>", "id": "<id or null>", "name": "<name>", "scope": "<one line>", "target_date": "<YYYY-MM-DD or null>", "url": "<url or null>" }
         ],
         "issues": [
           { "client_ref": "<uuid>", "id": "<id or null>", "identifier": "<TEAM-N or null>", "title": "<title>", "milestone_client_ref": "<uuid>", "blocked_by_refs": ["<uuid>"], "url": "<url or null>" }
         ]
       },
       "preview_file": "<abs path>",
       "spec_file": "<abs path | _none_>",
       "blocked_by_pending": [],
       "created_at": "<ISO 8601>",
       "last_error": null
     }
     ```
   - **Idempotency rule**: at every sub-step, skip any entry where `id != null`. Re-invocations after partial failure replay only what's missing.
   - **9.a — Project**: if `project.id == null`, call `save_project` with `name`, `description` (Project-SDD sections only, excluding decomposition and suggested issues), `teamIds`, `statusId`. On success, persist `id` + `url` to chain-state. On API error, set `phase: "partial_failure"`, surface verbatim, stop with `linear_error`.
   - **9.b — Milestones (in `drafts.milestones[]` order)**: for each with `id == null`, call `save_milestone` with `name`, `projectId`, `description` (scope line), optional `targetDate`. Persist `id` + `url` per entry. On error: persist, set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.c — Issues (topological order on `blocked_by_refs`)**: process only entries whose `blocked_by_refs` already resolve to created milestones / issues. For each:
     - Dispatch `linear-devotee:issue-drafter` with:
       ```text
       PROJECT_ID: <linear project id>
       MILESTONE_ID: <linear milestone id resolved via milestone_client_ref>
       PARENT_DRAFT: <chain-state path>
       ISSUE_HINT: <drafted title + any per-issue notes from the preview>
       PROJECT_ROOT: <git root>
       ```
     - Resolve `blocked_by_refs` to created issue identifiers (drop unresolved refs with a warning).
     - Call `save_issue` with `teamId`, `title`, returned SDD body as `description`, `projectId`, `projectMilestoneId`, confirmed `labelIds`, and `blockedBy` (resolved identifiers).
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

11. Auto-chain to plan via greet:
    - On `phase: "committed"` and at least one created issue: pick the first issue (`drafts.issues[]` filtered by `id != null`, sorted by topological commit order). Reset the greet state so the freshly-created issue is picked up cleanly: write `${CLAUDE_PLUGIN_DATA}/state-${CLAUDE_SESSION_ID}.json` (or `${CLAUDE_PLUGIN_ROOT}/data/state-${CLAUDE_SESSION_ID}.json` if `CLAUDE_PLUGIN_DATA` is unset) with `{ greeted: false, awaiting_prompt: false, issue: "<identifier>", source: "create-project", current_branch: "<git branch>", needs_branch: true, in_repo: true }`. Then print `linear-devotee:greet <identifier>` and continue immediately — do not ask the user. The user's only validation point downstream is the plan's own `Validate this plan? (y / edit / stop)` gate.
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
  Phase:             committed | partial_failure | cancelled | already-committed
  Last error:        <verbatim Linear error | _none_>
  Preview file:      <abs path>
  Chain state:       ${CLAUDE_PLUGIN_ROOT}/data/chain-<session>.json
  Hand-off:          greet <identifier> | resume via create-milestone / create-issue | stop | cancelled | linear_error
```

## Never

- Mutate Linear before the user types `y` at the single approval gate.
- Add per-resource `(y)` gates inside the batch commit phase — the single global gate is the contract.
- Drop or rewrite a `client_ref` once minted — they are the recovery keys.
- Retry failed Linear writes blindly inside one cascade (the resume path handles retries on the next invocation, after the user knows).
- Auto-rollback created entries on partial failure — Linear has no transaction; leave them and let the user decide.
- Run `git push`, `git commit`, or `git rebase`.
- Write outside plugin `data/`, except the confirmed spec frontmatter patch.
- Invoke another skill programmatically beyond the documented `greet` auto-chain on `committed`.
