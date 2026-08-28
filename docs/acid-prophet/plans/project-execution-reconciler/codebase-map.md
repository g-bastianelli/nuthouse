# codebase map — project-execution-reconciler

## Relevant files

- `linear-devotee/skills/create-project/SKILL.md` — existing recoverable project cascade; modify to canonicalize, hash, verify, and publish the graph receipt.
- `linear-devotee/skills/create-issue/SKILL.md` — existing cascade-resume leaf; modify to preserve the verified-graph ledger.
- `linear-devotee/skills/create-milestone/SKILL.md` — existing cascade-resume leaf; modify to preserve the verified-graph ledger.
- `linear-devotee/skills/greet/SKILL.md` — existing issue bootstrap; keep sole ownership of the `In Progress` transition and remove relay coupling.
- `linear-devotee/skills/plan/SKILL.md` — existing implementation planner; remove legacy relay hand-off language.
- `linear-devotee/agents/project-drafter.md` — existing project packet drafter; tighten normalized edge direction and project membership.
- `linear-devotee/agents/project-graph-loader.md` — missing; add a read-only Linear snapshot agent.
- `linear-devotee/lib/project-graph.mjs` — missing; add deterministic canonicalization, hashing, DAG validation, and equivalence checks.
- `linear-devotee/scripts/project-graph.mjs` — missing; add a JSON CLI around the deterministic graph helpers.
- `linear-devotee/tests/project-graph.test.mjs` — missing; add table-driven graph and drift tests.
- `linear-devotee/claudecode/tests/cascade-handoff-contract.test.mjs` — existing contract test; extend for hash-bound approval and post-write verification.
- `linear-devotee/claudecode/tests/issue-packet-contract.test.mjs` — existing packet test; extend for normalized dependency direction.
- `monkey-maestro/skills/run/SKILL.md` — existing serial relay entry point; delete.
- `monkey-maestro/skills/advance/SKILL.md` — existing baton continuation entry point; delete.
- `monkey-maestro/skills/halt/SKILL.md` — existing local relay stop entry point; delete.
- `monkey-maestro/agents/queue-scout.md` — existing serial queue reader; delete.
- `monkey-maestro/shared/pipeline-contract.md` — existing local relay state contract; delete.
- `monkey-maestro/tests/project-scoped-relays.test.mjs` — existing legacy relay tests; delete.
- `monkey-maestro/skills/start/SKILL.md` — missing; add project activation and versioned control-comment workflow.
- `monkey-maestro/skills/reconcile/SKILL.md` — missing; add the read/reconstruct/resolve/dispatch coordinator.
- `monkey-maestro/skills/spawn/SKILL.md` — missing; add the task-linked Superset execution primitive.
- `monkey-maestro/skills/stop/SKILL.md` — missing; add durable deactivation without runtime termination.
- `monkey-maestro/agents/project-snapshot-loader.md` — missing; add read-only normalized Linear snapshot loading.
- `monkey-maestro/agents/runtime-inspector.md` — missing; add read-only GitHub and Superset runtime inspection.
- `monkey-maestro/lib/reconciliation-state.mjs` — missing; add deterministic eligibility, quarantine, capacity, and repair resolution.
- `monkey-maestro/lib/project-lock.mjs` — missing; add short-lived host-local reconciliation locking.
- `monkey-maestro/lib/records.mjs` — missing; add versioned Linear comment serialization and parsing.
- `monkey-maestro/scripts/reconcile-state.mjs` — missing; add a JSON CLI for the pure resolver.
- `monkey-maestro/shared/project-execution-contract.md` — missing; add the installed workflow boundary shared by all Maestro skills.
- `monkey-maestro/claudecode/hooks/branch-detect.mjs` — moved from Git Gremlin; retain command classification under Maestro ownership.
- `monkey-maestro/claudecode/hooks/intercept-branch.mjs` — moved from Git Gremlin; redirect to `monkey-maestro:spawn`.
- `monkey-maestro/hooks/hooks.json` — missing; register the moved branch guard for Codex/Claude installs.
- `monkey-maestro/tests/*.test.mjs` — missing; add state, record, lock, spawn-contract, ownership, hook, and Codex registration tests.
- `git-gremlin/skills/spawn/` — existing workspace workflow; delete with no alias.
- `git-gremlin/claudecode/hooks/` and `git-gremlin/hooks/hooks.json` — existing branch guard; remove after the move.
- `git-gremlin/skills/commit/SKILL.md` — existing Git delivery workflow; remove autopilot continuation coupling.
- `git-gremlin/skills/pr/SKILL.md` — existing PR workflow; replace automatic relay advance with an optional reconcile suggestion.
- `moon-moth/skills/verify/SKILL.md` — existing verification workflow; remove legacy Maestro halt/advance references.
- `scripts/check-workflow-migration.mjs` — missing; add a repository gate rejecting legacy ownership and missing new contracts.
- `package.json` — existing repository scripts; add `check:workflow`.
- `.codex/agents/*.toml` and `*/shared/agent-runtime-map.md` — generated; regenerate after canonical agent edits.
- plugin manifests, `README.md`, and `CLAUDE.md` — existing public inventories; update ownership, skills, agents, hooks, and patch versions.

## Existing patterns

- Canonical cross-runtime skills and agents live at each plugin root; Codex agents and runtime maps are generated with `bun run sync:codex-agents` and are never hand-edited.
- Hook and helper logic is dependency-free ESM in `.mjs` files, with Bun table tests colocated under plugin test directories.
- Read-heavy external discovery belongs in read-only agents; the coordinating skill owns user gates and external mutation.
- Status names are dynamic provider metadata; workflow decisions normalize status types instead of hard-coding labels.
- Linear comments are the durable audit ledger. Local files may coordinate a single run but cannot become project memory.
- Linear graph/control identity uses the exact opaque team issue identifier; Superset execution resolves that key to Superset's internal `task.id`, uses it as workspace `taskId`, then performs agent creation and terminal verification.
- Plugin releases require matching patch-version bumps in Claude and Codex manifests.

## Integration points

- `linear-devotee:create-project` emits a hash-bound verified graph receipt; `monkey-maestro:start` refuses any project without one.
- `monkey-maestro:start` creates the versioned project control comment, releases its activation lock, and invokes one initial `reconcile` pass; the record remains the authority consumed by `reconcile`, `spawn`, and `stop`.
- `monkey-maestro:reconcile` combines the snapshot-loader and runtime-inspector outputs, feeds them to the pure resolver, and invokes `monkey-maestro:spawn` only for authorized dispatches.
- `monkey-maestro:spawn` creates the Superset workspace first, verifies its `taskId`, launches the agent second, records partial or verified execution identity, then lets `linear-devotee:greet` claim the issue.
- The moved branch guard points manual in-place branch creation to standalone `monkey-maestro:spawn`.
- Git Gremlin remains downstream for review, commit, and PR; Moon Moth remains verification-only; `superset-orchestrate` remains independent and is never imported or invoked by Maestro.
