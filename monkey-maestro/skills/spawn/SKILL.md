---
name: spawn
description: Use when the user explicitly wants either one Linear-authorized issue launched or recovered in a task-linked Superset workspace, or one free-form quick fix launched in a branch-bound workspace.
argument-hint: "<linear-issue-id | quick-fix objective> [--quick] [--host <id>] [--superset-project <id>] [--agent <name>]"
effort: high
allowed-tools: Read, Bash(node:*), Bash(git rev-parse:*), Bash(superset status:*), Bash(superset projects list:*), Bash(superset agents list:*), Bash(superset tasks get:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset terminals list:*), Bash(superset agents create:*), Agent
---

# spawn

Read `../../persona.md`; it is canonical for this skill's user-facing output until the report. Read
`${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md` for identities, groups, worker
ownership, and handoff rules.

This manual path launches or recovers at most one worker after one approval. It never obeys a
project control or changes Linear scheduling. Never read or obey a Linear project control.

## Workflow

1. Select exactly one mode:
   - one exact Linear identifier without `--quick` → read
     [references/issue-mode.md](references/issue-mode.md);
   - `--quick` or a free-form objective → read
     [references/quick-fix-mode.md](references/quick-fix-mode.md).
     Ask one concise clarification if neither yields non-empty work. An unavailable issue never
     silently becomes a quick fix.
2. Resolve host, Superset project, and agent independently. Prefer explicit flags. Otherwise use a
   healthy `superset status`; then the exact id following `.superset/worktrees/`, an exact local
   project whose path owns the cwd or Git common directory, or the sole local project; then the
   exact active-runtime agent/preset or sole listed agent. Collect every unresolved selector and
   deterministic choice into one clarification; that reply configures transport but does not
   approve mutation.
3. List workspaces once. Issue mode matches exact task binding, never display name. Quick-fix mode
   matches exact name and branch. Zero matches means `create`; one exact match means `recover`;
   multiple matches or malformed evidence refuse mutation.
4. List live terminals for the exact existing workspace. At either terminal inspection,
   unavailable, failed, malformed, or unclassifiable evidence stops the invocation and launches
   nothing. A live or status-unknown terminal returns `already-running` without approval or
   launch. For create, resolve inherited groups from the shared contract; for recover, preserve
   existing groups. In issue mode, never narrow that listing by name.
5. Show one preview containing mode, work/status, binding, host, project, agent, create/recover,
   workspace identity/groups, and complete worker prompt. Ask exactly once:

   ```text
   Create or recover this displayed worker? (y / cancel)
   ```

6. On approval, attempt at most one workspace creation:

   ```text
   superset workspaces create --project <project> --host <host> <bindingArgs> \
     --name '<workspaceName>' <tagArgs> --json
   ```

   Require an exact mode-bound workspace id. Launch only when creation explicitly returns
   `created`; if it says `reused`, report `concurrent-reuse` and launch nothing. Recover keeps the
   exact inspected workspace id.

7. Immediately list the chosen workspace's live terminals once more. Attempt one agent launch only
   when that successful, parseable listing proves no live or status-unknown terminal, and require
   explicit success before reporting `dispatched`:

   ```text
   superset agents create --workspace <workspaceId> --host <host> \
     --agent <agent> --prompt <workerPrompt> --json
   ```

   Preserve a workspace after launch failure; never retry an unknown outcome in this invocation
   and never write execution telemetry. In issue mode, `launch-unknown` reports
   `monkey-maestro:reconcile <projectId> <issueId>`.

## Report

```text
monkey-maestro:spawn
  Mode:      issue | quick-fix
  Work:      <issue status/blockers | exact objective>
  Binding:   <task id | branch>
  Workspace:created | reused | none
  Groups:    <inherited, existing, or root>
  Result:    dispatched | already-running | concurrent-reuse | launch-failed |
             launch-unknown | already-terminal | blocked | canceled | degraded
```

Never change Linear, read project controls, calculate project capacity, merge, push, modify
dependencies, create more than one workspace, launch more than once, or match issue workspaces by
their mutable display name.
