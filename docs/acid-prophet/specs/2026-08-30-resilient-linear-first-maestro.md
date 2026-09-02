---
id: resilient-linear-first-maestro
status: ratified
spec-version: 1
linear-project: _none_
verified-by: spec-auditor
last-reviewed: 2026-08-30
---

# Resilient Linear-first Monkey Maestro

## Problem & Why

Monkey Maestro currently maintains a second scheduling truth alongside Linear. The
active control persists a historical dependency baseline, hashes, ownership indexes,
execution records, and result records. Normal orchestration then combines that history
with fresh Linear, Superset, and GitHub snapshots through LLM-based normalization and a
large reconciliation resolver.

That design is conservative but not resilient. A stale relation between completed
issues, an unrelated unknown status, a residual workspace, a malformed subagent response,
or an unavailable report-only provider can prevent a safe issue from launching. During
the observed `NOT-550` incident, the snapshot loader read the correct live Linear
relations and then returned an invented historical edge. Static prompt tests still
passed. The project lock also contains a recursive recovery failure: a stale transition
lock can prevent its own recovery indefinitely.

Users expect Maestro to answer a simpler question: which Linear issues are executable
now, and which exact Superset actions are required for them? Safe work must continue when
an unrelated issue or provider is degraded. Linear completion must always outrank runtime
residue, and a normal Linear relation edit must never require graph adoption or explicit
reconciliation.

Success means that the same live Linear view always produces the same execution frontier,
independent of historical baselines, hashes, records, GitHub state, input ordering, or
completed workspaces. Every failure is scoped as narrowly as the evidence permits.

### Scope and supersession

This specification governs all behavior under `monkey-maestro/**`: the six public skills,
canonical and generated agents, shared contracts, deterministic libraries, scripts,
hooks, records, manifests, documentation, and tests.

For Monkey Maestro runtime behavior, this specification supersedes
`2026-08-27-project-execution-reconciler.md`. That earlier specification continues to
govern Linear Devotee project graph creation and cross-plugin ownership boundaries where
they do not conflict with this document.

## Solution

Linear becomes the only durable scheduling authority. Maestro uses current project
membership, normalized `status.type`, and current `blockedBy` relations to decide the
frontier. A full Linear graph is hydrated once into an in-memory cache at the beginning
of a coordinator invocation. Subsequent transitions refresh only affected issues,
candidates, and blockers. The cache is a disposable performance view, never persisted
authority.

Two pure functions own planning:

```text
planLinearFrontier(linearView) -> frontierPlan
planRuntimeActions(frontierPlan, runtimeView) -> runtimePlan
```

`planLinearFrontier` cannot receive baselines, graph receipts, execution records,
GitHub evidence, or Superset data. `planRuntimeActions` runs only for selected ready or
started issues and cannot change their Linear classification.

Superset remains the execution transport. Maestro resolves exact task/workspace/terminal
identity only after Linear selection, then creates or resumes isolated workers through a
short idempotent dispatch primitive. GitHub and historical records may enrich reports but
never affect readiness, capacity, or authorization.

An explicit issue-scoped force mode provides an escape hatch. After a single preview and
confirmation, it may bypass known dependency or relation constraints for named issues in
the current invocation. It never creates a durable alternate graph and never overrides a
terminal Linear status, missing identity, runtime ambiguity, inactive control, missing
transport configuration, or held lock.

The public `status`, `start`, `orchestrate`, `reconcile`, `spawn`, and `stop` entry points
remain available. Their internals share the same Linear-first state model and dispatch
primitive.

## Architecture

```text
Linear bootstrap
    -> disposable in-memory graph
    -> planLinearFrontier()
    -> selected ready/started issues only
    -> targeted Superset inspection
    -> planRuntimeActions()
    -> short recoverable lock
    -> parallel all-settled dispatch
    -> active-worker monitoring
    -> targeted Linear refresh
```

### Minimal control v2

The durable Linear control contains only orchestration activation and transport policy:

```text
schemaVersion
projectId
runId
active
targetHostId
supersetProjectId
defaultAgent
maxConcurrency
revision
updatedAt
```

It contains no graph, graph hash, decision hash, runnable expansion, execution ownership
index, or exited ownership index. Execution, result, and waiver records remain readable
as best-effort telemetry but do not enter either planner.

Control v1 remains backward compatible. A reader projects its valid operational fields
into the v2 view and ignores obsolete baseline, hash, and ownership fields even when
those obsolete fields are malformed. The next explicit `start`, `stop`, or configuration
change writes v2. Migration never deletes historical comments or runtimes.

### Linear cache and frontier

At invocation start, Maestro reads the project issue set and fetches current relation
details in parallel. The validated cache stores only the fields needed for scheduling:
issue identifier, project identifier, normalized status type, and blocker identifiers.

Within the same invocation, worker events and dispatch epochs trigger targeted reads.
Immediately before mutation, every candidate and its blockers are read again. Fresh
values replace their cached values without baseline comparison or `reconcile_required`.
A new invocation or lost coordinator context always performs a fresh bootstrap.

The normalized startable types are `backlog`, `triage`, and `unstarted`. The normalized
terminal types are `completed` and `canceled`. A terminal issue is complete for Maestro,
satisfies a dependency, consumes no logical capacity, and bypasses every Superset lookup.

A startable issue is ready exactly when all current blockers are terminal. A `started`
issue with one exact runtime is monitored. A `started` issue without an exact runtime is
presented for grouped user confirmation before a worker is created. Unknown data, cycles,
self-relations, and cross-project relations isolate only decisions that depend on the
affected component.

### Runtime planning and dispatch

Only ready issues, confirmed started issues, forced issues, and already active workers
enter runtime planning. Task bindings are resolved in parallel. One shared workspace
inventory may be reused within the dispatch epoch, but every decision is filtered by exact
task id.

- Zero exact workspace matches authorize creation.
- One exact match authorizes reuse or monitoring.
- Multiple exact matches isolate that issue as ambiguous.

The batch is selected deterministically up to `maxConcurrency`. Independent issue
sequences run concurrently with all-settled semantics: failure of one sequence does not
cancel or roll back its siblings. Inside each sequence, the order remains task lookup,
workspace lookup/create, exact workspace verification, agent creation, terminal
correlation, and best-effort Linear execution record.

Before mutation, Maestro acquires a short project dispatch lock, refreshes candidate
Linear facts, and repeats the exact workspace check. It releases the lock before terminal
monitoring, follow-ups, waits, or user input.

### Monitoring lifecycle

Maestro monitors only exact active workers. A worker envelope is report and coordination
evidence; it never substitutes for Linear status. After a worker event, Maestro refreshes
the affected Linear issue and any cached candidates whose decision depends on it. Newly
ready issues may form another batch during the same invocation.

When there is no active worker and no ready or confirmed force candidate, orchestration
returns `idle` immediately. It performs no background polling. A later Linear change
requires a new manual or automated invocation.

## Components / data flow

### Public skills

| Component     | Responsibility                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`       | Confirm and write minimal control v2, then invoke `orchestrate`; no graph receipt, hash, GitHub, or global Superset audit.                                           |
| `status`      | Read control plus live Linear statuses and relations; report ready, started, blocked, and unknown issues without requiring runtime inspection or reconciliation.     |
| `orchestrate` | Hydrate the cache, compute the frontier, apply confirmed force requests, inspect selected runtimes, dispatch in parallel, monitor active workers, and return `idle`. |
| `reconcile`   | Explicitly audit and repair exact Superset task/workspace/terminal correlations and best-effort records; never own or adopt the Linear graph.                        |
| `spawn`       | Run the shared planner and idempotent primitive for one named issue, with normal or explicit forced launch.                                                          |
| `stop`        | Confirm and write `active:false` in Linear without depending on Superset; existing workers remain untouched.                                                         |

`spawn` is invoked explicitly by the user. (This spec originally had the branch guard route
forbidden in-place branch creation to `spawn`; that `PreToolUse` hook was removed on
2026-09-02 — see the note in `2026-08-27-project-execution-reconciler.md`.)

### Agents and deterministic boundaries

The Linear loader becomes retrieval-only. It receives a project id plus an optional exact
issue-id scope and can access only Linear project, issue, status, and relation data. It
never receives or reads control baselines, graph receipts, historical records, GitHub, or
Superset. Its output is compact and schema-validated before entering the cache.

The runtime inspector receives only selected issue/task identifiers. It reads only the
Superset data required to classify those tasks and returns independent per-issue results.
It never calls GitHub or performs a complete project runtime scan during normal
orchestration.

No LLM-normalized multi-provider snapshot authorizes a dispatch. Invalid JSON, an expanded
scope, missing requested issues, or contradictory provider state is rejected at the
boundary. Maestro retries the failing read once within the same scope or falls back to a
direct targeted read when available. Persistent failure marks only that scope unknown.

Canonical agent definitions remain the source of generated Codex agents. Generated
agents must preserve the canonical schema version, scope, read-only sandbox policy, and
tool capabilities.

### Records and reporting

Execution and result records remain useful for recovery and observability. They may help
`reconcile` report or repair exact runtime identity, but they cannot keep capacity occupied,
make an issue ready, make it blocked, or authorize redispatch. A failed record write after
verified runtime creation produces degraded telemetry only.

Every user-facing report lists a precise outcome and reason per issue. A project-wide
opaque `STATUS_UNKNOWN` is not a valid substitute for scoped evidence.

## Error handling

Only an explicit `stop` changes the project to stopped. Other clean exits are `idle`,
`busy`, or `degraded`; none silently deactivates the control.

- A failed issue read is retried once within the same scope, then that issue is isolated.
- Complete Linear unavailability permits no blind dispatch, returns `degraded`, and leaves
  existing workers untouched.
- Superset unavailability makes selected candidates temporarily non-transportable without
  changing Linear or unrelated classifications.
- GitHub is never called from the authorization path.
- A dispatch failure affects only its issue; sibling sequences continue.
- An ambiguous mutation response triggers one exact inspection and no blind retry.
- A verified partial workspace is preserved and reused on the next invocation.
- A terminal Linear issue short-circuits runtime inspection even if zero, one, or multiple
  residual runtimes exist.
- A refused force request leaves the issue unchanged and does not affect siblings.

The lock implementation removes the recursive `.transition` lock. Acquisition creates an
exclusive owner containing a token and timestamp. Release requires the matching token.
Recovery handles expired owners, empty owners left between creation and write, and stale
legacy transition locks without first acquiring the stale artifact being recovered.
Concurrent recoverers still converge on one exclusive owner.

Force authorization is issue-scoped and invocation-scoped. Immediately before mutation,
Maestro rejects force when the issue has become terminal, identity is unresolved, an exact
runtime is ambiguous, required transport configuration is absent, the control is inactive,
or the lock cannot be acquired.

## Acceptance

### Linear authority and cache

- [AC-001] WHEN une invocation commence sans cache valide, THE SYSTEM SHALL hydrater une fois les statuts et liens Linear du projet.
- [AC-002] WHEN le cache existe, THE SYSTEM SHALL rafraîchir uniquement les issues, candidats et blockers affectés.
- [AC-003] WHEN un lien Linear change, THE SYSTEM SHALL appliquer le nouveau graphe au prochain calcul sans exiger `reconcile`.
- [AC-004] WHEN la même vue Linear est fournie, THE SYSTEM SHALL produire la même frontier indépendamment des historiques, hashes, records, GitHub et ordre d’entrée.
- [AC-005] WHEN une issue est `completed` ou `canceled`, THE SYSTEM SHALL la considérer terminale avant toute inspection Superset et libérer sa capacité.
- [AC-006] WHEN une issue est startable et tous ses blockers live sont terminaux, THE SYSTEM SHALL la classer `ready`.
- [AC-007] IF une donnée est inconnue ou une composante invalide, THE SYSTEM SHALL isoler uniquement les issues dont la décision en dépend.

### Force and runtime

- [AC-008] WHEN une issue `started` ne possède aucun runtime exact, THE SYSTEM SHALL demander une confirmation avant lancement.
- [AC-009] WHEN plusieurs confirmations sont nécessaires, THE SYSTEM SHALL pouvoir les regrouper.
- [AC-010] WHEN l’utilisateur confirme un lancement forcé, THE SYSTEM SHALL contourner uniquement les blockers ou relations concernés pour cette invocation.
- [AC-011] IF l’issue est terminale, l’identité est introuvable, le runtime est ambigu, le control est inactif ou le lock est détenu, THE SYSTEM SHALL refuser le force.
- [AC-012] WHEN un dispatch forcé ou normal est sur le point d’être autorisé, THE SYSTEM SHALL relire le candidat et ses blockers live.
- [AC-013] WHEN Linear sélectionne des candidats, THE SYSTEM SHALL alors seulement résoudre leurs tasks, workspaces et terminals Superset.
- [AC-014] WHEN zéro, un ou plusieurs workspaces correspondent exactement, THE SYSTEM SHALL respectivement créer, reprendre ou isoler cette issue.
- [AC-015] WHEN plusieurs issues sont prêtes, THE SYSTEM SHALL lancer jusqu’à `maxConcurrency` avec une sémantique `allSettled`.
- [AC-016] IF une mutation retourne un résultat ambigu, THE SYSTEM SHALL inspecter une fois l’identité exacte sans retry aveugle.

### Execution lifecycle

- [AC-017] WHEN des workers sont actifs, THE SYSTEM SHALL surveiller uniquement leurs terminals exacts.
- [AC-018] WHEN un worker produit un événement, THE SYSTEM SHALL rafraîchir Linear de manière ciblée avant de promouvoir d’autres issues.
- [AC-019] WHEN aucun worker n’est actif et aucune issue n’est prête, THE SYSTEM SHALL retourner immédiatement `idle` sans polling supplémentaire.
- [AC-020] WHEN Maestro autorise, bloque ou dimensionne un dispatch, THE SYSTEM SHALL NOT appeler GitHub.

### Complete plugin behavior

- [AC-021] WHEN `start` active Maestro, THE SYSTEM SHALL écrire un control v2 minimal puis invoquer `orchestrate`.
- [AC-022] WHEN `status` est invoqué, THE SYSTEM SHALL produire son rapport depuis Linear sans inspection runtime obligatoire.
- [AC-023] WHEN `stop` est confirmé, THE SYSTEM SHALL écrire `active:false` dans Linear sans dépendre de Superset.
- [AC-024] WHEN `reconcile` est invoqué, THE SYSTEM SHALL limiter son autorité à l’audit et la réparation runtime.
- [AC-025] WHEN `spawn` est invoqué, THE SYSTEM SHALL utiliser les mêmes règles Linear-first et la même primitive idempotente qu’`orchestrate`.
- [AC-026] IF un subagent retourne une portée ou un schéma invalide, THE SYSTEM SHALL rejeter sa sortie sans en dériver de faits.
- [AC-027] WHEN un control v1 contient encore les champs opérationnels requis, THE SYSTEM SHALL ignorer ses anciennes baselines/hashes et permettre sa migration.
- [AC-028] WHEN un lock est stale, vide ou abandonné après crash, THE SYSTEM SHALL permettre une récupération atomique sans verrou récursif.

### Master regression

- [AC-029] WHEN Maestro planifie un projet où `NOT-549` est terminale avec un runtime résiduel, `NOT-550` est startable avec tous ses blockers terminaux, `NOT-554` est inconnue et GitHub est indisponible, THE SYSTEM SHALL autoriser et dispatcher `NOT-550`.

## Acceptance history

- None.

## Testing approach

### Pure planners

Table-driven and property-style fixtures exercise `planLinearFrontier` and
`planRuntimeActions`. They prove deterministic ordering, invariance to historical data,
terminal precedence, exact readiness, component-scoped unknowns, cycles, cross-project
relations, and force boundaries.

### Provider adapters and orchestration

Behavioral doubles return valid, partial, malformed, reordered, and unavailable Linear
and Superset responses. Tests assert actual call scope and order rather than prompt
substrings: Linear bootstrap, frontier calculation, candidate-only Superset access,
under-lock refresh, all-settled dispatch, active-only monitoring, and immediate idle exit.

Fixtures cover missing task bindings, zero/one/multiple workspaces, ambiguous mutation
responses, workspace success plus agent failure, sibling continuation, grouped started
confirmation, refusal, and forced launch.

### Agents, controls, and locks

Agent boundary tests reject invalid JSON, expanded targeted scope, omitted requested
issues, and contradictory provider claims. Conformance tests compare canonical and
generated agents, including schema, sandbox, and tool policy.

Control migration tests project v1 records with valid, missing, malformed, and obsolete
fields into v2 without granting stale fields scheduler authority. Lock tests inject a
crash before and after every filesystem transition, including empty owner, stale owner,
wrong token, legacy `.transition`, and concurrent recovery.

### Regression and call-count evidence

The observed `NOT-549`/`NOT-550`/`NOT-554` scenario is a permanent fixture. Additional
assertions prove that completed issues cause zero Superset lookup, GitHub receives zero
authorization calls, graph edits affect the next frontier without reconciliation, and an
idle invocation performs no wait or second refresh.

### Repository gates

```text
bunx bun test monkey-maestro/
bun run test:meta
bun run check:runtime
bun run check:workflow
bun run check:codex-agents
bun run lint
bun run fmt:check
```

The installable plugin directory must pass its isolated packaging checks without access
to repository-only runtime files.

## Non-goals

- Create a daemon, webhook, scheduled poller, or hidden background coordinator.
- Persist the in-memory graph cache as a second scheduling authority.
- Restore a private queue, baton, decision baseline, graph hash, or runnable-expansion
  approval flow.
- Automatically mutate business issue statuses or dependency relations in Linear.
- Treat a worker result, terminal state, execution record, or pull request as a Linear
  lifecycle state.
- Automatically delete workspaces or terminate agents.
- Guess between multiple ambiguous runtimes.
- Allow force mode to bypass terminal status, identity, idempotence, control, configuration,
  or lock safety.
- Distribute one project across multiple Superset hosts.
- Delete historical records during migration.
- Make GitHub a runtime dependency of Monkey Maestro.
- Guarantee dispatch while Linear itself is wholly unreadable.
