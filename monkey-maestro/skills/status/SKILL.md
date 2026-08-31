---
name: status
description: Use automatically when the user supplies a Linear project URL or asks to inspect one project's Maestro state. Reads only the minimal control plus live Linear statuses and blockedBy links, reports the deterministic frontier, and never inspects Superset or requires reconciliation.
argument-hint: "<linear-project-url-or-id>"
effort: medium
allowed-tools: Read, Write, Agent, Bash(node:*), Bash(mktemp:*), Bash(rm:*), mcp__claude_ai_Linear__get_project
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# status

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try `warden:voice` with `SUMMARY: <≤15 words, user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print only a non-empty line. Skip failure or disabled voice without mention or retry.

## Voice

Read `../../persona.md`. Use it only around the concise final report; provider evidence
and machine data stay neutral. Restore the session voice afterward.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This skill is strictly
read-only and Linear-only. It never calls Superset, GitHub, a lock, `reconcile`, or another
public skill.

## Workflow

1. Require one exact Linear project reference. Accept a URL only when the host is exactly
   `linear.app` and one non-empty path segment follows `/project/`. Reject issue URLs,
   bare issue identifiers, malformed URLs, and multiple references before provider calls.
2. Resolve the reference with Linear `get_project`; capture the exact returned project id.
3. In parallel, dispatch:
   - `monkey-maestro:control-loader` for that project;
   - `monkey-maestro:project-snapshot-loader` with `MODE: full`.
4. Pass the complete control-loader envelope plus exact `expectedProjectId` to
   `scripts/records.mjs resolve-controls`; retry an unavailable/invalid retrieval once. A
   malformed obsolete v1 field is only a warning when operational fields remain
   projectable.
5. Build the disposable cache only through `scripts/linear-snapshot.mjs`: `hydrate` the
   exact expected project/full snapshot; use `recover-full` for one exact targeted retry
   of identifiable malformed rows; use `recover-full-unknown` only when those exact
   validator-attributed ids remain malformed before a cache exists; use `refresh` for
   schema-valid scoped unknown retries; and `mark-unknown` for retry-exhausted ids after
   hydration. Never splice issue or unknown arrays
   manually. Retry a project-wide unknown once with the same full scope, then run
   `planLinearFrontier` through `scripts/linear-frontier.mjs`. Never derive readiness
   manually or from control history.
6. Report one deterministic table:

```text
Issue | Linear status | Live blockers | Classification | Reason
```

7. Report control as `active`, `inactive`, `not-configured`, or `unusable`, followed by:
   - active with ready/started work: `Next: monkey-maestro:orchestrate <project-id>`;
   - active with no ready/started work: `Next: idle`;
   - inactive or absent: `Next: monkey-maestro:start <project-id>`;
   - unusable: `Next: repair the conflicting or malformed control comments`.

Never recommend `reconcile` for a link change, stale history, runtime residue, or unrelated
unknown issue. A scoped unknown stays on its row. Total Linear unavailability produces a
read-only `degraded` report and no invented frontier.

## Report

```text
monkey-maestro:status report
  Project:  <id / name>
  Control:  <active | inactive | not-configured | unusable>
  Frontier: <ready N · started N · blocked N · terminal N · unknown N>
  Runtime:  not inspected
  Next:     <action>
```
