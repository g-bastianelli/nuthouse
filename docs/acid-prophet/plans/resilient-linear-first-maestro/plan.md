---
id: resilient-linear-first-maestro
spec: docs/acid-prophet/specs/2026-08-30-resilient-linear-first-maestro.md
status: implemented
plan-version: 1
spec-version: 1
acceptance-ids:
  [
    AC-001,
    AC-002,
    AC-003,
    AC-004,
    AC-005,
    AC-006,
    AC-007,
    AC-008,
    AC-009,
    AC-010,
    AC-011,
    AC-012,
    AC-013,
    AC-014,
    AC-015,
    AC-016,
    AC-017,
    AC-018,
    AC-019,
    AC-020,
    AC-021,
    AC-022,
    AC-023,
    AC-024,
    AC-025,
    AC-026,
    AC-027,
    AC-028,
    AC-029,
  ]
validated-at: 2026-08-30
spec-synced-at: 2026-08-30
---

# Plan — Resilient Linear-first Monkey Maestro

## Context

Implement the ratified Linear-first Maestro spec by replacing historical graph authority
and multi-provider reconciliation with deterministic Linear and runtime planners. Preserve
the six public skills while making every failure issue-scoped.

## Files

- `monkey-maestro/lib/{linear-snapshot,linear-frontier}.mjs`: validated cache and frontier `[new]`.
- `monkey-maestro/lib/{runtime-snapshot,runtime-actions,orchestration-epoch}.mjs`: targeted runtime planning and batch execution `[new]`.
- `monkey-maestro/lib/{orchestration-effects,orchestration-effect-signal}.mjs`: invocation-bound production effect bridge `[new]`.
- `monkey-maestro/scripts/{linear-frontier,linear-snapshot,runtime-actions,runtime-snapshot,orchestration-epoch}.mjs`: JSON planners, strict cache/forensic boundaries, and bridge CLI `[new]`.
- `monkey-maestro/lib/records.mjs`: minimal control v2 and v1 projection `[modified]`.
- `monkey-maestro/lib/project-lock.mjs`: crash-recoverable lock without `.transition` `[modified]`.
- `monkey-maestro/skills/*/SKILL.md`: six Linear-first entry points `[modified]`.
- `monkey-maestro/agents/{control-loader,project-snapshot-loader,runtime-inspector}.md`: retrieval-only scoped agents `[new/modified]`.
- `monkey-maestro/shared/project-execution-contract.md`: shared v2 contract `[modified]`.
- `monkey-maestro/tests/*.test.mjs`: behavioral, migration, crash, and regression fixtures `[modified/new]`.
- `monkey-maestro/lib/{reconciliation-input,reconciliation-state}.mjs`: obsolete multi-provider authority `[delete]`.
- `monkey-maestro/scripts/reconcile-state.mjs`: obsolete resolver CLI `[delete]`.
- `monkey-maestro/tests/{reconciliation-input,reconciliation-state}.test.mjs`: superseded tests `[delete]`.
- `monkey-maestro/{README.md,.claude-plugin/plugin.json,.codex-plugin/plugin.json}`: public v2 behavior and release version `[modified]`.
- `.codex/agents/monkey_maestro__*.toml`, runtime maps: generated from canonical agents `[generated]`.
- `scripts/check-workflow-migration.mjs`, agent-generation policy tests, root inventories: enforce the new boundary `[modified]`.

## Acceptance coverage

- `AC-001`–`AC-007`, `AC-029` → steps 1–2, 12 · quickstart 1–2, 10.
- `AC-008`–`AC-020` → steps 3–4, 8–10 · quickstart 3–6.
- `AC-021`–`AC-027` → steps 5, 7–10 · quickstart 7–9.
- `AC-028` → step 6 · quickstart 9.

## Steps

- [x] Add validated Linear snapshot/cache helpers and tests.
      verify: `bunx bun test monkey-maestro/tests/linear-snapshot.test.mjs`
      covers: AC-001, AC-002, AC-003, AC-026
- [x] Add `planLinearFrontier`, CLI, deterministic graph fixtures, and master regression.
      verify: `bunx bun test monkey-maestro/tests/linear-frontier.test.mjs`
      covers: AC-004, AC-005, AC-006, AC-007, AC-010, AC-029
- [x] Add targeted runtime validation and `planRuntimeActions`.
      verify: `bunx bun test monkey-maestro/tests/runtime-actions.test.mjs`
      covers: AC-008, AC-009, AC-011, AC-013, AC-014
- [x] Add the shared all-settled dispatch epoch and invocation-bound production effect bridge with behavioral adapter doubles.
      verify: `bunx bun test monkey-maestro/tests/orchestration-epoch.test.mjs monkey-maestro/tests/orchestration-effects.test.mjs`
      covers: AC-012, AC-015, AC-016, AC-017, AC-018, AC-019, AC-020
- [x] Refactor records to write control v2 and project usable v1 controls without validating obsolete fields.
      verify: `bunx bun test monkey-maestro/tests/records.test.mjs`
      covers: AC-021, AC-023, AC-027
- [x] Replace recursive transition locking and add crash/concurrency fixtures.
      verify: `bunx bun test monkey-maestro/tests/project-lock.test.mjs`
      covers: AC-011, AC-012, AC-028
- [x] Replace the installed shared contract and make both canonical agents retrieval-only and scope-validatable.
      verify: `bunx bun test monkey-maestro/tests/skill-contracts.test.mjs && bun run check:codex-agents`
      covers: AC-001, AC-002, AC-013, AC-020, AC-026
- [x] Rewrite `start`, `status`, and `stop` around control v2 and Linear-only decisions.
      verify: `bunx bun test monkey-maestro/tests/skill-contracts.test.mjs`
      covers: AC-021, AC-022, AC-023, AC-027
- [x] Rewrite `orchestrate` around cache, planners, force, targeted runtime, monitoring, and immediate idle.
      verify: `bunx bun test monkey-maestro/tests/orchestrate-contract.test.mjs monkey-maestro/tests/orchestration-epoch.test.mjs`
      covers: AC-001, AC-002, AC-003, AC-008, AC-009, AC-010, AC-012, AC-015, AC-017, AC-018, AC-019, AC-020
- [x] Rewrite `spawn` and `reconcile` around the shared primitive and runtime-only repair.
      verify: `bunx bun test monkey-maestro/tests/spawn-contract.test.mjs monkey-maestro/tests/skill-contracts.test.mjs`
      covers: AC-010, AC-011, AC-014, AC-016, AC-024, AC-025
- [x] Delete the legacy resolver/composer and update the workflow migration gate.
      verify: `bun run check:workflow && bun run test:scripts`
      covers: foundation — removes the superseded second authority.
- [x] Update manifests, README, root inventories, branch-guard wording, and regenerate Codex agents.
      verify: `bun run sync:codex-agents && bun run check:codex-agents && bun run test:meta`
      covers: AC-020, AC-021, AC-024, AC-025, AC-026
- [x] Run the complete plugin and repository verification suite.
      verify: commands under `## Verify`
      covers: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012, AC-013, AC-014, AC-015, AC-016, AC-017, AC-018, AC-019, AC-020, AC-021, AC-022, AC-023, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029

## Verify

```text
bunx bun test monkey-maestro/
bun run test:meta
bun run test:scripts
bun run check:runtime
bun run check:workflow
bun run sync:codex-agents
bun run check:codex-agents
bun run lint
bun run fmt:check
```

## Risks

1. Prompt-driven providers cannot be fully integration-tested in CI. Mitigation: schema validators, pure planners, behavioral adapter doubles, and call-count assertions.
2. Control v1 comments may contain malformed obsolete fields. Mitigation: project only operational fields and retain raw history for audit.
3. Concurrent dispatch can partially create a workspace. Mitigation: exact task idempotence, one inspection after ambiguity, and workspace reuse.
4. Generated Codex agents can drift. Mitigation: canonical Markdown ownership plus generation/conformance gates.
5. A live provider response can evolve. Mitigation: reject only the affected scope and continue independent components.

## Out of scope

- Hidden polling, daemons, webhooks, or scheduled automation.
- Business status/relation mutations, workspace deletion, or agent termination.
- Multi-host project execution.
- GitHub-backed scheduling.
- Destructive migration of historical comments or runtimes.
