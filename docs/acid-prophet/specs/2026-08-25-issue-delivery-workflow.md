---
id: issue-delivery-workflow
status: ratified
spec-version: 1
linear-project: _none_
verified-by: spec-auditor
last-reviewed: 2026-08-26
---

# Adaptive issue-delivery workflow

## Problem & Why

Starting work from a Linear issue currently requires several skills to rediscover the issue, its project context, its source spec, and the checks needed before a PR. Project-level architecture can be rewritten at issue level, implementation handoffs can lose named artifacts, and an autopilot relay can start a fresh worktree without carrying the decision that governed the previous issue.

The workflow must preserve one authoritative chain from Linear context through plan, implementation, verification, commit, PR, review, and optional relay. It must be fast for a clean low-risk issue and add drift, checklist, and review evidence for high-risk work without removing human feature acceptance or manual merge.

The shared workflow-policy kernel is specified by `docs/acid-prophet/specs/2026-08-25-adaptive-cross-runtime-workflows.md`. This child spec owns only `issue-delivery` behavior after the kernel selects the workflow, profile, capabilities, and gates.

## Solution

Use `linear-devotee:greet` to build an issue context packet and `linear-devotee:plan` to create the implementation handoff. The packet references the source Linear project, source spec, project-level plan, relevant repository files, dependencies, and the parent workflow decision.

Profile behavior is explicit:

| Profile    | Required delivery preparation                                                            |
| ---------- | ---------------------------------------------------------------------------------------- |
| `quick`    | Linear context and compact execution plan; auto-validation only after a clean plan audit |
| `standard` | Audited issue-level plan before implementation                                           |
| `strict`   | Audited plan plus source-spec drift evaluation and derived verification checklist        |

Implementation receives named artifacts rather than a prose-only summary. Verification uses Moon Moth’s affected graph when available and a documented repository-native strategy otherwise. Git Gremlin owns commit and PR operations. Monkey Maestro may relay after a clean PR state, but the next worktree inherits the same decision identity and can never bypass human feature acceptance or manual merge.

## Architecture

The workflow is one issue-delivery pipeline whose authoritative context packet evolves monotonically. Each stage validates the parent decision manifest and appends evidence; it does not reinterpret completed upstream decisions.

The context packet contains stable references and hashes for:

- Linear issue and project context;
- source spec and its Acceptance IDs;
- project-level implementation plan, when present;
- issue-level plan;
- relevant repository files or affected scope;
- verification checklist and results;
- workflow `run_id`, effective profile, policy hash, and decision hash.

The project-level plan remains architecture authority. The issue plan narrows it to the issue’s files, sequence, risks, and tests. If the two conflict, planning stops and surfaces drift instead of silently replacing project architecture. If no project plan exists, the issue plan records that absence rather than inventing inherited decisions.

The `quick` plan audit uses the same plan-auditor contract as other profiles. A clean result can auto-validate the compact plan; any drift, blocker, unresolved question, or failed gate requires user review or escalation. `strict` additionally evaluates implementation intent against the source spec and derives a checklist from its Acceptance criteria before code changes.

Monkey Maestro’s baton carries the workflow decision identity into the next worktree. It may start the next issue only under its own startability rules; it does not change PR review, feature acceptance, merge, or Linear completion semantics.

## Components / data flow

- **Issue context loader:** reads the Linear issue, comments, project metadata, source artifacts, and repository anchors.
- **Authority resolver:** identifies the source spec and project plan without duplicating them.
- **Issue planner:** creates the profile-appropriate plan scoped to the issue.
- **Plan audit gate:** validates traceability, feasibility, drift, and unresolved questions.
- **Implementation handoff:** packages named artifacts for the coding turn.
- **Verification bridge:** selects Moon Moth or a documented native verification path and records evidence.
- **Git delivery bridge:** hands verified work to commit, PR, and review skills.
- **Relay baton:** transports decision identity and accepted artifacts to a new issue worktree.

```text
Linear issue
  → greet context packet
  → resolve source spec and project plan
  → draft and audit issue plan
  → strict-only drift and checklist gates
  → implementation with named artifacts
  → affected or native verification
  → commit, PR, review, human acceptance
  → optional relay with decision baton
```

## Error handling

| Condition                                          | Required behavior                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Issue identifier is missing or invalid             | Stop before planning and identify the expected input                         |
| Linear context cannot be loaded                    | Preserve the run and stop; never plan from invented issue content            |
| Source spec or project plan reference is stale     | Reload the authoritative artifact and invalidate downstream plan hashes      |
| Project plan conflicts with issue plan             | Block validation and report the exact architecture drift                     |
| Quick plan audit is not clean                      | Do not auto-validate; require correction, user review, or profile escalation |
| Strict drift or checklist cannot be produced       | Block implementation and identify the missing source evidence                |
| Named artifact is absent at implementation handoff | Refuse the handoff and list the missing artifact                             |
| Moon Moth is unavailable or repo is not Moon       | Use documented native verification; block if none is reliable                |
| Verification fails                                 | Stop before commit or PR and retain command evidence                         |
| Relay baton is invalid or mismatched               | Do not spawn or continue the next issue worktree                             |
| PR is open but feature acceptance is pending       | Keep manual acceptance and merge gates open                                  |

No failure marks an issue complete, merges a PR, or silently reconstructs unavailable source context. Recovery resumes from the last validated artifact hash.

## Acceptance

- [AC-024] WHEN `issue-delivery` resolves to `quick`, THE SYSTEM SHALL load Linear context and produce a compact execution plan that auto-validates only when its audit is clean.
- [AC-025] WHEN `issue-delivery` resolves to `standard`, THE SYSTEM SHALL produce and audit an issue-level plan before implementation.
- [AC-026] WHEN `issue-delivery` resolves to `strict`, THE SYSTEM SHALL additionally evaluate source-spec drift and derive the required verification checklist.
- [AC-027] WHEN an issue plan inherits a project-level plan, THE SYSTEM SHALL preserve the project plan as architecture authority instead of recreating it.
- [AC-028] WHEN an issue handoff reaches implementation, THE SYSTEM SHALL provide the issue plan, source spec, relevant files and workflow decision as named artifacts.
- [AC-029] WHEN an autopilot relay spawns the next issue worktree, THE SYSTEM SHALL propagate the workflow run identifier, effective profile and decision hash.
- [AC-030] WHEN a clean implementation reaches PR creation in relay mode, THE SYSTEM SHALL retain human feature acceptance and manual merge as mandatory gates.

## Acceptance history

- None.

## Testing approach

### Profile planning scenarios

Fixtures run one Linear issue through each profile. `quick` proves a compact plan auto-validates only for an entirely clean audit (AC-024). `standard` proves implementation cannot start before the issue plan passes audit (AC-025). `strict` proves both drift evidence and a source-derived checklist are present and blocking (AC-026).

### Authority and handoff contracts

Tests provide a project plan, vary issue scope, and assert that the issue plan references rather than rewrites architecture decisions (AC-027). Contract tests reject implementation packets missing the issue plan, source spec, relevant files, or workflow decision and verify every artifact by name and hash (AC-028).

### Relay and human gates

Temporary worktree scenarios verify that the relay baton transports `run_id`, effective profile, and decision hash and rejects stale or cross-repository state (AC-029). PR fixtures prove relay mode still pauses for human feature acceptance and manual merge (AC-030).

### Failure and fallback scenarios

Owned-boundary doubles simulate missing Linear context, stale artifacts, plan drift, failed verification, absent Moon Moth, and invalid relay state. Each case must either choose the documented native path or stop with the last validated artifact and no false completion.

## Non-goals

- Define workflow classification, profile precedence, risk floors, manifest storage, packaging, or Claude Code/Codex parity; the parent kernel spec owns those concerns.
- Create a Linear project or decompose a project into issues.
- Implement direct local tasks without a Linear issue.
- Replace the project-level architecture plan with an issue-specific alternative.
- Define the internals of Moon Moth, Git Gremlin, or Monkey Maestro beyond their handoff contracts.
- Automatically accept a feature, merge a PR, or mark a Linear issue complete.
- Make autopilot relay mandatory for normal issue delivery.
