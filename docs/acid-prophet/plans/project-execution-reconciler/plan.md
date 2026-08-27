---
id: project-execution-reconciler
spec: docs/acid-prophet/specs/2026-08-27-project-execution-reconciler.md
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
    AC-030,
    AC-031,
    AC-032,
    AC-033,
    AC-034,
    AC-035,
    AC-036,
    AC-037,
    AC-038,
    AC-039,
    AC-040,
    AC-041,
    AC-042,
    AC-043,
    AC-044,
    AC-045,
    AC-046,
    AC-047,
    AC-048,
    AC-049,
    AC-050,
  ]
validated-at: 2026-08-27
spec-synced-at: 2026-08-27
---

# Plan — Linear project execution reconciler (project-execution-reconciler)

## Context

Implement the ratified [project execution reconciler spec](../../specs/2026-08-27-project-execution-reconciler.md) by making Linear project graphs verifiable, replacing Monkey Maestro's serial local relay with a stateless reconciliation workflow, and moving workspace spawning out of Git Gremlin. The implementation keeps Linear as durable memory and uses deterministic dependency-free ESM helpers for decisions that must be testable without external services.

## Files

- `linear-devotee/lib/project-graph.mjs`: normalized graph validation, hashing, and comparison `[new]`.
- `linear-devotee/scripts/project-graph.mjs`: JSON CLI for graph contracts `[new]`.
- `linear-devotee/tests/project-graph.test.mjs`: graph contract fixtures `[new]`.
- `linear-devotee/agents/project-graph-loader.md`: authoritative post-write Linear graph reader `[new]`.
- `linear-devotee/agents/project-drafter.md`: normalized dependency packet rules `[modified]`.
- `linear-devotee/skills/create-{project,issue,milestone}/SKILL.md`: hash-bound, recoverable, verified cascade `[modified]`.
- `linear-devotee/skills/{greet,plan}/SKILL.md`: remove legacy relay coupling while preserving status ownership `[modified]`.
- `linear-devotee/claudecode/tests/{cascade-handoff-contract,issue-packet-contract}.test.mjs`: cascade prompt contracts `[modified]`.
- `linear-devotee/{README.md,.claude-plugin/plugin.json,.codex-plugin/plugin.json,shared/agent-runtime-map.md}` and `.codex/agents/*`: public/generated inventory `[modified/generated]`.
- `monkey-maestro/skills/{start,reconcile,spawn,stop}/SKILL.md`: new execution entry points `[new]`.
- `monkey-maestro/agents/{project-snapshot-loader,runtime-inspector}.md`: read-only reconciliation inputs `[new]`.
- `monkey-maestro/lib/{records,reconciliation-state,project-lock}.mjs`: deterministic records, decisions, and lock `[new]`.
- `monkey-maestro/scripts/reconcile-state.mjs`: resolver CLI `[new]`.
- `monkey-maestro/shared/project-execution-contract.md`: installed cross-skill boundary `[new]`.
- `monkey-maestro/claudecode/hooks/{branch-detect,intercept-branch}.mjs` and `hooks/hooks.json`: moved branch guard `[new]`.
- `monkey-maestro/tests/*.test.mjs`: resolver, lock, records, skill, ownership, hook, and registration tests `[new]`.
- `monkey-maestro/skills/{run,advance,halt}`, `agents/queue-scout.md`, `shared/pipeline-contract.md`, `tests/project-scoped-relays.test.mjs`: legacy serial relay `[delete]`.
- `git-gremlin/skills/spawn`, `git-gremlin/claudecode/hooks`, `git-gremlin/hooks/hooks.json`: migrated orchestration ownership `[delete]`.
- `git-gremlin/skills/{commit,pr}/SKILL.md`: remove automatic relay continuation `[modified]`.
- `moon-moth/skills/verify/SKILL.md`: remove legacy relay failure handling `[modified]`.
- plugin manifests and READMEs for Linear Devotee, Monkey Maestro, and Git Gremlin: inventory and patch releases `[modified]`.
- `scripts/check-workflow-migration.mjs` and `package.json`: repository workflow gate `[new/modified]`.
- `CLAUDE.md`, `README.md`, marketplace metadata where descriptive inventory changed: ownership documentation `[modified]`.

## Acceptance coverage

- `AC-001`–`AC-007` → steps 1–5 · quickstart steps 1–2.
- `AC-008`–`AC-014` → steps 9, 15–16 · quickstart steps 3–4, 17.
- `AC-015`–`AC-020` → steps 7–8, 10 · quickstart steps 5–6.
- `AC-021`–`AC-024` → steps 6, 8 · quickstart step 7.
- `AC-025`–`AC-033` → steps 6, 8, 10 · quickstart steps 8–10.
- `AC-034`–`AC-041` → steps 9–12 · quickstart steps 11–12.
- `AC-042`–`AC-046` → steps 13–18 · quickstart steps 13–14.
- `AC-047`–`AC-050` → steps 6, 8, 10–12 · quickstart steps 15–16.

## Steps

- [x] Add `linear-devotee/lib/project-graph.mjs` with canonical entity ordering, strict edge validation, SHA-256 payload hashing, and exact normalized comparison.
      verify: `bunx bun test linear-devotee/tests/project-graph.test.mjs`
      covers: AC-001, AC-002, AC-004, AC-006, AC-007
- [x] Add `linear-devotee/scripts/project-graph.mjs` and graph fixtures for validate/hash/compare JSON operations and stable machine-readable errors.
      verify: `bunx bun test linear-devotee/tests/project-graph.test.mjs`
      covers: AC-001, AC-002, AC-003, AC-004, AC-006, AC-007
- [x] Tighten `project-drafter.md` so every issue carries Acceptance coverage and every normalized edge is same-project `dependentRef -> blockerRef`.
      verify: `bunx bun test linear-devotee/claudecode/tests/issue-packet-contract.test.mjs`
      covers: AC-001, AC-002
- [x] Refactor `create-project`, `create-issue`, and `create-milestone` prompt contracts around the exact preview hash, confirmed-operation ledger, post-write loader, and verified/unverified graph receipt.
      verify: `bunx bun test linear-devotee/claudecode/tests/cascade-handoff-contract.test.mjs`
      covers: AC-003, AC-004, AC-005, AC-006, AC-007
- [x] Add `project-graph-loader.md`, register it in Linear Devotee manifests, and regenerate runtime maps/Codex agents.
      verify: `bun run check:codex-agents`
      covers: AC-006, AC-007
- [x] Add `monkey-maestro/lib/records.mjs` with strict control, execution, and waiver records plus forward-safe parsing tests.
      verify: `bunx bun test monkey-maestro/tests/records.test.mjs`
      covers: AC-008, AC-009, AC-010, AC-011, AC-021, AC-022, AC-023, AC-036, AC-039, AC-047, AC-048, AC-050
- [x] Add token-aware `project-lock.mjs` with atomic acquire, held, stale-inspection, and owner-only release semantics.
      verify: `bunx bun test monkey-maestro/tests/project-lock.test.mjs`
      covers: AC-015, AC-016
- [x] Add `reconciliation-state.mjs` and its CLI with deterministic capacity, eligibility, waiver, taskId, repair, ambiguity, expansion-confirmation, and component-quarantine decisions.
      verify: `bunx bun test monkey-maestro/tests/reconciliation-state.test.mjs`
      covers: AC-018, AC-019, AC-020, AC-021, AC-022, AC-023, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033, AC-041, AC-047, AC-048, AC-049, AC-050
- [x] Add the shared project-execution contract plus `start` and `stop` skills with one verified activation gate, default/max concurrency, durable revisioned comments, and non-terminating stop.
      verify: `bunx bun test monkey-maestro/tests/skill-contracts.test.mjs`
      covers: AC-008, AC-009, AC-010, AC-011, AC-012, AC-013, AC-014
- [x] Add read-only `project-snapshot-loader` and `runtime-inspector` agents and the `reconcile` skill that locks, reloads all providers, resolves once, dispatches within capacity, repairs records, and exits.
      verify: `bunx bun test monkey-maestro/tests/skill-contracts.test.mjs && bun run check:codex-agents`
      covers: AC-015, AC-016, AC-017, AC-018, AC-019, AC-020, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033, AC-041, AC-047, AC-048, AC-049, AC-050
- [x] Add `spawn` with project/manual authorization modes, workspace-first taskId verification, agent/terminal capture, partial results, and no Linear status mutation.
      verify: `bunx bun test monkey-maestro/tests/spawn-contract.test.mjs`
      covers: AC-034, AC-035, AC-036, AC-037, AC-038, AC-039, AC-040, AC-041, AC-050
- [x] Remove relay coupling from `linear-devotee:greet` and `plan`; assert greet alone owns the `In Progress` mutation.
      verify: `bunx bun test monkey-maestro/tests/ownership-migration.test.mjs linear-devotee/`
      covers: AC-040
- [x] Move the branch guard and tests into Monkey Maestro, update its redirect and kill switch, and delete the Git Gremlin hook registration.
      verify: `bunx bun test monkey-maestro/tests/branch-detect.test.mjs monkey-maestro/tests/intercept-branch.test.mjs monkey-maestro/tests/codex-hooks.test.mjs`
      covers: AC-042, AC-043, AC-044
- [x] Delete Git Gremlin spawn and Monkey Maestro run/advance/halt/queue-scout/local relay artifacts with no aliases.
      verify: `bunx bun test monkey-maestro/tests/ownership-migration.test.mjs`
      covers: AC-042, AC-044, AC-047
- [x] Remove automatic relay transitions from Git Gremlin commit/PR and Moon Moth verify; PR may suggest an optional explicit reconciliation only.
      verify: `bunx bun test git-gremlin/ moon-moth/ monkey-maestro/tests/ownership-migration.test.mjs`
      covers: AC-011, AC-013, AC-045
- [x] Register the four Maestro skills, two agents, hooks, runtime descriptions, and matching patch versions in both manifests and public READMEs.
      verify: `bun run test:meta && bun run check:codex-agents`
      covers: AC-042, AC-043, AC-044
- [x] Add `scripts/check-workflow-migration.mjs` plus `check:workflow` to reject legacy contracts, forbidden ownership, hidden queues, or a Maestro dependency on `superset-orchestrate`.
      verify: `bun run check:workflow`
      covers: AC-042, AC-043, AC-044, AC-045, AC-046, AC-047
- [x] Update root inventories and regenerate Codex agents/runtime maps from canonical agent sources.
      verify: `bun run sync:codex-agents && bun run check:codex-agents && bun run check:workflow`
      covers: foundation — keeps shipped runtime discovery aligned with the implemented ownership boundary.
- [x] Run targeted plugin suites, repository gates, format the tree, and audit the final implementation against all 50 Acceptance ids.
      verify: commands in `## Verify`
      covers: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012, AC-013, AC-014, AC-015, AC-016, AC-017, AC-018, AC-019, AC-020, AC-021, AC-022, AC-023, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033, AC-034, AC-035, AC-036, AC-037, AC-038, AC-039, AC-040, AC-041, AC-042, AC-043, AC-044, AC-045, AC-046, AC-047, AC-048, AC-049, AC-050

## Verify

```text
bunx bun test linear-devotee/
bunx bun test monkey-maestro/
bunx bun test git-gremlin/
bunx bun test moon-moth/
bun run test:meta
bun run check:runtime
bun run check:workflow
bun run sync:codex-agents
bun run check:codex-agents
bun run lint
bun run fmt
bun run fmt:check
```

## Risks

1. Prompt-only external orchestration cannot be integration-tested against live Linear and Superset in CI. Mitigation: put deterministic decisions and record schemas in executable helpers, and statically test every external mutation order in skill contracts.
2. Linear provider response shapes can evolve. Mitigation: readers return normalized explicit `unknown` fields, parsers reject only affected decisions, and skills reload provider metadata on every run.
3. A workspace can be created before agent or Linear recording succeeds. Mitigation: taskId-first runtime reconstruction, partial/degraded records, and no automatic duplicate creation.
4. Moving the branch hook can briefly leave duplicate registrations if deletion and addition diverge. Mitigation: one release, static ownership gate, and both Claude/Codex registration tests.
5. Generated Codex agents can drift from canonical Markdown agents. Mitigation: regenerate only through `sync:codex-agents` and enforce `check:codex-agents`.

## Out of scope

- Continuous or default scheduled reconciliation.
- Multi-host dispatch for one project.
- A private Maestro issue queue, database, or migration of old relay state.
- Automatic waiver, dependency repair, Linear completion, PR merge, workspace deletion, or agent termination.
- Replacing or modifying the independently installed `superset-orchestrate` skill.
- Implementing work described by the dispatched Linear issues.
- Live provider credentials or destructive integration tests.
