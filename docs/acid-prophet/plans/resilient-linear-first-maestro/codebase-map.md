# codebase map — resilient-linear-first-maestro

## Relevant files

- `monkey-maestro/lib/reconciliation-state.mjs` — deleted legacy mixed resolver; Git retains recovery history.
- `monkey-maestro/lib/reconciliation-input.mjs` — deleted legacy multi-provider composer; Git retains recovery history.
- `monkey-maestro/lib/records.mjs` — retain envelope/telemetry parsing; replace control authority with v2 projection.
- `monkey-maestro/lib/project-lock.mjs` — retain token ownership; remove recursive `.transition`.
- `monkey-maestro/lib/{linear-snapshot,linear-frontier}.mjs` — add live Linear validation/cache/planning.
- `monkey-maestro/lib/{runtime-snapshot,runtime-actions,orchestration-epoch}.mjs` — candidate-only runtime and dispatch behavior.
- `monkey-maestro/lib/{orchestration-effects,orchestration-effect-signal}.mjs` — production transcript/effect bridge with unforgeable in-process signals and invocation-bound effect ids.
- `monkey-maestro/skills/{status,start,orchestrate,reconcile,spawn,stop}/SKILL.md` — replace superseded baseline behavior.
- `monkey-maestro/agents/{control-loader,project-snapshot-loader,runtime-inspector}.md` — narrow to single-source retrieval.
- `monkey-maestro/shared/project-execution-contract.md` — replace the installed cross-skill authority.
- `monkey-maestro/tests/*.test.mjs` — replace legacy resolver and substring expectations with behavioral fixtures.
- `scripts/check-workflow-migration.mjs` — update required and forbidden Maestro paths.
- `scripts/sync-codex-agents.mjs` — reuse for generated agents; never edit generated TOML manually.
- `monkey-maestro/README.md` and manifests — update descriptions and patch version.

## Existing patterns

- Dependency-free ESM helpers with Bun table tests.
- JSON stdin/stdout CLI wrappers for pure modules.
- Exact Linear issue identifier versus Superset task UUID namespaces.
- Canonical Markdown agents generate Codex TOML and runtime maps.
- `linear-devotee:greet` remains sole owner of `In Progress`.
- Safe runtime order is live lock verification → task → workspace check/create/verify → agent → terminal → record.
- No `.moon` workspace; repository Bun/lint/format gates apply directly.

## Integration points

- Linear bootstrap and targeted refresh feed `planLinearFrontier`.
- Only selected rows feed `planRuntimeActions`.
- `orchestrate` and `spawn` share planners, lock, invocation-bound effect bridge, and idempotent dispatch.
- `reconcile` consumes runtime evidence only for audit/repair.
- `status/start/stop` use minimal control and never require Superset for Linear operations.
- Canonical agent edits require `bun run sync:codex-agents`.
- Public behavior propagates to manifests, README, branch guard, root inventories, and workflow migration tests.
