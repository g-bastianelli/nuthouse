---
id: direct-task-workflow
status: ratified
spec-version: 1
linear-project: _none_
verified-by: spec-auditor
last-reviewed: 2026-08-26
---

# Adaptive direct-task workflow

## Problem & Why

Many repository changes begin as direct requests with no Linear project or issue. Forcing the full project or issue workflow onto these tasks creates unnecessary artifacts and questions, while skipping all planning and verification makes higher-risk direct work hard to review and easy to over-scope.

The direct workflow needs a deliberate fast path: `quick` should move from bounded scope to implementation and evidence without persistent planning artifacts. The same entry point must grow to a compact plan under `standard` and to ratified spec plus audited implementation plan under `strict`.

The shared workflow-policy kernel is specified by `docs/acid-prophet/specs/2026-08-25-adaptive-cross-runtime-workflows.md`. This child spec owns only `direct-task` behavior after the kernel selects the workflow, profile, capabilities, and gates.

## Solution

Provide one direct-task pipeline that scopes the requested repository change, selects the profile-required preparation, implements the bounded change, and records verification evidence.

Profile behavior is explicit:

| Profile    | Required preparation before implementation                                   |
| ---------- | ---------------------------------------------------------------------------- |
| `quick`    | Ephemeral scope statement; no persistent spec or plan                        |
| `standard` | Compact implementation plan proportional to the affected files and checks    |
| `strict`   | Persisted, audited spec followed by a persisted, audited implementation plan |

In a Moon workspace, the pipeline uses `moon-moth:scope` to derive the affected project graph before implementation and `moon-moth:verify` after it. Outside Moon, it derives native checks from repository instructions and build metadata. Completion always requires reliable evidence; the absence of a trustworthy verification strategy is a blocker, not a reason to claim success.

## Architecture

The workflow is one repository-local delivery pipeline. It consumes the parent decision manifest, creates only the artifacts required by the resolved capabilities, and never invents a Linear container.

The initial scope combines the user request, repository instructions, current worktree state, and affected paths. Moon’s affected graph is authoritative when the repository is a valid Moon workspace. Otherwise, repository-native project boundaries are inferred from `AGENTS.md`, `CLAUDE.md`, package manifests, and build configuration. Existing user changes are recorded as protected context and are not reset or absorbed silently.

For `quick`, the scope remains in the active turn and implementation can begin once it is unambiguous. For `standard`, the compact plan records files or modules, ordered changes, verification commands, and known risks. For `strict`, Acid Prophet and its plan workflow own the persisted spec and plan gates; the direct pipeline resumes with the same workflow run after both artifacts validate.

Verification is proportional but never optional. The pipeline records commands, affected targets, exit status, and relevant failure summaries. A task is complete only when all required checks pass or the user receives an explicit blocker report.

## Components / data flow

- **Scope collector:** combines the request, repository rules, worktree state, and affected boundaries.
- **Preparation gate:** chooses ephemeral scope, compact plan, or persisted audited spec and plan from the effective profile.
- **Artifact handoff:** invokes the owning spec or plan skill for strict preparation and resumes the same run.
- **Implementation turn:** changes only the approved scope while preserving unrelated worktree edits.
- **Verification selector:** chooses the Moon affected graph or documented repository-native checks.
- **Evidence recorder:** attaches commands and results to the workflow run and determines completion.

```text
direct request
  → validate workflow decision
  → derive affected scope
  → prepare profile-required artifacts
  → implement within scope
  → run affected or native checks
  → record verification evidence
  → complete or report an explicit blocker
```

## Error handling

| Condition                                           | Required behavior                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Scope remains ambiguous                             | Ask one focused question and perform no code mutation                           |
| Worktree contains unrelated user changes            | Preserve them and narrow the implementation boundary                            |
| Moon scope cannot be computed in a Moon workspace   | Stop before broad implementation and report the failed scope command            |
| Repository is not a Moon workspace                  | Select documented native boundaries and checks                                  |
| Required standard plan is missing                   | Create it before implementation                                                 |
| Required strict spec or plan is absent or unaudited | Handoff to its owner with the same run and block implementation until validated |
| Implementation exceeds the approved scope           | Stop, update the plan or spec as required, and revalidate before continuing     |
| Required verification command fails                 | Report the failure and do not claim completion                                  |
| No reliable verification strategy exists            | Block completion and identify the missing repository contract                   |

The workflow does not create placeholder evidence, downgrade the effective profile, discard user changes, or treat “command unavailable” as a passing result.

## Acceptance

- [AC-031] WHEN `direct-task` resolves to `quick`, THE SYSTEM SHALL scope, implement and verify without requiring a persistent spec or plan.
- [AC-032] WHEN `direct-task` resolves to `standard`, THE SYSTEM SHALL create a compact implementation plan before code changes.
- [AC-033] WHEN `direct-task` resolves to `strict`, THE SYSTEM SHALL persist and audit a spec and implementation plan before code changes.
- [AC-034] WHEN a direct task runs in a Moon workspace, THE SYSTEM SHALL use the affected project graph to bound implementation and verification.
- [AC-035] IF no reliable verification strategy can be resolved for a direct task, THE SYSTEM SHALL block completion rather than report success without evidence.

## Acceptance history

- None.

## Testing approach

### Profile scenarios

Integration fixtures run the same bounded task through all profiles. `quick` asserts no persistent spec or plan is created while scope, mutation, and verification evidence are present (AC-031). `standard` blocks implementation until a compact plan names scope and checks (AC-032). `strict` blocks until both persisted artifacts pass their owning audits (AC-033).

### Scope and verification

Temporary Moon repositories verify that the affected project graph bounds changed files and executed checks, including downstream targets where configured (AC-034). Non-Moon fixtures derive native commands from each supported repository source. Empty, contradictory, missing, and failing strategies must block completion with explicit evidence (AC-035).

### Worktree safety and handoffs

Dirty-worktree fixtures prove unrelated user changes are preserved. Strict-profile handoff tests prove the same `run_id` and decision hash survive spec and plan creation, and that implementation cannot begin from draft or failed-audit artifacts.

## Non-goals

- Define workflow classification, profile precedence, risk floors, manifest storage, packaging, or Claude Code/Codex parity; the parent kernel spec owns those concerns.
- Create or mutate a Linear project or issue.
- Reproduce project-creation or issue-delivery artifacts for direct tasks.
- Require Moon in repositories that do not use it.
- Persist a spec or plan for a `quick` task unless the risk floor escalates the effective profile.
- Claim completion without executed verification evidence.
- Reset, overwrite, or silently include unrelated user worktree changes.
