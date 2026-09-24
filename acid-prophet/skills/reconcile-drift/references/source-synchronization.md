# Approved source synchronization

Read this only when a drift finding changes accepted intent or an authoritative linked
source. An implementation that merely violated existing intent does not need this path.

## Revise the local spec

Pass the existing absolute path, exact approved delta, decision provenance, and drift
report to the owner:

**REQUIRED SUB-SKILL:** Use `acid-prophet:write-spec` to revise that file in place.

Under `../../../shared/spec-format.md`, advance the version once, return to draft during
review, preserve stable identities, record retired criteria, and clear stale audit
metadata. Reuse explicit approval of the exact delta; newly introduced consequential
choices still need a decision. Do not create a replacement spec or rebuild the project.

## Update dependent artifacts

After ratification, find project and issue plans, contracts, quickstarts, checklists, and
linked Linear issues that reference the changed source or ids. Update only affected
references and verification expectations. Preserve unrelated content and progress. Reopen
checklist items until new evidence supports them, and re-review affected plan relationships
through their existing format and owner before restoring validated status.

## Synchronize Linear only with authority

For Linear, including a Linear-only authoritative source, prepare exact changes to the
existing issue or project descriptions. Apply them only when the user authorized those
external writes; prior explicit authorization counts. Otherwise finish local work and
present the pending edits for approval.

Reload the latest remote body before writing, preserve unrelated sections and stable ids,
and read back the result. Never create duplicates, alter status/assignee/dependencies, or
expand project scope as a side effect. On conflict or failed write, stop that mutation and
report what remains instead of overwriting concurrent edits.
