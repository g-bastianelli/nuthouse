---
name: reconcile-drift
description: Use after development drift is detected to correct accidental implementation changes or synchronize specs and affected artifacts with decisions already approved by the user. Ask only for unresolved consequential decisions; inspection-only requests remain read-only.
argument-hint: "[spec-path] [drift-report-path]"
effort: high
---

# acid-prophet:reconcile-drift

Bring the prophecy and the implementation back into agreement without making the
implementation its own authority.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its
scope ends at the final report.

## Language

Match the user's language; keep technical identifiers unchanged.

## Establish the evidence

Read the complete supplied drift report (inline or at its supplied path), the source,
affected code/tests, relevant plan/checklist, and user decisions. Resolve missing context
from the active delivery artifacts; never choose between ambiguous sources silently.
Require the report's scope, source version, and repository state still to match. If
missing or stale, refresh it first:

**REQUIRED SUB-SKILL:** Use `acid-prophet:check-drift` with the same source and scope.

For an inspection-only request, return the findings and proposed resolutions without
editing. Otherwise classify each finding using intent and evidence, not convenience:

| Finding                                         | Action                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implementation contradicts established intent   | Fix the affected code within authorized scope; run relevant verification. Preserve unrelated work.                                               |
| User already approved the changed behavior      | Record the decision and its provenance, then revise the source and affected artifacts below. Do not ask for the same approval again.             |
| Behavior, scope, or authority remains undecided | Present expected/observed behavior, impact, and a recommendation. Ask one focused question; continue independent work while awaiting the answer. |
| Evidence is missing or conflicting              | Investigate the gap; retain an unresolved finding if evidence cannot settle it. A missing test is not permission to change a requirement.        |

A reversible implementation choice inside the source's existing constraints does not
require rewriting Acceptance. Record it in the plan when useful. General permission to
implement does not approve a new product policy. A failed check or incomplete feature
is never a reason to weaken requirements.

## Revise accepted intent and its references

For an approved change to a local spec, pass its existing absolute path, exact approved
delta, decision provenance, and report to the owning workflow:

**REQUIRED SUB-SKILL:** Use `acid-prophet:write-spec` to revise that file in place.

Use `../../shared/spec-format.md`: advance the version once for this revision, return
to draft during review, preserve stable identities and record retired criteria. Clear
stale audit metadata. Reuse the user's explicit approval of the exact change; new
consequential choices still need their decision. The existing independent audit and
ratification process applies. Do not create a replacement spec or rebuild the project.

After ratification, locate artifacts referencing the changed source/ids, including
project and issue plans, contracts, quickstarts, checklists, and linked Linear issues.
Update only affected references and verification expectations. Retain unrelated content
and progress. Reopen affected checklist checks until new evidence supports them;
document synchronization is not test completion. Re-review affected plan relationships
under their existing format/owning workflow before restoring validated status.

For Linear (including a Linear-only authoritative source), prepare exact changes to
existing issue/project descriptions. Apply only when the user has authorized those
external updates; prior explicit authorization counts. Otherwise finish all local work
and present the concrete pending edits for approval. Read the latest remote body before
writing, preserve unrelated sections and stable ids, and read back to verify. Never
create duplicate issues, change status/assignees/dependencies, or expand the project as
a side effect. On a conflict or failed write, stop that mutation and report remaining
items; do not overwrite concurrent edits or claim full synchronization.

## Verify and return

Run checks appropriate to code changes and report actual results. Once repairs and
authorized synchronization are complete:

**REQUIRED SUB-SKILL:** Use `acid-prophet:check-drift` again with the original scope.

A worktree fix does not clear a committed finding until it is included in HEAD. Do not
commit here. If the same finding persists after two correction attempts, stop that
repair with the evidence and decision needed; continue independent work without
recursing into reconciliation again. Return unresolved findings to the caller.

## Final report

Report corrected findings, revised source/version and artifact paths, verification
actually run, and pending decisions or external edits. Use `reconciled` only when all
affected items in scope are resolved; otherwise report `partial` or `blocked` with
the exact remaining work. Keep the report short when everything agrees.

## Never

**IMPLEMENTED DOES NOT MEAN APPROVED.**

| Excuse                                    | Reality                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| "The code already does it"                | Find the decision authorizing the behavior or ask.             |
| "The tests pass with the new expectation" | Test changes do not authorize requirement changes.             |
| "The local spec is updated"               | Report pending linked artifacts and external updates honestly. |

- Never commit, push, rebase, or publish a PR from this skill.
- Never mutate sources while merely detecting or inspecting drift.
- Never ratify a source with unresolved decisions or a failed audit.
