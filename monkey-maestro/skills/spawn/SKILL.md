---
name: spawn
description: Use when Monkey Maestro must dispatch one Linear issue into a task-linked Superset workspace, or when the branch guard redirects an attempted in-place branch creation. Project-authorized mode inherits active control and needs no per-issue gate; standalone mode shows one explicit mutation gate. Captures workspaceId and terminalId and records partial/degraded outcomes without duplication.
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

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md` first. This skill owns
one issue dispatch. It never creates a branch in place and never changes Linear status.

## Step 0 — Resolve the issue and authorization

1. Require one exact Linear issue identifier. Fetch it with relations and capture its
   exact `identifier`, title, project id, and provider branch name. The fetched
   connector `id` may be an identifier or transport UUID and is not the Maestro identity.
   Run `superset tasks get <identifier> --json`; require a non-empty task `id`,
   `externalProvider === "linear"`, `externalKey === identifier`, and
   `externalProjectId === issue.projectId`. The `taskId` is always the returned Superset
   `task.id`, never a Linear UUID, identifier, or inferred branch token.
2. Determine authorization from the invocation packet:
   - **Project mode** requires the complete output of `records.mjs
build-authorization`: `{kind: "project", projectId, runId, revision, decisionHash,
lockToken, issueId, taskId, eligibility, authorizationHash}` from `reconcile`. First run
     `records.mjs validate-authorization` and require the argument/fetched identifier to
     equal its hash-bound `issueId` and the validated task binding to equal its hash-bound
     `taskId`. Dispatch `monkey-maestro:project-snapshot-loader` in
     `full`; require the latest control active and every control field equal, the issue
     still present exactly once in that project, its status and blocker fields known,
     and all exact waiver evidence still valid. Rebuild the authorization with those
     fresh normalized facts and require byte-equivalent canonical content plus the same
     `authorizationHash`. Run `scripts/project-lock.mjs inspect` and require its owner
     token/run/project to match. Inherit its host, Superset project, default agent, and
     repository. No user confirmation is requested.
   - **Standalone mode** has `{kind: "manual"}` or a branch-guard/user invocation. If the
     issue belongs to an active Maestro project, refuse the bypass and point to
     `monkey-maestro:reconcile <project-id>`. Otherwise resolve one host, Superset project,
     agent, and optional issue agent override from explicit user choices. Mint a UUID v4
     `standaloneRunId` now; every later lock and execution record in this attempt uses it.
3. Verify `superset --version`, authentication through read-only list commands, and that
   `superset status --json`/host/project ids are trustworthy. Never run login.

## Step 1 — Duplicate and mutation gate

1. Run `superset workspaces list --host <host> --project <project> --json` and group exact
   `taskId === task.id` matches.
   - Multiple: return `ambiguous` with every workspace id; create nothing.
   - One: inspect `workspaces get` and `terminals list`, return `existing`/`partial`, and
     create nothing. Project mode may repair a missing execution comment under its active
     control. Standalone mode is read-only for this orphaned-runtime path and must report
     `Linear record: missing`; it never calls `save_comment` without a separate explicit
     repair approval.
   - Zero: continue.
2. Build the exact workspace name from `<identifier-lower>-<kebab-title>` and the agent
   prompt. The prompt begins:

   ```text
   Work on Linear issue <identifier>. First run linear-devotee:greet <identifier>; greet
   alone owns the In Progress transition. Then plan, implement, verify, and open the PR
   through the normal skills. Do not invoke another project dispatcher or mark the issue
   completed.
   ```

3. In standalone mode only, show the complete two-stage mutation (`workspaces create`
   then `agents create`) with host/project/task/agent/prompt and ask:

   ```text
   Create this task-linked workspace and launch its agent? (y / cancel)
   ```

   Continue only on `y`. Project mode's active control + held lock is the existing gate.

4. Immediately after standalone confirmation, acquire
   `${CLAUDE_PLUGIN_DATA}/locks` with `scripts/project-lock.mjs acquire`, using the issue's
   Linear project id as `projectId` (or the exact `manual:<identifier>` scope when it has no
   project) and `standaloneRunId` as `runId`. Under that lock, refetch the issue with
   relations, re-resolve `superset tasks get <identifier> --json`, re-read its current
   project control, and rerun the exact `taskId` workspace query. Any moved,
   canceled/non-startable issue, changed task binding, newly active Maestro control, changed
   host/project choice, or one/multiple runtime match invalidates the approval and stops
   without mutation. Release this exact token in `finally`.
5. In project mode, immediately before creation, re-inspect the held lock and control,
   perform one final full Linear reload, rebuild/compare the per-issue authorization, and
   rerun the exact `taskId` query. Any mismatch refuses the dispatch. These are the final
   eligibility and ownership checks; never create from the earlier resolver snapshot
   alone.

## Step 2 — Workspace first

1. Run exactly:

   ```text
   superset workspaces create --host <hostId> --project <supersetProjectId> \
     --name <name> --task <taskId> --json
   ```

   Do not pass `--agent`; verification must precede agent launch.

2. If the command errors or its JSON is unknown, immediately re-list exact `taskId`
   matches once. Zero means `workspace_failed`; one is a recovered ambiguous-response
   success; multiple is `ambiguous`. Never blindly retry creation.
3. Run `superset workspaces get <workspaceId> --host <hostId> --json`. Require exact
   workspace, host, Superset project, `taskId`, and worktree type. Capture its branch.
   Any mismatch blocks agent launch and reports the preserved workspace.

## Step 3 — Agent second

1. Snapshot current terminals. Run:

   ```text
   superset agents create --workspace <workspaceId> --host <hostId> \
     --agent <agent> --prompt <prompt> --json
   ```

2. Re-list terminals. Accept one exact terminal id returned by the command or one exact
   new terminal relative to the pre-launch snapshot. Zero is `partial`; multiple is
   `ambiguous_terminal`. Never launch a second agent automatically.
3. Build a versioned execution body with `scripts/records.mjs build-execution`:
   - `verified` when workspace and terminal are exact;
   - `partial` when the workspace exists but the agent/terminal is not exact;
   - include run, taskId, workspaceId, optional terminalId, branch, agent, host, timestamp,
     and detail.
   - use `authorization.runId` in project mode and the minted `standaloneRunId` in
     standalone mode; an execution record is never built with a missing run id;
4. Save that body as a Linear **issue** comment. If this write fails after verified
   runtime creation, return the runtime as `degraded`, `linearRecorded: false`, and keep
   everything running. The next reconciliation repairs from `taskId`.

## Step 4 — Report and stop

Return the structured result to `reconcile` or the user. Never continue implementing in
the current workspace; the new agent owns the issue after greet.

## Final Report

```text
monkey-maestro:spawn report
  Issue/task:     <identifier> / <Superset task UUID>
  Authorization:  project <runId> + <authorizationHash> | standalone <standaloneRunId> confirmed
  Outcome:        verified | partial | existing | ambiguous | failed | degraded
  Host/project:   <hostId> / <supersetProjectId>
  Workspace:      <workspaceId | _none_>
  Terminal:       <terminalId | _none_>
  Branch:         <branch | _none_>
  Agent:          <agent>
  Linear record:  written | missing (repair on reconcile)
  Status change:  none — linear-devotee:greet owns In Progress
```

## Never

- Create a duplicate when any exact/ambiguous `taskId` runtime already exists.
- Skip standalone confirmation or add a per-issue gate under valid project authorization.
- Mutate from a standalone approval without reacquiring the project/task lock and
  rechecking exact task ownership plus active Maestro control.
- Accept project authorization for a different issue/project or after fresh eligibility
  facts no longer reproduce its `authorizationHash`.
- Combine workspace and agent creation in one command.
- Retry an ambiguous workspace/agent mutation blindly.
- Delete a workspace or terminal after partial/degraded failure.
- Change Linear status, complete an issue, create a branch in place, or invoke `superset-orchestrate`.
- Run `git commit`, `git push`, or `git rebase`.
