---
id: project-creation-workflow
status: ratified
spec-version: 1
linear-project: _none_
verified-by: spec-auditor
last-reviewed: 2026-08-26
---

# Adaptive project-creation workflow

## Problem & Why

Creating a Linear project from an idea or an existing spec currently crosses Acid Prophet and Linear Devotee through separate interviews, artifacts, previews, and confirmation gates. The user can repeat context, receive a decomposition whose rigor is unrelated to project risk, or approve several fragments without ever seeing the complete mutation cascade.

This workflow must turn one authoritative project intent into a traceable Linear project, milestones, and issues. It must scale from a fast exploratory project to a high-risk, contract-heavy project while preserving stable Acceptance identities and one comprehensible external-mutation decision.

The shared workflow-policy kernel is specified by `docs/acid-prophet/specs/2026-08-25-adaptive-cross-runtime-workflows.md`. This child spec owns only `project-creation` behavior after that kernel selects the workflow, profile, capabilities, and gates.

## Solution

Make `linear-devotee:create-project` the domain entry point for `project-creation`. It consumes an existing Acid Prophet artifact set or gathers a concise vibe brief, then requests missing upstream artifacts from their owning skill using the same workflow run.

Profile behavior is explicit:

| Profile    | Required project artifacts before Linear mutation                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quick`    | Concise brief, stable Acceptance register, dependency-aware cascade preview                                                                      |
| `standard` | Ratified and audited spec, proportionate project plan, traceable issue decomposition, cascade preview                                            |
| `strict`   | Applicable constitution gates, guided spec review, typed contracts, quickstart evidence, codebase map, dependency-aware plan and cascade preview |

All profiles finish with one complete preview covering the proposed project, milestones, issues, dependencies, and Acceptance allocation. One approval authorizes exactly that preview. Changes after approval require a new preview and approval.

## Architecture

The workflow is one Linear project-construction pipeline coordinated by Linear Devotee. Acid Prophet remains the source of spec artifacts; Linear Devotee remains the owner of Linear drafting and mutations.

The pipeline opens or creates one `run_id`, validates the parent decision manifest, and maintains an artifact inventory keyed by stable artifact type and content hash. When an artifact required by the effective capability graph is missing, Linear Devotee hands control to its owning skill and supplies the run, current inventory, and explicit return target. The returning skill attaches the artifact to the same run. A completed capability is never requested again, preventing Acid Prophet ↔ Linear Devotee loops.

The Acceptance register is authoritative throughout decomposition. Each proposed issue records the Acceptance IDs it implements, and the cascade validator rejects missing, duplicated, or unknown allocation unless the preview explicitly identifies a project-level criterion that cannot belong to one issue.

The preview is a deterministic rendering of the exact mutation payloads. Its approval stores the preview hash in the workflow state. Linear mutations may proceed only while the payload hash matches. Partial results are recorded by stable operation key so retry performs only unconfirmed operations.

## Components / data flow

- **Input normalizer:** converts an idea, spec path, or Acid artifact set into one project brief and artifact inventory.
- **Artifact gate:** compares that inventory with capabilities required by the effective profile.
- **Spec handoff:** invokes Acid Prophet for a missing owned artifact and returns to the same run.
- **Cascade drafter:** produces the project, milestones, issues, dependencies, and Acceptance allocation.
- **Cascade validator:** checks traceability, dependency consistency, and payload completeness.
- **Preview and mutation gate:** binds one approval to one exact cascade hash.
- **Recovery ledger:** records successful Linear operations and the next safe operation.

```text
idea or Acid artifact set
  → validate workflow decision
  → resolve missing required artifacts
  → draft complete Linear cascade
  → validate Acceptance traceability
  → show one exact preview
  → obtain one mutation approval
  → create only unconfirmed objects
  → report created resources and recovery state
```

`quick` may collect its concise brief directly within Linear Devotee. `standard` and `strict` use Acid Prophet for spec-owned artifacts. No profile creates multiple competing specs for the same run.

## Error handling

| Condition                                                 | Required behavior                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Parent decision is absent or invalid                      | Use the embedded kernel’s one permitted resolution; block if still invalid |
| Required artifact is missing                              | Handoff to its owner with the same `run_id` and an explicit return target  |
| Handoff returns without the artifact                      | Stop with the missing capability and preserve resumable state              |
| Artifact hash changes during drafting                     | Invalidate the cascade and rebuild the preview                             |
| Acceptance allocation is incomplete or inconsistent       | Block preview approval and identify the affected IDs                       |
| Preview payload differs from approved hash                | Require a new preview and approval                                         |
| User declines the preview                                 | Perform no Linear mutation and preserve the draft                          |
| Linear mutation partially succeeds                        | Record confirmed operations and stop; retry only missing operations        |
| Existing Linear object conflicts with a planned operation | Stop and request reconciliation; never silently duplicate or overwrite     |

The workflow never downgrades the effective profile or drops an immutable external-mutation gate. Errors identify the current run, artifact or operation, safe recovery point, and whether any external object was created.

## Acceptance

- [AC-019] WHEN `project-creation` resolves to `quick`, THE SYSTEM SHALL produce a concise brief, stable Acceptance register and one complete Linear cascade preview before mutation.
- [AC-020] WHEN `project-creation` resolves to `standard`, THE SYSTEM SHALL produce an audited spec, a proportionate project plan and a traceable Linear issue decomposition.
- [AC-021] WHEN `project-creation` resolves to `strict`, THE SYSTEM SHALL include applicable constitution gates, guided spec review, typed contracts, quickstart evidence and a codebase map.
- [AC-022] WHEN a required upstream project artifact is missing, THE SYSTEM SHALL hand off to its owning plugin while preserving the same workflow run.
- [AC-023] WHEN the complete Linear cascade preview is approved, THE SYSTEM SHALL perform at most one global mutation gate for that approved cascade.

## Acceptance history

- None.

## Testing approach

### Profile scenarios

Table-driven integration tests execute the same project idea under all profiles. The `quick` fixture asserts the concise brief, stable Acceptance register, and complete preview (AC-019). The `standard` fixture asserts an audited spec, proportionate plan, and one-to-many Acceptance traceability into issues (AC-020). The `strict` fixture enables each additional artifact capability and verifies none can be falsely marked complete (AC-021).

### Handoff and loop prevention

Tests start with each required artifact absent in turn, verify a single owner handoff, and assert that `run_id`, decision hash, inventory, and return target survive both directions (AC-022). Re-entering with a completed capability must not invoke its owner again.

### Preview and mutation safety

Contract tests compare the approved preview hash with the mutation payload, prove that only one global approval is requested, and require reapproval after any payload change (AC-023). Linear is doubled at its owned boundary to simulate approval refusal, partial success, retry, name conflict, and timeout without real mutations.

### Traceability and recovery

The cascade validator is tested with missing, duplicated, unknown, and project-level Acceptance mappings. Recovery tests prove confirmed operations are not repeated and that every stop reports the exact next safe operation.

## Non-goals

- Define workflow classification, profile precedence, risk floors, manifest storage, packaging, or Claude Code/Codex parity; the parent kernel spec owns those concerns.
- Deliver issue implementation or direct local tasks.
- Implement Acid Prophet artifact internals beyond the explicit handoff contract.
- Replace Linear’s project, milestone, issue, or dependency model.
- Mutate Linear before the complete cascade preview is approved.
- Automatically merge PRs, implement generated issues, or mark them complete.
- Add a second orchestrator beside Linear Devotee for this workflow.
