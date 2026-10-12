---
name: spawn
description: Launch or recover one scoped issue in its Superset workspace, or one bounded quick fix. Full issue delivery through merge requires explicit scope; project concurrency is not applied.
argument-hint: "<linear-issue-id | quick-fix objective> [--through-merge] [--quick] [--host <id>] [--superset-project <id>] [--agent <name>]"
effort: high
allowed-tools: Read, Bash(node:*), Bash(sleep:*), Bash(git rev-parse:*), Bash(superset status:*), Bash(superset hosts list:*), Bash(superset projects list:*), Bash(superset agents list:*), Bash(superset tasks get:*), Bash(superset tasks list:*), Bash(superset workspaces list:*), Bash(superset workspaces get:*), Bash(superset workspaces create:*), Bash(superset terminals list:*), Bash(superset terminals read:*), Bash(superset agents read:*), Bash(superset agents create:*), Agent
---

# spawn

Read `../../persona.md`; it is canonical for this skill's user-facing output until the report. Read
`${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md` for identities, groups, worker
ownership, and handoff rules.

This path launches or recovers at most one worker within explicit caller authority. It
never reads or creates project controls or calculates project capacity. It allocates no
run group: new manual workspaces inherit the caller's groups, and recovered workspaces
keep all their groups, including an existing orchestration group. The worker follows its own
authorized issue lifecycle; the launcher does not mutate Linear.

## Workflow

1. Select exactly one mode:
   - one exact Linear identifier without `--quick` → read
     [references/issue-mode.md](references/issue-mode.md);
   - `--quick` or a free-form objective → read
     [references/quick-fix-mode.md](references/quick-fix-mode.md).
     Ask one concise clarification if neither yields non-empty work. An unavailable issue never
     silently becomes a quick fix.
2. Fix the worker scope from the user's request or the caller's explicit envelope.
   `--through-merge` or an existing exact issue delivery authorization selects full delivery;
   an ordinary issue launch keeps `draft-pr` scope. A quick fix keeps edit/check scope and
   cannot use the issue-only flag. Resolve host, project, and terminal-capable Codex/Claude
   agent with **Start discovery and approval** in the shared contract, without reading a
   project control. Preserve supplied configuration and ask only about unresolved choices.
   Apply the shared **Worker boundary** to both issue and quick-fix prompts. When a
   supervisory caller supplies notification context, read
   [native notifications](../orchestrate/references/notifications.md), preserve its actual
   destination and probe evidence, and verify that the exact route still applies before
   launch. Include the worker's actual lead identity once exposed. Manual spawn without
   that caller keeps its ordinary result and never invents a master, control, or timer.
3. List workspaces once. Issue mode matches exact task binding, never display name. Quick-fix mode
   matches exact name and branch. Zero matches means `create`; one exact match means `recover`;
   multiple matches or malformed evidence refuse mutation.
4. List live terminals for the exact existing workspace. At either terminal inspection,
   unavailable, failed, malformed, or unclassifiable evidence stops the invocation and launches
   nothing. A live terminal blocks launch unless exact retained creator evidence and
   inspected output establish a completed setup shell under **Workspace setup**. Names
   and idle prompts cannot establish that exception. For create, apply **Manual spawn**
   under **Workspace groups** in the shared contract; for recover, preserve existing
   groups without retagging. In issue mode, never narrow that listing by name or group.
5. Show one preview containing mode, work/status, binding, host, project, agent, create/recover,
   workspace identity/groups, explicit delivery scope, and complete worker prompt. Existing
   authorization covers this action when it matches. Otherwise obtain one scope approval:

   ```text
   Create or recover this worker with the displayed scope? (y / cancel)
   ```

6. With authorization in issue mode, refresh the issue and blockers immediately before
   mutation; terminal or unknown issue state cancels launch. Quick-fix mode keeps its
   no-Linear boundary. Attempt at most one workspace creation:

   ```text
   superset workspaces create --project <project> --host <host> <bindingArgs> \
     --name '<workspaceName>' <tagArgs> --json
   ```

   Require an exact mode-bound workspace id and expected branch/task association readback
   through `superset workspaces get`. Retain any setup terminal ids returned by this
   successful creator call, which must contain no agent or command launch. Inspect them
   according to **Workspace setup** and establish readiness before continuing; report
   failed setup without rerunning it or changing repository settings silently.
   Launch only when creation explicitly returns `alreadyExists: false`; if it says `true`,
   report `concurrent-reuse` and launch nothing. Missing evidence launches nothing. Recover keeps the
   exact inspected workspace id. Recovery of an uncertain previous launch requires explicit
   evidence that it failed or ended; an empty live listing alone does not prove this. Preserve
   a confirmed existing provider session id for `--resume-session`, never a terminal id.

7. Immediately list the chosen workspace's terminals once more. Attempt one agent launch only
   when that successful, parseable listing contains no live session except the exact
   proven setup shells whose readiness was verified. An unknown or foreign terminal
   prevents launch. Require
   explicit success before reporting `dispatched`:

   ```text
   superset agents create --workspace <workspaceId> --host <host> \
     --agent <agent> <resumeArgs> --prompt <workerPrompt> --json
   ```

   `resumeArgs` is `--resume-session <providerSessionId>` only for a confirmed ended session
   with supported native resume; otherwise omit it. A fresh recovery after confirmed failure
   must reconstruct existing Git/PR/Linear work rather than restart completed stages. Require
   `kind: terminal` plus its `sessionId`. A chat result is unsupported transport and never
   triggers a second agent. Preserve a workspace after launch failure; never retry an unknown outcome in this invocation
   and never write execution telemetry. In issue mode, `launch-unknown` reports
   `monkey-maestro:reconcile <projectId> <issueId>`.

## Report

```text
monkey-maestro:spawn
  Mode:      issue | quick-fix
  Work:      <issue status/blockers | exact objective>
  Binding:   <task id | branch>
  Scope:     issue-through-merge | draft-pr | edit-and-check
  Notify:    <verified caller destination | no supervisory caller>
  Workspace:created | reused | none
  Groups:    <inherited, existing, or root>
  Result:    dispatched | already-running | concurrent-reuse | launch-failed |
             launch-unknown | already-terminal | blocked | canceled | degraded
```

The launcher never changes Linear, merges, pushes, changes dependency links, or matches
issue workspaces by display name. It grants no scope beyond the user's or caller's explicit
authorization. It creates at most one workspace and makes at most one launch attempt.
