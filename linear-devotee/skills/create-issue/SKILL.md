---
name: create-issue
description: Use to create a single Linear Issue with a strict SDD-formatted description or resume a partially committed create-project cascade. Standalone mode drafts and previews via issue-drafter; resume mode reuses the exact pre-approved issue packet and dependency metadata from chain-state, then updates progress and recommends the next issue.
effort: high
allowed-tools: Read, Glob, Grep, Bash(node:*), Write, Agent, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__list_milestones, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_issue
---

# linear-devotee:create-issue

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Workflow

1. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`.
   - Verify git repo.
   - Ensure `${CLAUDE_PLUGIN_DATA}`.
2. Detect mode from `${CLAUDE_PLUGIN_DATA}/chain-${CLAUDE_SESSION_ID}.json`:
   - **Resume**: chain-state exists with `phase: "partial_failure"`, `project.id != null`, all required `drafts.milestones[].id` set, and at least one `drafts.issues[].id == null`.
   - **Chained (legacy)**: chain-state exists with project, created milestone, and uncreated suggested issue.
   - **Standalone**: no chain-state, or `phase: "committed" | "cancelled"`.
   - Before any resume retry, require `mutation_envelope`, `approved_payload_hash`, `graph_hash`, `normalized_graph`, the pending entry's `<!-- nuthouse-client-ref: <client_ref> -->` marker inside `sdd_body`, and `confirmed_operations`. Dispatch `linear-devotee:project-graph-loader`, merge exact marker/relation confirmations, and stop `resume_state_unknown` when the loader is incomplete. If `issue:<client_ref>` is already confirmed, project the returned Linear id into the entry and skip creation. Never retry from `id == null` alone.
3. Gather context:
   - **Resume**: project + team come from chain-state. Pick the first `drafts.issues[]` entry whose `issue:<client_ref>` is absent from `confirmed_operations` and whose `blocked_by_refs` all resolve to confirmed issue entries (topological order). Require its `sdd_body`, `acceptance_refs`, approved hash, and stable marker; if missing, stop with `legacy_issue_body_missing` and ask the user whether to convert it through standalone drafting. Resolve its `milestone_client_ref` to exactly one confirmed `drafts.milestones[]` entry with a non-null `id`; `_none_` / `null` means no milestone. Missing, duplicate, or uncreated milestone refs stop before mutation with `milestone_reference_unresolved`. If no issues remain, exit `nothing-to-do`. If none are unblocked but some remain, exit `dependency_cycle`.
   - **Chained (legacy)**: resolve project/team/current milestone. Coerce legacy flat suggested issue strings. Pick the first uncreated issue whose `blocked_by` dependencies are already created in the same milestone. If none remain, exit `nothing-to-do`; if blocked by cycle/missing dep, exit `dependency_cycle`.
   - **Standalone**: fetch active projects with `list_projects` and ask the user to pick one. Fetch that project's milestones with `list_milestones`, ask whether to attach one, then ask for the one-sentence issue hint.
   - **Label resolution**: in standalone and chained-legacy modes, fetch the project's team labels with `list_issue_labels` and capture an immutable `LABEL_MAP` of exact name → id before drafting and approval. In resume mode, the validated envelope's exact `labelIds` are authoritative; the pending entry's persisted `label_ids` is only a projection and must match. A legacy cascade without the complete envelope cannot resume.
   - **Source Acceptance namespace**: prefer `source_acceptance_ids` from chain-state. Otherwise search `docs/acid-prophet/specs/` for a single spec whose `linear-project:` equals `PROJECT_ID` and extract its active `AC-###` ids. Multiple matches are a blocking clarification. Set `SOURCE_ACCEPTANCE_IDS` to the exact ids, or `_none_` when no source register exists. Never merge ids from multiple specs.
4. Draft:
   - **Resume**: do not dispatch a drafter. Load the exact `sdd_body`, `acceptance_refs`, suggested existing labels, and dependencies approved in the cascade preview.
   - **Chained legacy / standalone**: dispatch the logical
     `linear-devotee:issue-drafter` agent with:
     ```text
     PROJECT_ID: <id>
     MILESTONE_ID: <id | _none_>
     PARENT_DRAFT: <chain path | _none_>
     ISSUE_HINT: <hint | drafted title from legacy chain-state>
     SOURCE_ACCEPTANCE_IDS: <comma-separated AC-### ids | _none_>
     PROJECT_ROOT: <git root>
     ```
   - If drafter reports cross-project milestone violation, stop with `cross_project_violation`.
5. Clarify:
   - **Resume**: skip. The issue packet was clarified before the global cascade approval.
   - **Chained legacy / standalone**: ask one blocking question at a time for `_unclear_` or suggested questions. Patch the draft until clean or the user ships as-is.
6. Preview and approve:
   - **Resume**: print the title, `acceptance_refs`, dependencies, and exactly the first non-empty line of `sdd_body` truncated to 120 characters; do not compute a hash. Ask `Resume this previously approved issue? (y / cancel)`. Do not offer body edits here—editing requires returning to a new preview/approval cycle.
   - **Chained legacy / standalone**: mint one stable `client_ref`, append `<!-- nuthouse-client-ref: <client_ref> -->` to the body, print that exact full patched SDD draft, and ask `Create this issue? (y / edit / cancel)`. The marker is part of the approved description and cannot be added or changed later.
   - Continue only on `y`.
7. Create Linear issue:
   - In resume mode, run `project-graph.mjs validate-envelope` and require its `payloadHash` to equal `approved_payload_hash`, its `graphHash` to equal `graph_hash`, and its canonical graph to equal `normalized_graph` before mutation.
   - Resolve `blocked_by` references to created issue identifiers — by the validated envelope's exact `blockedByRefs` in resume mode, by index in legacy chained mode. Any unresolved resume reference stops `dependency_reference_unresolved`; only standalone/legacy pre-approval resolution may warn and drop an invalid suggestion.
   - Resolve approved standalone/legacy suggested label names against the pre-approval `LABEL_MAP`, warn and drop unknown names, and use the resulting ids. In resume mode, replay persisted `label_ids` only after proving it equals the validated envelope's `labelIds`; never fetch or reinterpret labels after cascade approval. Never create labels implicitly.
   - In resume mode, locate exactly one same-ref envelope issue and use only its exact `teamId`, `title`, `description`, resolved `projectId`, nullable resolved `projectMilestoneId`, `labelIds`, and resolved `blockedBy`. Duplicated `sdd_body` and draft fields are consistency indexes and cannot override the approved envelope. In standalone mode use the exact approved marked body.
   - **`blockedBy` runtime guard**: if `save_issue` rejects `blockedBy` with a schema error, retry once without `blockedBy`, then append `{from_ref, to_ref}` edges to chain-state `blocked_by_pending` for a post-pass. The cascade tail is responsible for flushing them.
   - On success, persist `issue:<client_ref>` in `confirmed_operations` with the returned id before any next operation. On timeout or API error, surface verbatim and stop with `linear_error`; the next resume must reload Linear by marker before retrying.
8. Update chain state:
   - **Resume**: update the matched `drafts.issues[]` entry **in place** (key on `client_ref`). Set `id`, `identifier`, `url`. If all `drafts.issues[]` now have an `id` and all `drafts.milestones[]` also do, set `phase: "committed"`; otherwise leave `phase: "partial_failure"`.
   - **Chained / standalone (legacy)**: append:
     ```json
     {
       "id": "<issue.id>",
       "identifier": "<issue.identifier>",
       "title": "<title>",
       "url": "<url>",
       "project_id": "<PROJECT_ID>",
       "milestone_id": "<MILESTONE_ID or null>"
     }
     ```
9. Handoff:
   - **Resume**: if more `drafts.issues[].id == null` remain, announce the next uncreated unblocked issue and tell the user to run this same skill again to continue creating the cascade. If `phase: "committed"`, pick the first startable issue (`drafts.issues[]` filtered by `id != null`, sorted by topological commit order, preferring entries with no `blocked_by_refs`; if every issue is blocked, pick the first issue whose blockers all have created Linear identifiers and clearly label that dependency assumption). Print `Recommended next issue: <identifier> - <title> - <url>` and `Start with: linear-devotee:greet <identifier>`. Do **not** write greet state, invoke `linear-devotee:greet`, invoke `linear-devotee:plan`, or continue automatically.
   - **Chained (legacy)**: offer next issue if remaining; otherwise recommend the first created issue if available.
   - **Standalone**: recommend the created issue as the issue to work on next.

## Final Report

```text
linear-devotee:create-issue report
  Mode:          <resume | chained | standalone>
  Project:       <project.title> (<PROJECT_ID>)
  Milestone:     <milestone.name> | none
  Issue:         <identifier> - <title> - <url> | (cancelled) | (linear_error) | (cross_project_violation) | (milestone_reference_unresolved)
  Labels:        <comma-separated names | none>
  Cascade:       <created>/<total> issues · phase: committing | partial_failure | committed | n/a
  Recommended next: <identifier> - <title> - <url | _none_>
  Hand-off:      user-starts-greet <identifier> | next-issue | stop | cancelled | linear_error | cross_project_violation | milestone_reference_unresolved | dependency_cycle | nothing-to-do | standalone-done
```

## Never

- Mutate Linear without explicit approval.
- Rewrite a resume-mode `sdd_body` or its `acceptance_refs` after the cascade preview was approved.
- Attach an issue to a milestone from another project.
- Retry failed Linear writes blindly.
- Retry or resume a cascade entity without the approved `nuthouse-client-ref` marker and `confirmed_operations` reload.
- Run `git push`, `git commit`, or `git rebase`.
