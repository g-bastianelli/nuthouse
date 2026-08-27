---
id: adaptive-cross-runtime-workflows
status: ready
spec-version: 1
linear-project: abe01c47-8cd9-4c7a-a993-b64493fa9203
verified-by: spec-auditor
last-reviewed: 2026-08-26
---

# Adaptive cross-runtime workflow kernel

## Problem & Why

Nuthouse exposes three user journeys: creating a Linear project, delivering a Linear issue, and completing a direct local task. Their domain steps differ, but they all need the same answer to four questions: which workflow is active, which rigor profile applies, which risk raises that profile, and which gates remain mandatory.

Today, each skill can answer those questions independently. That duplicates policy, rebuilds context at handoffs, and can produce different decisions in Claude Code and Codex. A user asking for a `quick` session also has no single, inspectable way to know whether the request was honored or safely escalated.

This spec defines one workflow-policy kernel shared by the plugins. The kernel resolves and records decisions; it does not implement the three domain workflows.

## Solution

Provide a deterministic kernel that:

1. classifies a request as `project-creation`, `issue-delivery`, `direct-task`, or `ambiguous`;
2. resolves `quick`, `standard`, or `strict` from core, personal, repository, invocation, and worktree inputs;
3. raises the profile to the strictest required risk floor;
4. adds immutable safety gates and resolves the capability graph;
5. writes a versioned decision manifest that every handoff validates and reuses.

`standard` is the default. `quick` removes optional ceremony, never evidence or safety. `strict` is selected explicitly or by risk. Warden offers the convenient `warden:mode` and `warden:route` surfaces, while every participating domain plugin keeps an embedded kernel and works without Warden.

The domain behavior is owned by three child specs:

| Workflow           | Delivery spec                                                     | Acceptance ownership |
| ------------------ | ----------------------------------------------------------------- | -------------------- |
| `project-creation` | `docs/acid-prophet/specs/2026-08-25-project-creation-workflow.md` | AC-019–AC-023        |
| `issue-delivery`   | `docs/acid-prophet/specs/2026-08-25-issue-delivery-workflow.md`   | AC-024–AC-030        |
| `direct-task`      | `docs/acid-prophet/specs/2026-08-25-direct-task-workflow.md`      | AC-031–AC-035        |

## Architecture

### One kernel, independently installable bundles

The canonical development source lives in the tracked repository-only directory `[new] _shared/workflow/`. Build tooling copies a self-contained, versioned bundle to `[new] <plugin>/lib/workflow/` for Acid Prophet, Linear Devotee, Moon Moth, Git Gremlin, Monkey Maestro, and Warden.

`_shared/workflow/` is never installed into a user project and is never a runtime import. Each plugin release is tested from its own `git-subdir` installation boundary. A generated bundle records the canonical source hash, and `[new] check:workflow` fails while any participating bundle is stale.

The canonical kernel contains schema, policy, pure resolution modules, generation tooling, and fixtures. Runtime adapters may gather Claude Code- or Codex-specific inputs, but they pass normalized inputs to the same policy functions.

### Configuration stack

The kernel resolves configuration in this order, with later valid layers taking precedence before risk is applied:

```text
core default: standard
personal preference
repository: <PROJECT_ROOT>/.nuthouse/workflow.json
invocation or unexpired worktree override
risk floor
immutable gates
```

The repository configuration is optional and versioned. The personal configuration is optional and runtime-local. A phrase such as “quick for this session” writes a worktree-scoped override under the repository `git-common-dir`; it expires no later than 24 hours after creation. An invocation-only profile is not persisted.

### Risk lattice and capabilities

Profiles form the ordered lattice `quick < standard < strict`. Normalized evidence includes authentication, authorization, security, privacy, migrations, persistent data, public contracts, breaking changes, cross-repository work, multi-package architecture, production infrastructure, destructive operations, and unresolved spec conflict.

Explicit metadata, Linear labels, approved specs, repository rules, and affected paths contribute evidence. Semantic analysis may add evidence but cannot remove authoritative evidence. The effective profile is the maximum of the requested profile and every applicable risk floor. Potentially critical unresolved evidence maps to `strict` with `unresolved-risk`.

The effective profile resolves a declarative capability graph. Capabilities declare consumers, prerequisites, minimum profile, risk triggers, and whether they are immutable. This is the single policy mechanism used by all three child workflows; their specs define what the resolved capabilities do.

### Decision manifest

Every successful resolution writes a schema-valid manifest beneath `[new] <git-common-dir>/nuthouse/workflow/runs/<run-id>.json`. It records normalized decisions and hashes, not full prompts or artifact contents. Handoffs transmit `run_id`, manifest path, and content hash.

A consumer validates schema version, repository and worktree identity, expiration, policy hash, and content hash before reuse. Valid manifests prevent reclassification. An invalid manifest permits at most one local re-resolution from authoritative inputs; disagreement or remaining ambiguity blocks the handoff.

State updates use atomic rename and optimistic revision checks. There is no last-writer-wins behavior.

### Runtime parity and control surface

Claude Code hooks may pre-resolve a decision, but hooks are optional accelerators. The explicit skill path is the reference path and must work identically in Claude Code and Codex. Logical agent IDs continue to resolve through the runtime maps generated inside each installable plugin.

Warden adds two thin interfaces over the kernel:

```text
warden:mode <quick|standard|strict|status|reset>
warden:route <task description>
```

`warden:mode` manages and explains only the current worktree preference. `warden:route` resolves a request and hands it to its owning plugin. Neither interface owns domain artifacts or mutations, and domain skills remain operational when Warden is absent.

## Components / data flow

The workflow-policy kernel is one subsystem with these internal modules:

- **Config loader:** loads, validates, and traces each configuration layer.
- **Workflow classifier:** produces one workflow enum or `ambiguous` from normalized signals.
- **Risk evaluator:** normalizes evidence and computes the minimum safe profile.
- **Capability resolver:** combines workflow, effective profile, risk, and immutable gates.
- **Manifest store:** validates, hashes, atomically persists, and reopens decisions.
- **Runtime adapters:** collect environment-specific inputs without changing policy semantics.
- **Warden commands:** expose mode management and routing as optional kernel clients.

The common flow is:

```text
request or domain skill
  → adapter normalizes inputs
  → kernel classifies workflow
  → kernel resolves config and risk floor
  → kernel resolves capabilities and gates
  → manifest store persists the decision
  → owning plugin validates and executes
  → later plugins reuse the same manifest
```

Each plugin can enter this flow directly using its local generated bundle. The decision manifest is the only workflow state passed across plugin boundaries; domain artifacts remain owned by their respective plugins.

## Error handling

Errors are explicit and conservative:

| Condition                                  | Required behavior                                                |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Incompatible workflow signals              | Return `ambiguous`; perform no mutation                          |
| Invalid personal configuration             | Report the source and field; fall back to core `standard`        |
| Invalid repository configuration           | Report the exact field; block before mutation                    |
| Expired or malformed worktree override     | Exclude it, report why, and continue from repository policy      |
| Potentially critical unresolved risk       | Select `strict` with `unresolved-risk`                           |
| Missing manifest                           | Resolve locally using the embedded kernel                        |
| Expired, corrupt, or out-of-scope manifest | Reject it and attempt at most one authoritative local resolution |
| Policy hash mismatch                       | Block with a runtime-drift error                                 |
| Concurrent stale state write               | Reject with `workflow-state-conflict`                            |
| Missing Claude Code hook                   | Continue through explicit skill resolution                       |
| Missing Warden                             | Domain skill resolves locally                                    |
| Missing specialized verifier               | Use a documented native path or block completion                 |
| Missing immutable gate                     | Block progress                                                   |

Diagnostics identify the source, invalid field or evidence, requested and effective profile, applied fallback or blocker, and policy hash. The system never offers `force quick`; correcting or removing the authoritative risk evidence is the only way to lower the floor.

Manifests contain no complete prompt, source code, secrets, Linear issue body, or full logs. They contain identifiers, normalized decisions, artifact paths, hashes, revisions, and timestamps only.

## Acceptance

### Classification and profile resolution

- [AC-001] WHEN a request explicitly asks to create un projet Linear, THE SYSTEM SHALL classify the workflow as `project-creation`.
- [AC-002] WHEN a request or branch contains a valid Linear issue identifier, THE SYSTEM SHALL classify the workflow as `issue-delivery`.
- [AC-003] WHEN no project or issue Linear applies, THE SYSTEM SHALL classify the workflow as `direct-task`.
- [AC-004] IF incompatible workflow signals remain after deterministic classification, THE SYSTEM SHALL return `ambiguous` without performing a mutation.
- [AC-005] WHEN no user, repo or worktree preference exists, THE SYSTEM SHALL resolve the requested profile to `standard`.
- [AC-006] WHEN a valid repo configuration declares a default profile, THE SYSTEM SHALL apply it before any worktree override.
- [AC-007] WHEN a valid unexpired worktree override exists, THE SYSTEM SHALL apply it only to that worktree.
- [AC-008] WHEN a worktree override reaches 24 hours, THE SYSTEM SHALL expire it automatically.
- [AC-009] WHEN normalized risk evidence requires a profile stricter than the requested profile, THE SYSTEM SHALL select the stricter profile.
- [AC-010] IF a potentially critical risk cannot be resolved confidently, THE SYSTEM SHALL select `strict` with reason `unresolved-risk`.
- [AC-011] WHEN `warden:mode status` is invoked, THE SYSTEM SHALL display the requested profile, effective profile, configuration sources, escalations and enabled capabilities.
- [AC-012] WHEN `warden:mode reset` is invoked, THE SYSTEM SHALL remove only the current worktree override.

### Risk and safety

- [AC-013] WHEN a task affects authentication, authorization, security or privacy, THE SYSTEM SHALL enforce a minimum profile of `strict`.
- [AC-014] WHEN a task affects migrations or persistent data, THE SYSTEM SHALL enforce a minimum profile of `strict`.
- [AC-015] WHEN a task changes a public contract, shared API or breaking interface, THE SYSTEM SHALL enforce a minimum profile of `strict`.
- [AC-016] WHEN a task affects multiple repositories, production infrastructure or a multi-package architecture, THE SYSTEM SHALL enforce a minimum profile of `strict`.
- [AC-017] WHEN any profile is active, THE SYSTEM SHALL preserve verification, external-mutation, PR-review, human-acceptance and destructive-operation gates.
- [AC-018] IF a user requests `quick` below the computed risk floor, THE SYSTEM SHALL explain the escalation without offering a `force quick` bypass.

### Decision manifest and handoffs

- [AC-036] WHEN a workflow is resolved, THE SYSTEM SHALL write a schema-valid decision manifest under the repository git common directory.
- [AC-037] WHEN a valid manifest crosses a plugin handoff, THE SYSTEM SHALL transmit its run id, path and content hash.
- [AC-038] WHEN a consumer receives a valid in-scope manifest, THE SYSTEM SHALL reuse it without reclassifying the workflow.
- [AC-039] IF a manifest is absent, expired, corrupt or out of scope, THE SYSTEM SHALL reject it and perform at most one local re-resolution from authoritative inputs.
- [AC-040] IF two participating plugins report different workflow policy hashes, THE SYSTEM SHALL block the handoff with a runtime-drift error.
- [AC-041] WHEN concurrent writers attempt to update the same workflow state revision, THE SYSTEM SHALL reject the stale write with `workflow-state-conflict`.
- [AC-042] WHEN a decision manifest is inspected, THE SYSTEM SHALL contain no full prompt, source code, secret, Linear issue body or complete log output.

### Packaging and runtime parity

- [AC-043] WHEN any participating plugin is installed independently, THE SYSTEM SHALL resolve workflows using only files contained inside that installed plugin and project-owned configuration.
- [AC-044] WHEN workflow runtime sources change, THE SYSTEM SHALL regenerate every participating plugin bundle and fail `check:workflow` until all bundles match the canonical source hash.
- [AC-045] WHEN the same resolution fixture runs through Claude Code and Codex adapters, THE SYSTEM SHALL produce identical normalized decision JSON.
- [AC-046] IF a Claude Code hook is missing or fails, THE SYSTEM SHALL reach the same workflow decision through explicit skill resolution.
- [AC-047] IF Warden is not installed, THE SYSTEM SHALL allow every participating domain skill to resolve its workflow and profile locally.
- [AC-048] WHEN a plugin lacks a specialized verifier such as Moon Moth, THE SYSTEM SHALL use a documented native verification path or block completion.
- [AC-049] WHEN the repo configuration is invalid, THE SYSTEM SHALL block workflow execution before mutation and report the exact invalid field.
- [AC-050] WHEN the personal configuration is invalid, THE SYSTEM SHALL report the error and fall back to the core `standard` profile.
- [AC-051] WHEN a plugin release is validated, THE SYSTEM SHALL test the generated bundle from each plugin’s installable subdirectory without access to repository-level `_shared` files.

## Acceptance history

- None.

## Testing approach

### Kernel fixtures

Table-driven tests cover workflow classification (AC-001–AC-004), configuration precedence and worktree lifetime (AC-005–AC-012), every risk category and immutable gate (AC-013–AC-018), and normalized manifest output. Tests assert structured decisions rather than decorative prose.

### Manifest and state contracts

Contract tests use temporary git repositories and real worktrees to cover valid handoffs, reuse, expiration, corruption, scope mismatch, one-time re-resolution, policy drift, optimistic concurrency, and redaction (AC-036–AC-042). Two worktrees must never read or reset each other’s override.

### Packaging isolation

For each participating plugin, release tests copy only its installable subdirectory to a temporary location, deny access to the nuthouse parent, load the generated workflow bundle, and execute the shared fixture corpus (AC-043, AC-044, AC-051). Static checks reject runtime imports from `_shared/`.

### Cross-runtime parity and fallbacks

Every fixture runs through the canonical resolver, Claude Code adapter, and Codex adapter. After removing timestamps and temporary paths, normalized decision JSON must be identical. Separate scenarios disable hooks, Warden, and specialized verifiers to prove the documented fallbacks or blockers (AC-045–AC-050).

### Repository gates

The final verification runs the existing repository checks plus the new workflow check:

```text
bun test
bun run test:meta
bun run check:runtime
bun run check:workflow
bun run check:codex-agents
bun run lint
bun run fmt:check
```

## Non-goals

- Implement the domain behavior of `project-creation`, `issue-delivery`, or `direct-task`; the three child specs own it.
- Make Warden a runtime dependency of another plugin.
- Install or create `_shared/` in consumer projects.
- Add an npm or Bun runtime dependency to generated plugin bundles.
- Allow `quick` to bypass verification, external mutation approval, destructive-operation confirmation, PR review, or human acceptance.
- Automate PR merge or directly mark a Linear issue complete.
- Guarantee identical prose between Claude Code and Codex; normalized decisions and behavior must match.
- Synchronize temporary overrides between machines.
- Migrate or delete historical specs, plans, or state automatically.
- Modify Saucy Status, Subroutine, Lore Hound, or Stack Golem in this delivery.
- Build a graphical configuration interface.
- Implement specialized deterministic validators or the complete delta/archive lifecycle; those remain separately scoped work.
- Introduce a mandatory central orchestrator or runtime dependency between plugins.
