---
name: start
description: Use when the user wants to activate Monkey Maestro for a verified Linear project — "active Maestro", "start project execution", "configure project concurrency", or "conduct this project". Writes one versioned Linear control record after a single approval, then enters the durable orchestration session that launches and monitors ready Superset workers.
argument-hint: "<linear-project-id>"
effort: high
allowed-tools: Bash(git rev-parse:*), Bash(gh repo view:*), Bash(superset --version), Bash(superset status:*), Bash(superset hosts list:*), Bash(superset projects list:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset workspaces get:*), Bash(superset terminals list:*), Bash(superset agents create:*), Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_comment
---

# start

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all
wrapper output. Keep record previews and reports plain.

**Scope:** local to this skill only. Revert to the session voice after the final report.

This skill is **rigid** — execute steps in order.

## Language

Match the user's language. Keep ids, paths, CLI flags, record fields, and tool names in
their original form.

## When you're invoked

The user wants to authorize and begin project-level execution once. Read
`${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md` before proceeding. This
skill persists control, then invokes one exact `monkey-maestro:orchestrate` session after
its activation lock is released. `orchestrate` is the normal project dispatcher;
`reconcile` is reserved for explicit recovery or audit.

## Step 0 — Preconditions

1. Require one exact Linear project id from `$ARGUMENTS` or the user's explicit context.
2. Verify `superset --version`, `superset status --json`, `superset hosts list --json`,
   `superset projects list --host <host> --json`, `git rev-parse --show-toplevel`, and
   `gh repo view --json nameWithOwner`. Never log in or change configuration.
3. Dispatch `monkey-maestro:project-snapshot-loader` once with `MODE: control-only`.
   Require that response to include one exact `nuthouse:project-graph-receipt` with
   `verified: true`, a SHA-256 graph hash, and a complete `decisionBaseline`. Missing,
   malformed, duplicate, or unverified receipts stop with `graph_unverified`; never run
   a full project load merely to activate control.
4. If the latest valid control is already active, retain it unchanged, report
   `already-active` with its run, host, agent, and concurrency, skip Steps 1–3, and
   continue to orchestration in Step 4. An inactive control may be
   restarted only through the approval below and gets a new `runId`. Retain that latest
   inactive control as the restart authority; do not fall back to the original graph
   receipt's baseline.

## Step 1 — Resolve the activation policy

1. Resolve `repository` from GitHub, `targetHostId` from the accessible host list, and
   `supersetProjectId` by exact id/path association on that host. Ask only when there are
   zero or multiple matches.
2. Ask for the default Superset agent preset/config once. It becomes the project default;
   a later explicitly approved issue override may replace it for that issue only.
3. Ask for `maxConcurrency`, defaulting to **4**. It must be an integer from 1 through
   **10**; reject larger, zero, negative, or fractional values before preview.
4. Mint a UUID v4 `runId`. Build the control with
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/records.mjs build-control`. On first activation use
   the verified receipt's `decisionBaseline` and graph hash. On restart use the latest
   inactive control's exact `decisionBaseline` as the new decision baseline and preserve
   its `executionIssueIds` and `exitedExecutionIssueIds`; orchestration hydrates fresh
   Linear state against that carried baseline only after activation. The helper canonicalizes the baseline, binds
   `decisionHash`, initializes both execution id sets to `[]` only on first activation,
   defaults concurrency, and creates revision 1 (or the previous revision + 1).

## Step 2 — Single activation gate

Print the exact record JSON and summarize: project, repository, Superset project, target
host, agent, concurrency, graph hash, decision hash, and revision. Ask exactly:

```text
Activate Maestro for this Linear project? (y / edit / cancel)
```

On `edit`, change requested inputs, rebuild the entire record, and show the new hashes.
On `cancel`, stop without mutation. Only `y` authorizes the one project-comment write.

## Step 3 — Persist control

1. After approval, require the current `superset status --json` host to equal the chosen
   target host. Acquire the project lock through `scripts/project-lock.mjs acquire` with
   the proposed run id. If held, exit without
   Linear mutation. Re-read the graph receipt and latest control under the lock; any
   changed/unverified receipt or newly active control invalidates the preview and stops.
2. Create a Linear project comment using the helper's exact Markdown body. If the write
   fails or its returned id cannot be verified, report `control_write_failed`; no
   execution is authorized.
3. Re-read the comment through the snapshot loader and require the same `runId`,
   `decisionHash`, and revision before reporting active.
4. Release the exact lock token through `scripts/project-lock.mjs release` in `finally`
   on every outcome. A failed activation exits after release. A verified active control
   continues to Step 4 only after release; never transfer or reuse the activation lock
   token as orchestration authority.

## Step 4 — Start orchestration

1. Require the activation lock to have been released and the exact control to be
   verified active. This also applies to the unchanged control from the `already-active`
   path.
2. Invoke `monkey-maestro:orchestrate <project-id>` exactly once. Use the installed skill
   workflow directly. If the runtime cannot nest a skill call, read
   `${CLAUDE_PLUGIN_ROOT}/skills/orchestrate/SKILL.md` and execute that exact workflow in
   this context; do not implement an abbreviated start-only dispatcher.
3. Do not request a second activation gate or a per-issue gate. The active control is
   the project authorization. Graph drift outside the approved decision baseline is
   reported as `reconcile_required`; never launch a full reconciliation automatically.
4. Capture and surface the live orchestration result. A held dispatch lock,
   unavailable provider, no eligible work, exhausted capacity, or partial result does
   not roll back the durable active control. The orchestration skill owns measured
   terminal monitoring and incremental transitions for this session.
5. Do not run `monkey-maestro:reconcile` before or during ordinary startup. A later
   explicit recovery request may reconcile drift and then resume with
   `monkey-maestro:orchestrate <project-id>`.

## Subagent dispatch

```text
Agent({
  subagent_type: 'monkey-maestro:project-snapshot-loader',
  description: 'load verified project control state',
  prompt: `PROJECT_ID: <Linear project id>
MODE: <control-only | full>`,
})
```

## Final Report

```text
monkey-maestro:start report
  Project:       <Linear project id>
  Run:           <runId | _none_>
  Active:        true | false
  Repository:    <owner/name>
  Superset:      <project id> on <host id>
  Agent:         <default agent>
  Concurrency:   <N>/10 (default 4 when omitted)
  Decision hash: <sha256:...>
  Revision:      <N>
  Activation:    written | already-active | failed
  Start lock:    acquired then released | skipped | held | failed
  Orchestration: running | completed | no-op | reconcile_required | failed | not-run
  Dispatches:    <N launched in the initial batch | 0>
  Next:          monitoring | monkey-maestro:orchestrate <project id> | explicit monkey-maestro:reconcile <project id> | stopped (<reason>)
```

## Never

- Activate an unverified or ambiguous project graph.
- Accept concurrency outside 1–10.
- Mutate Linear without the single activation approval.
- Dispatch directly from `start` or begin orchestration before the activation lock is released.
- Ask a second activation or per-issue gate during the orchestration session.
- Run `monkey-maestro:reconcile` as part of normal activation or create a hidden automation.
- Store control in a local file or migrate a legacy relay flag.
- Hold a project lock across the activation confirmation gate.
- Run `git commit`, `git push`, `git rebase`, or any destructive Superset action.
