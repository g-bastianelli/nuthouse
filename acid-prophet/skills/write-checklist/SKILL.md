---
name: write-checklist
description: Derive an open per-spec acceptance checklist for issue planning or QA/PR review while preserving source AC ids. Generation never counts as feature acceptance.
argument-hint: "[spec-path] [--plan <path>]"
model: sonnet
effort: high
allowed-tools: Read, Write, Glob, Grep, Bash
disallowed-tools: Edit, NotebookEdit
---

# write-checklist

Read `../../persona.md`; it is canonical for user-facing output until the report. Match the user's
language and keep technical identifiers unchanged.

A generated checklist is always open. Derivation proves coverage, not that the feature passes.

## Workflow

1. When `linear-devotee:plan` supplies `PLAN_FILE`, `SPEC_FILE`, and `DRIFT_EVIDENCE`, read
   [references/issue-delivery.md](references/issue-delivery.md) and satisfy its gate first.
2. Otherwise resolve a readable spec from the explicit path, branch issue id, close filename slug,
   then one clarification if ambiguous. Verify Git, note whether `gh` is available, and prepare
   `docs/acid-prophet/checklists/`.
3. Warn and default to stop when the spec is not `ratified | approved | ready | implementing` or
   contains unresolved clarification markers.
4. Extract verbatim active Acceptance, Constraints, Non-goals, Error handling, and Testing approach
   with section and line. Acceptance stops before history or the next peer heading. Preserve every
   `AC-###`; missing or duplicate ids block and route to `acid-prophet:audit-spec`.
5. Draft one unchecked item per criterion, highest-priority EARS criteria first. Each item carries
   id, short handle, verbatim requirement, one supported verification action, and source location.
   Separate constraints and non-goals. When verification is not supported, write
   `[NEEDS CLARIFICATION: ...]` instead of inventing it.
6. Print the full draft and ask `accept (y) | edit (e) | regenerate (r) | abandon (a)`. Only an
   accepted draft is written to `docs/acid-prophet/checklists/<spec-slug>.md` with this contract:

   ```yaml
   ---
   id: <spec-slug>
   spec: <repository-relative spec path>
   status: open
   acceptance-ids: [AC-001, AC-002]
   generated-at: <ISO date>
   ---
   ```

   Remove a leading `YYYY-MM-DD-` from the spec filename when deriving the slug.

7. Commit only after the user explicitly chooses it; never bypass hooks. Offer PR comment, absolute
   path, or stop. Posting also requires an explicit choice and an open PR.

Checklist item shape:

```markdown
- [ ] **[AC-001] <short handle>** — <verbatim requirement>
      how to verify: <supported command, UI step, or observation>
      source: <section>:<line>
```

## Report

```text
acid-prophet:write-checklist
  Spec:         <path>
  Checklist:    <absolute path>
  Items:        <acceptance · constraint · non-goal counts>
  AC coverage:  <covered/total>
  Open markers: <count or none>
  PR comment:   <posted | skipped | unavailable>
```

Never auto-check or accept items, renumber source ids, mutate the spec, publish without authority,
push, rebase, amend, or use `--no-verify`.
