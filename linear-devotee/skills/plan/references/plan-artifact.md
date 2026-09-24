# Issue plan artifact

Read this immediately before drafting `docs/linear-devotee/plan/<ISSUE_ID>.md`.

```yaml
issue: <ISSUE_ID>
linear-project: <project id | _none_>
spec: <absolute path | _none_>
project-plan: <absolute path | _none_>
status: draft
plan-version: <1 or previous version + 1 for a material revision>
acceptance-ids: [AC-001, AC-L001]
validated-at: _none_
```

A foundation-only issue uses an empty Acceptance list and explains its source foundation
reason in Context. A material revision returns to draft, clears the validation timestamp,
and increments once; corrections within the same review keep that version.

Include:

- **Context** — intended and observed behavior, source references, decisions, and open
  consequential questions.
- **Files** — affected entry points and paths marked existing/modified/new, including how
  they integrate.
- **Acceptance traceability** — exact assigned criteria mapped to tasks and observable
  verification; name integrated-verification ownership.
- **Implementation steps** — stable ids, checkboxes, `covers` ids or justified
  `foundation`, dependencies, changes, and completion evidence. Group by deliverable.
- **Verification** — commands/scenarios, expected success and failure behavior, and the
  criteria proved. Distinguish reproduced failures, plans, and actual results.
- **Coordination** — reviewed interactions, authoritative contracts, dependencies or
  independence evidence, verification owners, and cycle evidence.
- **Risks** — material failure modes and their handling or unresolved decision.
- **Out of scope** — adjacent work excluded or owned elsewhere.
