---
name: spawn
description: Use when the user or branch guard explicitly wants one Linear issue in one task-linked Superset workspace. This manual legacy fallback performs one duplicate-safe workspace-first launch after one mutation gate. Active Maestro projects are routed to orchestrate, which uses the same primitive directly for batches.
argument-hint: "<linear-issue-id> [--manual]"
effort: high
allowed-tools: Bash(superset --version), Bash(superset status:*), Bash(superset hosts list:*), Bash(superset projects list:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset workspaces get:*), Bash(superset terminals list:*), Bash(superset agents create:*), Bash(node:*), Read, Write, Agent, mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_comment
---

# spawn

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned line only when non-empty. Skip on failure or disabled voice; never retry or mention it.

## Voice

Read `../../persona.md` at the start. Apply it to wrapper lines only; commands, records,
and reports stay plain.

**Scope:** this skill only. Restore the session voice after the final report.

This skill is **rigid** — execute steps in order.

## Language

Match the user's language and preserve technical identifiers.

## When you're invoked

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md` first. This is the
manual/legacy single-workspace fallback and branch-guard target. Project orchestration
never invokes this skill; `monkey-maestro:orchestrate` executes the same verified
workspace-first primitive directly for a locked batch. This skill never creates a branch
in place and never changes Linear status.

## Step 0 — Resolve the issue and project ownership

1. Require one exact Linear issue identifier. Fetch it with relations and capture its
   exact `identifier`, title, project id, and provider branch name. The connector `id`
   may be an identifier or transport UUID and is not Maestro identity. For project
   ownership, normalize absent and `null` as no project.
2. Run `superset tasks get <identifier> --json`; require a non-empty task `id`,
   `externalProvider === "linear"`, and `externalKey === identifier`. When the issue has
   a project, require `externalProjectId === issue.projectId`. When it has no project,
   require `externalProjectId` to be absent or `null`; normalize absent and `null` as no
   project. The `taskId` is always the returned Superset `task.id`, never a Linear UUID,
   issue identifier, or inferred branch token.
3. Only when `issue.projectId` is non-empty, dispatch `project-snapshot-loader` with
   `MODE: control-only` for that exact project. If one valid latest control is active,
   refuse the manual bypass and report `monkey-maestro:orchestrate <project-id>`.
   `CONTROL_AMBIGUOUS`, `CONTROL_INVALID`, an unknown schema, or malformed/conflicting
   highest-revision records stop without mutation and report:
   `Next: stopped — repair the malformed or conflicting Linear control records`. Never
   recommend `start` or `reconcile` while authority is invalid. Missing or inactive
   control may continue. If the issue has no project, skip the project snapshot loader
   entirely and continue with the `manual:<identifier>` lock scope.
4. Verify `superset --version`, authentication through read-only host/project lists, and
   `superset status --json`. Resolve one exact host, Superset project, and terminal agent
   from explicit context or ask only when zero/multiple matches remain. Mint one UUID v4
   `standaloneRunId` for the complete attempt.

## Step 1 — Duplicate check and one mutation gate

1. Run `superset workspaces list --host <host> --project <project> --json` and group
   exact `taskId === task.id` matches.
   - Multiple: return `ambiguous` with every workspace id; create nothing.
   - One: inspect it with `workspaces get` and `terminals list`, return
     `existing`/`partial`, and create nothing. Standalone mode is read-only for this
     orphaned-runtime path; report `Linear record: missing` rather than writing without a
     separate repair approval.
   - Zero: continue.
2. Build the exact workspace name from `<identifier-lower>-<kebab-title>` and this worker
   prompt:

   ```text
   Work on Linear issue <identifier>. First run linear-devotee:greet <identifier>; greet
   alone owns the In Progress transition. Then plan, implement, verify, and open the PR
   through the normal skills. Do not invoke another project dispatcher or mark the issue
   completed. Finish with SUPERSET_WORKER_DONE or SUPERSET_WORKER_BLOCKED using the
   standard task/summary/files/checks/handoff or task/reason/needs fields.
   ```

3. Show the complete two-stage mutation (`workspaces create`, verification, then
   `agents create`) plus the Linear execution receipt and ask exactly:

   ```text
   Create this task-linked workspace and launch its agent? (y / cancel)
   ```

   Continue only on `y`.

4. Immediately after standalone confirmation, acquire the project/task lock through
   `scripts/project-lock.mjs acquire` using the issue's project id (or exact
   `manual:<identifier>` scope without a project) and `standaloneRunId`. Under the lock,
   refetch the issue with relations and require its project ownership to remain exact,
   including an unchanged absence of project. Then re-read its current project control
   only when that unchanged project id is non-empty; for an unchanged project-less issue,
   skip the project snapshot loader again. Re-resolve
   `superset tasks get <identifier> --json` with the same normalized project binding and
   rerun the exact `taskId` workspace query.
   A moved, canceled/non-startable issue, changed task binding, newly active control,
   invalid control authority, changed host/project choice, or existing/ambiguous runtime
   invalidates the approval and stops without mutation. Invalid authority reports the
   same control-record repair instruction from Step 0, never reconciliation. Release the
   token in `finally`.

## Step 2 — Workspace first

1. Run exactly:

   ```text
   superset workspaces create --host <hostId> --project <supersetProjectId> \
     --name <name> --task <taskId> --json
   ```

   Do not pass `--agent`; verification must precede agent launch.

2. If the command errors or returns unknown JSON, re-list exact task matches once. Zero
   means `workspace_failed`; one is recovered ambiguous-response success; multiple is
   `ambiguous`. Never blindly retry creation.
3. Run `superset workspaces get <workspaceId> --host <hostId> --json`. Require exact
   workspace, host, Superset project, `taskId`, and worktree type. Capture its branch.
   Any mismatch blocks agent launch and preserves the workspace.

## Step 3 — Agent second and durable receipt

1. Snapshot terminals. Run:

   ```text
   superset agents create --workspace <workspaceId> --host <hostId> \
     --agent <agent> --prompt <prompt> --json
   ```

2. Re-list terminals. Accept one exact terminal id returned by the command or one exact
   new terminal relative to the snapshot. Zero is `partial`; multiple is
   `ambiguous_terminal`. Never launch a second agent automatically.
3. Build `nuthouse:maestro-execution` through `records.mjs build-execution` with the
   `standaloneRunId`, exact task/workspace/terminal/branch/agent/host, timestamp, and
   `verified` or `partial` outcome. Save it as a Linear issue comment.
4. A failed record write after verified runtime creation is `degraded` traceability. Keep
   the runtime untouched and never redispatch it automatically.

## Step 4 — Report and stop

Return the exact standalone result to the user. Never continue implementing in the
current workspace; the new terminal agent owns the issue after greet.

## Final Report

```text
monkey-maestro:spawn report
  Issue/task:     <identifier> / <Superset task UUID>
  Authorization: standalone <standaloneRunId> confirmed
  Outcome:        verified | partial | existing | ambiguous | failed | degraded
  Host/project:   <hostId> / <supersetProjectId>
  Workspace:      <workspaceId | _none_>
  Terminal:       <terminalId | _none_>
  Branch:         <branch | _none_>
  Agent:          <agent>
  Linear record:  written | missing
  Status change:  none — linear-devotee:greet owns In Progress
```

## Never

- Bypass an active or invalid Maestro project control; route active work to
  `monkey-maestro:orchestrate` and invalid authority to explicit Linear control-record
  repair.
- Call `project-snapshot-loader` without one exact non-empty Linear project id.
- Create a duplicate when any exact/ambiguous task runtime exists.
- Skip standalone confirmation or mutate after the human wait without reacquiring the
  project/task lock and rechecking ownership.
- Combine workspace and agent creation, retry an ambiguous mutation blindly, or launch a
  second agent automatically.
- Delete a workspace or terminal after partial/degraded failure.
- Change Linear status, complete an issue, create a branch in place, or coordinate a
  project batch.
- Run `git commit`, `git push`, or `git rebase`.
