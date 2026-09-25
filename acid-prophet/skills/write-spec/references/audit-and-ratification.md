# Audit and ratification gate

Read this after drafting and before declaring a spec ready or ratified.

Resolve `PROJECT_ROOT` and dispatch the logical `acid-prophet:spec-auditor` with raw
artifact context only:

Before dispatch, resolve that logical name through
`${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; outside Claude Code, use the same
path under the resolved `PLUGIN_ROOT`.

```text
SPEC_PATH: <absolute spec path>
PROJECT_ROOT: <absolute project root>
PLUGIN_ROOT: <absolute plugin root>
MODE: report-only
```

Read the complete report using **Audit readiness** in `../../../shared/spec-format.md`.
Check that findings, gates, and verdict agree; preserve the actual report. A missing or
contradictory assessment needs correction and cannot count as clean.

Fix defects whose resolution follows from approved intent or repository evidence. Route a
user-owned decision back as one focused question, then re-audit substantive edits. After two
failed correction attempts on the same malformed report or unresolved finding, leave the
spec in draft and name the exact blocker.

Present the complete audited proposal once: artifact link, meaningful decisions, Acceptance
summary, and consequential warnings. General authority to investigate or draft does not
approve an unseen product policy. When ratification is still needed, ask the user to review
the document and wait.

After approval and a clean audit, set:

- `status: ratified`
- `verified-by: spec-auditor`
- `last-reviewed: <today ISO>`

Keep the source version and accepted ids accurate. Metadata-only ratification does not
require repeating the unchanged audit.
