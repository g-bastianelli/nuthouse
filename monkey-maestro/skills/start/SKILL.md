---
name: start
description: Activate full issue delivery for a Linear project, resolve Superset transport, record the explicit delivery scope once, and enter notification-driven supervision.
argument-hint: "<linear-project-id> [--host <id>] [--superset-project <id>] [--agent <name>] [--max-concurrency <1-10>]"
effort: high
allowed-tools: Read, Bash(node:*), Bash(git rev-parse:*), Bash(superset status:*), Bash(superset hosts list:*), Bash(superset projects list:*), Bash(superset agents list:*), Bash(superset terminals list:*), Bash(superset agents read:*), Agent, mcp__claude_ai_Linear__save_comment
---

# start

> Agent resolution: before dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`
> and select the active runtime name for `monkey-maestro:linear-reader`.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Resolve the concrete
delivery scope and transport before activation. Its durable mutation is the project control;
bounded notification probes may use the exact temporary command-terminal boundary. The
authorized supervisor and issue workers perform subsequent delivery mutations.

## Workflow

1. Dispatch `monkey-maestro:linear-reader` in `MODE: control` for the exact project. It
   returns only project identity and the complete marker-bearing comment set; reject an
   unavailable or mismatched result.
2. Pass those comments through `scripts/records.mjs resolve-controls`. A usable active
   schema-v3 control with `deliveryScope: issue-through-merge` keeps its exact `runId` and
   `workspaceGroup`, including when the invocation overrides transport or concurrency.
   With no overrides, report `already-active` without another control write.
   Establish **Supervisor ownership** from the shared contract before entering orchestration:
   same-session continuity can continue; a different known live owner is reported without
   starting a second supervisor here. Unknown ownership requires a concrete handoff clarification, not
   an assumption that an active control means this session owns the run.
   Apply that ownership check before updating an active control too. Unsupported schema,
   missing scope, or a missing/invalid group grants no authority; resolve fresh activation
   inputs instead of projecting the old control.
3. Resolve each selector independently: explicit argument, then the latest usable
   control, then local discovery. Keep `maxConcurrency` from explicit or inherited
   control, otherwise use `4`; require 1–10.
4. For a missing host, run `superset status --json`. Use its non-empty `hostId` only when
   it reports `running: true` and `healthy: true`. If stopped/stale, match that exact host id
   in `superset hosts list --json` and confirm an online host with a successful
   `superset projects list --host <id> --json` read. A desktop host may remain online while
   the local CLI daemon is stopped; failed daemon status alone does not reject the host.
5. For a missing project, inspect the current path and
   `git rev-parse --path-format=absolute --git-common-dir`, then run
   `superset projects list --local --json`. Prefer the exact id following
   `.superset/worktrees/` in the current path when present in the list; otherwise use the
   single project whose path owns the current path or Git common directory; otherwise use
   the sole listed local project.
6. For a missing agent, run `superset agents list --host <targetHostId> --json`. Use the
   active runtime (`codex` or `claude`) only when that exact preset or id is listed;
   otherwise use the sole listed terminal-capable Codex or Claude agent. Exclude Superset
   chat because terminal follow-ups cannot control it. Preserve configured model/effort.
7. Failed, malformed, empty, or ambiguous discovery supplies no value. Gather every
   unresolved selector and its deterministic available choices into one concise
   clarification. Apply the reply as named values; do not ask separate questions.
8. After resolving the target, generate a fresh `runId` and `workspaceGroup` once for a
   fresh activation after an inactive control or with no usable control. Build a readable
   label such as `<linear project name> · <YYYY-MM-DD HHmm utc> · <first 8 characters of runId>`.
   Replace commas, control characters, and whitespace runs in the project display fragment
   with one space, then trim and lowercase; use the project id if that fragment is empty.
   Capture the timestamp once and lowercase the suffix. Reserve the entire suffix, then
   truncate only the project fragment so the complete label fits 64 UTF-16 code units,
   without splitting a Unicode character. Require a different label from the previous
   group's value; use the full run id suffix and shorten the fragment again if the
   abbreviated label collides. Keep the final canonical pair through preview,
   approval, write, and readback. An active-run update or resume reuses its stored pair
   exactly, regardless of project name, date, caller folder, or runtime.
   Build the schema-v3 successor with `scripts/records.mjs build-control`: that run/group
   pair, `active: true`, explicit `deliveryScope: issue-through-merge`, and the resolved selectors.
   A usable existing control supplies its revision. With no usable control, supply only
   freshly resolved inputs and `previousRevision` from the highest observed orderable
   revision (zero when no control exists). Ambiguous or unorderable records need resolution
   before writing; never reset the revision or inherit unsupported authority.
9. Before activation or a resumed dispatch, read
   [native notification preparation](../orchestrate/references/notifications.md). Capture
   the actual master provider destination and prove its local reception. Prove the route
   from every selected worker host when an existing source workspace makes that possible.
   Otherwise retain that host as `route unverified`: orchestration may create and complete
   setup of its first selected issue workspace, then probe from there before reserving or
   launching the issue. Create no extra probe workspace. Keep destination/probe evidence
   in conversation, separate from the unchanged schema-v3 control. If reception needs the
   current turn to finish, retain preparation and yield until the actual probe arrives.
   An unavailable route reports exact preparation/resume steps without reserving issues or
   claiming that host's automatic supervision. Claude's optional acceptance is confined to a designated
   session launch; never silently restart this session or weaken command permissions.
10. Show the complete project, run, workspace group, host, Superset project, agent, concurrency, revision, source
    of every value, and the delivery scope: started reservations, isolated issue workspaces,
    implementation/checks, commits/pushes/draft PR, native review/corrections, review replies
    and resolution, protected merge, completed status readback, and dependency-ready refill.
    State verified routes and any remote proof still pending before reservation, that supervision needs the master session to
    remain loaded, and that stopping dispatch leaves existing workers running. External
    Linear edits or silent worker loss need explicit inspection; no recurring fallback is
    scheduled. If existing user authorization covers this exact scope and
    target, proceed; otherwise ask once after the concrete preview:

```text
Activate this project's displayed delivery scope through protected merge and supervise it in this session? (y / cancel)
```

11. With authorization, append one Linear project control comment. On denial, do nothing. Dispatch the
    reader once more in `MODE: control` and require the exact successor, including the
    approved run/group pair; report a failed
    verification without blindly writing again.
12. For a newly activated run, record that this current session starts supervision and
    retain any actual runtime-exposed session identity. Pass the exact project and authority
    to the supervisor. Updating a control alone does not end a different existing supervisor;
    apply the same ownership precondition before handing over.

**REQUIRED SUB-SKILL:** Use `monkey-maestro:orchestrate`

The clarification in step 7 is configuration input, not mutation approval. There is
at most one scope approval after the fully resolved preview. It authorizes the control and
the displayed issue delivery workflow; individual plans, PRs, reviews, or merges do not
repeat it. Required repository approvals and product decisions still apply.

## Report

```text
monkey-maestro:start report
  Project/run: <project id> / <run id>
  Control:     schema v3 · revision <n> · active
  Scope:       issue-through-merge
  Group:       <exact workspaceGroup stored in control>
  Transport:   <host> / <Superset project> / <agent>
  Concurrency: <n>
  Notifications: <verified master destination; per-host verified or pending proof before reservation>
  Supervisor:  loaded session awaiting events; no background automation created
  Next:        monkey-maestro:orchestrate <project id>
```
