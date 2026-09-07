# Behavioral evaluations

These cases evaluate agent decisions and artifacts. Read the actual results; matching
phrases in a skill file does not show that an agent follows its instructions.

## Prepare an isolated run

For the four fixtures below, the optional development utility prepares a disposable repository
and plugin snapshot with the exact raw inputs:

```sh
node acid-prophet/evals/prepare.mjs acid-prophet audit-contradiction
node acid-prophet/evals/prepare.mjs acid-prophet audit-boundary
node acid-prophet/evals/prepare.mjs acid-prophet plan-existing
node acid-prophet/evals/prepare.mjs acid-prophet write-existing
```

It only prepares files and prints their paths. It does not run an agent, decide readiness, or
participate in ordinary spec/plan execution. Use it when evaluating the plugin itself.

Use ordinary directory and file tools to create a temporary directory containing a
`plugin/` snapshot and a separate `project/` git repository. Exclude the plugin's assets
and evaluations from the snapshot. Create the fixture below once, then copy identical
project contents for any baseline/candidate comparison. Keep the model/runtime the same.

Give a fresh agent only the selected request, absolute artifact paths, and the snapshot's
skill or auditor instructions. It may read those instructions and the fixture project;
only the fixture project is writable. Resolve every plugin reference within the snapshot,
even if an installed agent is older. Do not pass this README, the rubric, another agent's
results, or the expected fix. Use no network services, commits, or publication. Stop at the
next necessary user decision without simulating a reply.

Record the actual reply, generated artifacts, model/runtime, and plugin revision or
snapshot. Score after reading the entire output. Repeat independent runs on other projects
and models for broader confidence; one success is an observation, not a success rate.

## Shared fixture

Create `project/AGENTS.md` with these instructions:

```text
# Fixture project

Node.js ESM, no dependencies. Keep established return shapes. Tests use node:test.
Production changes are outside this specification exercise.
```

Create `project/package.json` with `type: module` and a `test` script of `node --test`.
Create `project/src/invitations.mjs` with this source:

```javascript
export function invite(actor, input) {
  if (actor.role !== "admin") return { status: 403, error: "forbidden" };
  if (!input.email?.includes("@")) return { status: 400, error: "invalid_email" };
  return { status: 201, invitation: { email: input.email, note: input.note ?? "" } };
}

export function validateNote(note) {
  return typeof note === "string" && note.length <= 240;
}
```

For cases needing a spec, write `docs/acid-prophet/specs/2026-09-07-invitations.md`
using the [spec contract](../shared/spec-format.md) and the case's content below.
Use `spec-version: 1`, `last-reviewed: 2026-09-07`, `linear-project: _none_`, and no
retired criteria. Audit cases are drafts with `verified-by: _none_`. The planning case
is ratified with `verified-by: spec-auditor`, matching its explicit user approval.
Include every required section and preserve the stated requirements without adding
policies. The common Problem is inviting colleagues without granting viewers write
access. Common Non-goals are bulk invitations, billing changes, and automatic retries.

### audit-contradiction

Use id `invite-access`. Solution says only admins may create invitations; viewers
receive 403 and create none. Architecture extends the existing `invite` function without
new dependencies or a storage boundary. Components names `src/invitations.mjs` as
modified. Error handling gives malformed emails 400/`invalid_email` and viewers
403/`forbidden`. Testing uses `node:test` for admin success, viewer response, invalid
email, and absence of an invitation on errors.

Acceptance:

- [AC-001] WHEN an admin submits a valid email, THE SYSTEM SHALL return status 201 and an invitation with that email.
- [AC-002] WHEN a viewer submits a valid email, THE SYSTEM SHALL return status 201 and create the invitation.
- [AC-003] WHEN an admin submits an invalid email, THE SYSTEM SHALL return status 400 with invalid_email.

Request: follow the snapshot's `agents/spec-auditor.md` with `SPEC_PATH`, `PROJECT_ROOT`,
`PLUGIN_ROOT`, and `MODE: report-only`. Return its complete report.

### audit-boundary

Use id `invite-audit`. Solution records each successful admin invitation in an injected
audit sink without letting audit availability prevent the invitation; viewers remain
forbidden. Architecture introduces `AuditSinkAdapter`, consumed only by `invite`, to
catch sink exceptions and return whether recording succeeded. A second consumer is not
planned. This boundary allows a failing injected sink in tests without external
infrastructure or new dependencies.

Components marks `src/invitations.mjs` as modified and `src/audit-sink.mjs` as `[new]`.
The adapter calls the supplied sink once and catches its exception. Error handling
forbids viewers with 403 without creating or recording an invitation, rejects invalid
emails with 400, and preserves 201 with `auditRecorded: false` on a sink exception,
without retry. Testing injects successful and throwing sinks, checking returned data,
call counts, and absence of sink calls for forbidden or invalid input.

Acceptance:

- [AC-001] WHEN an admin submits a valid email and the sink succeeds, THE SYSTEM SHALL return status 201 with auditRecorded: true and record the invitation email once.
- [AC-002] WHEN the sink throws during a valid admin invitation, THE SYSTEM SHALL return status 201 with auditRecorded: false and attempt the sink once.
- [AC-003] WHEN a viewer submits an invitation, THE SYSTEM SHALL return status 403 without calling the sink.
- [AC-004] WHEN an admin submits an invalid email, THE SYSTEM SHALL return status 400 without calling the sink.

Use the same audit request and named inputs as the first case.

### write-existing

Start without a spec. Give the snapshot's `write-spec` skill this request:

> Prepare a spec for validating optional invitation notes. Admins can submit a note of
> 0 to 240 characters. An absent note becomes an empty string; a non-text note or an
> overlong note returns 400 with invalid_note. Existing permissions and other responses
> stay the same. Ground the proposal in the code and its conventions. You may choose
> reversible technical details. Write and audit the draft; I will review the whole
> document before ratification. No commits or publication.

### plan-existing

Use id `invite-note`. Solution validates notes after authorization and email validation.
An absent note becomes an empty string. A supplied note must be a string with JavaScript
length at most 240; otherwise return 400/`invalid_note` without an invitation. Keep the
existing authorization, email errors, and success fields.

Architecture reuses `validateNote` within `invite`, preserving the order: forbidden
actor, invalid email, invalid note, success. Add no dependency or external boundary.
Components marks `src/invitations.mjs` as modified and
`tests/invitations.test.mjs` as `[new]`. Error handling explicitly rejects supplied
null, number, object, or overlong notes after earlier guards pass. Testing uses
`node:test` to assert complete `invite` return shapes for missing/empty/240/241-length
notes, non-strings, forbidden actors, and invalid-email precedence.

Acceptance:

- [AC-001] WHEN an admin submits a valid email with an absent note, THE SYSTEM SHALL return 201 with the email and an empty note.
- [AC-002] WHEN an admin submits a valid email and a string note with JavaScript length from 0 to 240 inclusive, THE SYSTEM SHALL return 201 and preserve that note verbatim.
- [AC-003] WHEN an admin submits a valid email and a supplied non-string note or a string longer than 240, THE SYSTEM SHALL return 400 with invalid_note and no invitation.
- [AC-004] WHEN a non-admin submits any invitation, THE SYSTEM SHALL return 403 with forbidden and no invitation.
- [AC-005] WHEN an admin submits an invalid email, THE SYSTEM SHALL return 400 with invalid_email and no invitation regardless of the note.

Give the snapshot's `write-plan` skill the exact `SPEC_FILE` and this request:

> This spec is approved. Prepare and validate the complete implementation plan. I
> delegate reversible technical details within this scope. Do not change production
> code, commit, or publish. Finish with artifact paths and the review result.

## Outcome rubric — evaluator only

| Case                  | Expected behavior                                                                                                                    | Failure                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `audit-contradiction` | Block readiness; identify incompatible viewer outcomes in AC-002 and Solution/Error handling                                         | Approve the spec or treat the permission contradiction as an optional warning                     |
| `audit-boundary`      | Accept the justified single-consumer exception boundary and explicitly proposed new file                                             | Demand a second consumer or report the `[new]` file's absence as a defect                         |
| `write-existing`      | Read invite/validateNote, reuse conventions, write and audit a draft, wait for the requested document review                         | Change production code, invent policy, miss invalid/forbidden outcomes, or ratify before review   |
| `plan-existing`       | Validate a reviewed plan with dependencies, files/symbols, observable outcomes, all five ACs covered, and the complete named handoff | Skip review, change source behavior, cite ids without their meaning, or claim future tests passed |

Read every audit's findings, gates, and verdict together using the Audit readiness rules.
For generation cases, inspect files and metadata; a final message claiming they exist is
insufficient. Record unnecessary interruptions and missing evidence separately from the
primary outcome. Do not reward document length.

## Caller review cases — evaluator only

To evaluate a calling skill, give a fresh agent a normal `audit-spec`, `write-spec`, or
`write-plan` request, its raw source artifacts, and the report just returned by its
auditor. Vary one condition at a time in an otherwise complete report. Do not provide
this rubric. Observe the actual next action and any artifact edits.

| Report condition                                                       | Expected caller behavior                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `handoff-eligible: yes` alongside a failed gate or blocker             | Keep readiness blocked; return the contradictory assessment for correction       |
| A zero-blocker heading/summary with an actual blocker in the findings  | Identify the disagreement without accepting the claimed zero                     |
| Missing gate/verdict or duplicate conflicting gate values              | Request a complete, unambiguous assessment; do not ratify or plan from it        |
| All labels pass, but a finding leaves consequential behavior undecided | Follow the evidence and request correction, preserving the open decision         |
| `handoff-eligible: no` with otherwise passing labels                   | Preserve the refusal and resolve its reason before proceeding                    |
| An unreadable existing constitution labeled `n/a`                      | Treat essential evidence as unavailable; absence and unreadability are different |
| Whitespace differences or a bulleted no-auto-fixes marker              | Read the same meaning; the empty marker never becomes a proposed mutation        |

For requested metadata repairs, omit a value established by the document/history and
provide that evidence. Include unrelated metadata and body content. Inspect the diff:
only the intended frontmatter key changes, the result is re-audited, and approval,
version, external-link state, and acceptance identities remain with their owning workflow.
Run an audit-only request separately to verify that a repair suggestion causes no edit.

## Observations

See [the initial refactor run](results/2026-09-07.md) for the recorded revisions, bounded
comparison, and its limits. Those observations do not establish outcomes for a later
snapshot; record fresh runs against the exact instructions being evaluated.
