---
name: orchestrate
description: Use when the user wants Monkey Maestro to run an active Linear project. Loads Linear once, creates branch-idempotent Superset workspaces in parallel, launches only missing agents, and returns immediately.
argument-hint: "<linear-project-id>"
effort: medium
allowed-tools: Bash(superset tasks get:*), Bash(superset agents list:*), Bash(mktemp:*), Bash(rm:*), Bash(superset workspaces create:*), Bash(superset workspaces get:*), Bash(superset workspaces update:*), Bash(superset terminals list:*), Bash(superset agents create:*), Bash(node:*), Read, Agent
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# orchestrate

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try `warden:voice` through the shared persona-line contract. Print only a non-empty line. Skip failure or disabled voice without retry or mention.

## Voice

Read `../../persona.md`. Apply it only to short progress and final-report lines. Provider
evidence, commands, tables, and worker prompts remain neutral. Restore the session voice
afterward.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. The project orchestration
section defines this skill's fast path. Linear remains the only scheduling authority.
Superset transports work; it never decides readiness. Terminal rows never enter Superset.
Maestro never changes Linear lifecycle or dependency relations.

Require one exact Linear project id. Do not accept extra execution modes. Run one bounded
dispatch pass and return; a later Linear change needs a new invocation.

When the caller explicitly enters relay mode, require `WORKFLOW_DECISION` with the parent
manifest `run_id`, path, content hash, and effective profile. Validate it through this
plugin's install-local consumer and project the shared workflow baton before Linear or
Superset mutation. A missing field or mismatch launches nothing. Ordinary non-relay
orchestration does not invent a baton.

## Step 1 — Load and plan once

1. Dispatch `monkey-maestro:control-loader` and
   `monkey-maestro:project-snapshot-loader` `MODE: full` in parallel. Resolve both logical
   ids through the runtime map and pass the exact project id to both agents.
2. Pass the complete `control-loader` envelope plus exact `expectedProjectId` to
   `scripts/records.mjs resolve-controls`. Pass the exact expected project and full
   snapshot to `scripts/linear-snapshot.mjs hydrate`; reject invalid output before using
   its facts. Then plan it with `scripts/linear-frontier.mjs`. In short: run
   `resolve-controls`, then `linear-snapshot.mjs hydrate`, then `linear-frontier.mjs`.
3. Require one usable latest control whose project id matches, `active` is true, and
   host, Superset project, agent, and concurrency fields are complete. Inactive or
   unusable control returns `stopped`. Obsolete v1 graph/hash fields are warnings only.
4. A malformed control may be retried once. A global schema/scope or project-wide failure
   retries the same full retrieval once. Complete Linear failure prevents every Superset
   mutation. Return `degraded` if the retry still fails.
5. Use only the validated frontier. Eligible candidates are its ready and started
   non-terminal rows. Build stable issue-id pools for both classifications. Started rows
   reserve capacity first, even if their transport later fails; fill only the remaining
   slots from the ready pool. If both pools are empty, return `idle` immediately.

The coordinator keeps only this disposable table in conversation memory:

```text
Issue | Linear status | Runtime result | Failure
```

Do not persist a queue, scheduling cache, or runtime ownership record.

## Step 2 — Resolve exact task transport

Resolve task transport in bounded waves. The first wave contains every capacity-reserved
started row plus only enough ready rows to fill the remaining capacity. Run
`superset tasks get <issueId> --json` for every candidate in a wave in parallel. Validate
each response independently. Require the exact Linear task binding, project id, provider
branch, and usable task state.

A failed started row remains capacity-consuming because Linear says it is already
claimed. A failed ready row is non-transportable but consumes no dispatch slot: backfill
it from the next deferred ready row. Query only enough deferred rows to fill the open
slots, in parallel, and repeat only after a failure until capacity is full or the ready
pool is exhausted. Never query a candidate twice. The healthy path is one wave; backfill
adds work only for failed candidates.

After task validation, select at most `maxConcurrency` transportable candidates in stable
issue-id order. If eligible rows existed but none are transportable, return `degraded`,
not `idle`.

For every valid task, derive one deterministic workspace name from the issue identifier
and render the complete worker prompt before any creation call. The prompt is immutable
for this pass. In relay mode bind the validated baton into that immutable worker prompt
as exact `WORKFLOW_RUN_ID`, `WORKFLOW_PROFILE`, and `WORKFLOW_DECISION_HASH` fields. A
missing value or mismatch launches nothing for that candidate.

## Step 3 — Create or reuse workspaces directly

Call `superset workspaces create` once per candidate, in parallel, with the exact project,
host, task id, provider branch, deterministic name, `--skip-branch-prefix`, and `--json`:

```text
superset workspaces create \
  --project <supersetProjectId> \
  --host <targetHostId> \
  --task <taskId> \
  --branch <providerBranch> \
  --name <workspaceName> \
  --skip-branch-prefix \
  --json
```

Do not pass `--agent` or `--prompt` to `workspaces create`. Require one non-empty workspace
id and the boolean result field. `alreadyExists: false` means `created`.
`alreadyExists: true` means `reused`. Never pre-list workspaces. Branch-scoped creation is
the workspace idempotence boundary.

Before using a reused workspace, fetch that exact workspace once:

```text
superset workspaces get <workspaceId> --host <targetHostId> --json
```

Require its exact host, Superset project, and provider branch. If its `taskId` matches the
resolved task, continue. If its task binding is absent, repair it exactly once with:

```text
superset workspaces update <workspaceId> \
  --host <targetHostId> \
  --task-id <taskId> \
  --json
```

Require the update response to contain the exact task binding before launch. A different
non-empty task binding is an ownership conflict: fail only that candidate and never
overwrite it. Do not list the project workspace inventory.

If creation returns ambiguous, malformed, or mismatched evidence, fail that candidate.
Do not blindly repeat a creation call. One candidate failure never cancels a sibling;
all candidate sequences use all-settled semantics.

## Step 4 — Launch only when needed

Before the first launch of the invocation, re-check the control's `defaultAgent` against
the host once. The host can drop an agent after activation, so launch time is the
authoritative moment:

```text
superset agents list --host <targetHostId> --json > "$capture" 2>"$capture.err"
```

A non-zero exit or an empty capture is an unknown inventory, not a failure. Pass the
capture path and `defaultAgent` through `scripts/host-agents.mjs validate-launch`; its
result names the validated agent every launch below uses:

- `ok` — launch with `validation.agent`.
- `blocked` — launch nothing. `AGENT_NOT_CONFIGURED`, `HOST_AGENTS_NONE_CONFIGURED`, and
  `AGENT_UNNAMED` affect every candidate that still needs an agent, so report those
  candidates as degraded with `validation.configuredAgents`, and tell the user to re-run
  `monkey-maestro:start` with a selector the host reports. Preserve created and reused
  workspaces, and never substitute another agent.
- `unverified` — the inventory is unreadable; launch with `validation.agent` and let
  `superset agents create` remain the authority.

This check runs once in this skill's own sequence, before the per-candidate launches below.
It is not a per-candidate effect, and it never enters a dispatch result.

A blocked agent never affects a reused workspace whose live terminal already makes it
`already-running`, and never changes Linear state.

For a newly created workspace, call `superset agents create` once with the exact workspace,
host, validated agent, complete worker prompt, and `--json`.

For a binding-verified reused workspace, list its live terminals exactly once with:

```text
superset terminals list --workspace <workspaceId> --host <targetHostId> --json
```

One or more live terminals means `already-running`; do not launch another agent. Zero
live terminals means call `superset agents create` once. Use:

```text
superset agents create \
  --workspace <workspaceId> \
  --host <targetHostId> \
  --agent <validatedAgent> \
  --prompt <workerPrompt> \
  --json
```

Require a non-empty `sessionId` from `agents create`. Preserve a successfully created or
reused workspace when agent launch fails; report that candidate as degraded so a later
invocation can reuse it.

Return `busy` immediately after launches and runtime reuse decisions; never poll or wait
for workers. Do not read terminal output, send follow-ups, refresh Linear, or advance a
second batch in the same invocation.

This flow avoids duplicate workspaces and avoids relaunching an agent during an ordinary
retry. Agent launch is not an atomic cross-invocation claim, so callers must not run two
orchestration invocations for the same project concurrently.

## Worker prompt

Every worker prompt starts with `linear-devotee:greet <issueId>` and includes the issue
objective, scope, Acceptance, required verification, and these ownership constraints:

```text
WORKFLOW_RUN_ID: <parent run_id>              # relay mode only
WORKFLOW_PROFILE: <parent effective profile> # relay mode only
WORKFLOW_DECISION_HASH: sha256:<hex>          # relay mode only
```

These fields are decision identity, not a claim that the parent worktree manifest is
valid in the child worktree. Greet validates/resolves the child's local decision.

- own only this issue and its task-linked workspace;
- inspect repository instructions before editing;
- do not revert edits made by others;
- do not merge, push, or mutate dependencies;
- leave Linear lifecycle changes to `linear-devotee:greet` and the user workflow.
- retain human feature acceptance and manual merge as mandatory gates;
- never infer Linear completion from verification, a worker envelope, commit, or PR.

Require exactly one terminal handoff envelope:

```text
SUPERSET_WORKER_DONE
task: <issue identifier>
summary: <one-line outcome>
files: <comma-separated paths or none>
checks: <commands and outcomes>
handoff: <next-step context or none>
```

or:

```text
SUPERSET_WORKER_BLOCKED
task: <issue identifier>
reason: <specific blocker>
needs: <decision, access, or dependency required>
```

The envelope is a worker handoff only. It is not scheduling evidence and never mutates
Linear.

## Failure scope

- One Linear issue, task, workspace, terminal, or agent failure isolates that candidate.
- An agent the host no longer configures degrades every candidate awaiting a launch, and
  never substitutes a different agent.
- Complete Linear failure prevents every Superset mutation.
- Inactive or unusable control returns `stopped`.
- A shared Superset outage returns `degraded`; Linear remains unchanged.
- One candidate failure never cancels a sibling.
- Only an explicit `stop` action changes control activation.

## Report

```text
monkey-maestro:orchestrate report
  Project/run: <project id> / <run id>
  Linear:      bootstrap 1
  Frontier:    ready <n> · started <n> · blocked <n> · terminal <n> · unknown <n>
  Runtime:     created <n> · reused <n> · already-running <n> · launched <n>
  Agent:       <selector> · host inventory <ok | unverified | not-configured>
  Failures:    <per-candidate reasons or none>
  Exit:        idle | busy | degraded | stopped
```
