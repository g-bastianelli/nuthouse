---
name: status
description: Use automatically when the user supplies a Linear project URL (`linear.app/<workspace>/project/<slug>/...`) or asks to inspect/check one Linear project's Maestro state. Resolves the project and reports its graph receipt, control, dependencies, and durable executions read-only. Do not use for Linear issue URLs or issue identifiers; never starts or reconciles the project automatically.
argument-hint: "<linear-project-url-or-id>"
effort: medium
allowed-tools: Read, Agent, Bash(cat:*), mcp__claude_ai_Linear__get_project
---

# status

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. Skip on failure or disabled voice; never retry or mention it.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every `warden:voice` dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Voice

Read `../../persona.md` at the start. Apply it only around the final plain-language report;
provider data stays neutral.

**Scope:** this skill only. Restore the session voice after the final report.

## Language

Match the user's language. Preserve URLs, ids, record fields, and skill names exactly.

## When you're invoked

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is the lightweight,
read-only landing point for a Linear project link. It explains the project's durable
Linear state and the next available Maestro action. It does not inspect live Superset
runtime, acquire a lock, persist records, invoke another skill, or dispatch work.

## Step 0 — Accept only one project reference

1. Require one exact project reference from `$ARGUMENTS` or the user's explicit context.
2. A Linear URL is a project reference only when its host is exactly `linear.app` and its
   path has one non-empty segment immediately after `/project/`, for example
   `https://linear.app/acme/project/runtime-rework-a1b2c3/overview`. Query strings,
   fragments, and later project-page sections do not alter that project slug.
3. Never claim a `/issue/` URL or a bare issue identifier such as `TEAM-123`. Leave those
   to Linear Devotee. A malformed URL, an issue URL, zero references, or multiple project
   references produces `not-a-single-project` without any provider call.

## Step 1 — Resolve the canonical project id

For a project URL, pass the exact decoded path segment immediately after `/project/` to
Linear `get_project`. For an explicit project id, identifier, name, or slug, pass that
exact value. Require one resolved project whose returned id is non-empty. Do not derive a
project id from the URL suffix, an issue, a local cache, or a guessed UUID. An unavailable,
missing, or ambiguous lookup returns `project-unresolved` and stops read-only.

## Step 2 — Load durable project state

Dispatch exactly once:

```text
Agent({
  subagent_type: 'monkey-maestro:project-snapshot-loader',
  description: 'inspect Linear project Maestro state',
  prompt: `PROJECT_ID: <resolved Linear project id>
MODE: full`,
})
```

Use only the loader's normalized output. Do not supplement missing values from issue
titles, URL text, GitHub, Superset, or memory. Treat `executionRecords` as durable Linear
records only: this skill cannot claim their workspaces or terminals are currently live.

## Step 3 — Classify without mutation

Report:

- the exact project name and id;
- provider state and required/optional unknown counts;
- whether the graph receipt is verified, plus its graph hash when present;
- issue counts by normalized `statusType`, observed dependency-edge count, and whether
  `currentBaseline` differs from the active control's `decisionBaseline`;
- latest control state: missing, inactive, or active; when present include run id,
  revision, concurrency, target host, Superset project, and default agent;
- durable execution-record totals, separating records for the latest control run when a
  run exists;
- `Runtime: not inspected` so the report never implies fresh Superset reconstruction.

Choose one next action without executing it:

- invalid control authority — including `CONTROL_AMBIGUOUS`, `CONTROL_INVALID`, an
  unknown control schema, a decision-hash mismatch, malformed control fields, or
  duplicate highest revisions — takes precedence over every provider-partial or missing
  control branch → report `Control: invalid` and `Next: stopped — repair the malformed or
conflicting Linear control records`; never recommend `start` or `reconcile`;
- unavailable or required-partial Linear data → retry the status check after Linear
  recovers;
- missing or unverified graph receipt → verify/adopt the project graph before Maestro
  activation;
- missing or inactive control → explicit `monkey-maestro:start <project-id>`;
- active control → explicit `monkey-maestro:reconcile <project-id>` when the user wants
  one fresh runtime/dispatch pass.

## Final Report

```text
monkey-maestro:status report
  Project:          <name> (<Linear project id>)
  Linear:           ready | partial | unavailable
  Graph receipt:    verified <sha256:...> | missing | invalid
  Issues:           <total; normalized status counts>
  Dependencies:     <observed edge count; unchanged | changed | unknown>
  Control:          active | inactive | missing | invalid
  Run / revision:   <run id / N | _none_>
  Policy:           <N/10; agent; host; Superset project | _none_>
  Executions:       <N durable records; M for latest run>
  Runtime:          not inspected
  Unknowns:         <required N; optional N>
  Next:             <one explicit action or stopped reason>
```

## Never

- Handle a Linear issue URL or issue identifier as a project.
- Guess a project id from a URL suffix or an issue's project field.
- Call `start`, `reconcile`, `spawn`, or `stop` automatically.
- Treat ambiguous, malformed, hash-invalid, or unknown-schema control authority as a
  missing/inactive control or recommend mutation while it remains invalid.
- Inspect Superset/GitHub, acquire a lock, or imply durable records are live runtimes.
- Create, update, or delete Linear data, local state, workspaces, terminals, or agents.
- Run `git commit`, `git push`, `git rebase`, or any destructive action.
