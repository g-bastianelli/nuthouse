# Existing-spec revisions and caller handoffs

Read this when revising an existing spec or when another workflow supplied named inputs.

## Revise in place

Keep the supplied path and identity. Apply only the approved delta, record its decision
provenance, advance `spec-version` once, clear stale audit metadata, and return the source
to draft. Preserve stable Acceptance identities and record retired criteria under
`../../../shared/spec-format.md`.

Approval of the exact change already present in the conversation remains valid. Ask only
about newly introduced consequential choices. After audit and ratification, return to
`acid-prophet:reconcile-drift` when it is the caller so dependent artifacts can be updated
and the implementation checked again.

## Accept a create-project handoff

`linear-devotee:create-project` may provide:

```text
SPEC_FILE: <absolute candidate path | _none_>
ACCEPTANCE_REGISTER: <absolute upstream register path | _none_>
RETURN_TARGET: linear-devotee:create-project
```

Read every supplied non-`_none_` path. Reconcile the existing candidate and register while
preserving accepted ids; do not restart the upstream interview or select a different spec.
Audit and ratify through the normal gate, then immediately return the absolute ratified path
and active ids to `RETURN_TARGET`. A blocked draft returns its blockers, never a successful
handoff. This skill performs no Linear mutation and writes no session store.
