# Plan artifact contract

For spec `YYYY-MM-DD-<slug>.md`, write under `docs/acid-prophet/plans/<slug>/`:

- `plan.md`: decisions, dependency-ordered deliverables, verification, and risks.
- `codebase-map.md`: evidence the implementing engineer can reuse.
- `quickstart.md`: observable acceptance scenarios.
- `contracts/`: one Markdown file per necessary changed interface; may be empty.

## plan.md

```markdown
---
id: <slug>
spec: <relative source path>
status: draft
plan-version: 1
spec-version: <exact source version>
acceptance-ids: [AC-001, AC-002]
validated-at: _none_
spec-synced-at: <source last-reviewed>
---

# Plan — <title>

## Context

<goal, approved scope, and source link>

## Decisions

<consequential choice, evidence, rejected viable alternative, and trade-off>

## Files

- <path and symbol>: <role> [new | modified | delete]

## Acceptance coverage

- AC-001 → task 1 · quickstart scenario 1
- AC-002 → task 2 · quickstart scenario 2

## Steps

- [ ] Task 1: <observable deliverable>
      depends-on: none
      files: <paths/symbols>
      change: <specific responsibility and integration>
      covers: AC-001
      verify: <command or manual action>
      expect: <observable success and relevant failure outcomes>
- [ ] Task 2: <deliverable>
      depends-on: task 1
      files: ...
      change: ...
      covers: AC-002
      verify: ...
      expect: ...

## Verify

<project-level commands; distinguish runnable existing checks from checks to create>

## Risks

<concrete risk with mitigation or explicit accepted consequence>

## Out of scope

<boundaries from the approved spec>
```

A task may cover several ids. `covers: foundation` requires a reason and a dependent
deliverable; it cannot substitute for acceptance coverage. Validation sets
`status: validated` and a real ISO `validated-at`. Do not mark Steps complete while
writing the plan; those boxes describe future implementation.

## codebase-map.md

Use `# codebase map — <slug>` and sections `Relevant files`, `Existing patterns`, and
`Integration points`. Name the paths/symbols actually read, their responsibilities,
existing tests/commands, and proposed new paths. Describe observed behavior separately
from the intended change. Keep evidence bounded to the feature.

## contracts/<name>.md

Use kebab-case filenames and sections `# contract: <name>`, `Shape`, `Origin`,
`Invariants`, and `Errors`. Shape contains a short typed sketch appropriate to the
project language. Origin names the source section, producer, consumers, and
`covers: <active AC ids | foundation>`. Each invariant names its enforcement point;
each error names the caller-visible outcome. Reuse existing types by reference.
Record the agreed contract version/source and decision authority, each producer/consumer task,
and conformance/integrated verification ownership. Required agreement cannot remain “coordinate
with task X” in a validated plan. Fix the contract before parallel work, order consumers after a
bounded contract/output producer with a reason, or regroup inseparable changes. Shared files
alone do not impose ordering: explain independent symbols and unchanged shared invariants.
Check the whole task graph for cycles; a fixed contract permits parallel work only when each
task can deliver its Acceptance without the other's implementation output.

## quickstart.md

Use `# quickstart — <slug>` and sections `Setup`, `Walkthrough`, and `Cleanup`.
For each numbered scenario, give preconditions, concrete actions, an `observe:` line
with the expected result, and `covers:` with the relevant active ids. Every active
criterion needs at least one scenario; one happy path is insufficient when failures
are specified. Label unavailable commands as planned instead of claiming to run them.

## Named handoff

```text
PLAN_FILE: <absolute plan.md path>
CONTRACTS_DIR: <absolute contracts directory>
QUICKSTART_FILE: <absolute quickstart.md path>
CODEBASE_MAP_FILE: <absolute codebase-map.md path>
SPEC_FILE: <absolute source spec path>
CONSTITUTION_FILE: <absolute constitution path | _none_>
```

Keep every field, including `_none_` for an absent constitution. Do not hand off a
directory alone or substitute paths inferred from prose. Consumers must receive the
same source and artifact set that was reviewed.
