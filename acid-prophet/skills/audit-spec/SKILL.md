---
name: audit-spec
description: Review an existing spec for contradictory behavior, unverifiable acceptance, unsupported decisions, and repository conflicts. Returns concrete blockers and a parsed readiness verdict; use before ratification or when a spec's quality is in doubt.
argument-hint: [spec-path]
effort: high
allowed-tools: Read, Glob, Grep, Agent, Bash
disallowed-tools: Write, Edit, NotebookEdit
---

# acid-prophet:audit-spec

Identify what would force an implementing engineer to guess, and what evidence resolves it.
The requested audit is read-only unless the user also authorized specific metadata repairs.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Review

1. Resolve the requested spec and project root. Use the explicit path when supplied;
   ask if selection is ambiguous. Verify the file is readable. Outside a git repository,
   use the available project directory and report missing repository context.
2. Resolve `PLUGIN_ROOT` from this skill's `../..` directory and read
   `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` (substitute `PLUGIN_ROOT` outside
   Claude Code). Dispatch `acid-prophet:spec-auditor`
   with `SPEC_PATH`, `PROJECT_ROOT`, `PLUGIN_ROOT`, and `MODE: report-only`.
3. Import and execute `parseSpecAuditorReport(RAW_REPORT)` from
   `${PLUGIN_ROOT}/lib/parse-spec-auditor-report.mjs`. Preserve the actual report. If it
   does not parse, request one corrected report; if still malformed, report that failure
   and its raw evidence. A missing verdict never means ready.
4. Lead with behavioral blockers, affected criteria, and decisions needed. Link the
   complete report or include it if short. Distinguish an implementation blocker from
   a transport/metadata repair and from an optional improvement. Report
   `ready for ratification | blocked`; audit readiness never changes spec status.

## Authorized follow-up

If the user requested fixes, apply only deterministic metadata repairs supported by the
document/history. Import `applyFrontmatterPatch` from
`${PLUGIN_ROOT}/lib/apply-frontmatter-patch.mjs` and pass explicit `{ key, value }`
pairs; its module is a function, not a patching CLI. Reject a proposed repair to
`spec-version`, `status`, `verified-by`, `linear-project`, or an acceptance id. Those
fields carry version, approval, or external-link state and require their owning workflow.
An audit may flag missing sections; auto-fixing metadata cannot supply their meaning.
Re-audit after repairs and use only the new verdict. Leave changes uncommitted unless a
commit was requested. Never turn a fix suggestion into an unsolicited mutation.

For requested behavioral revisions, pass the source and findings to
`acid-prophet:write-spec`, preserving accepted ids and the user's stated intent.

When a Linear handoff is already requested, the current report is eligible, the spec is
ratified, and `linear-project` is `_none_`:

**REQUIRED SUB-SKILL:** Use `linear-devotee:create-project` with the absolute spec path.

A draft that audits cleanly still goes through ratification before that handoff. For an
already linked spec, report the existing project rather than creating another one.
Otherwise finish the audit without a mandatory menu or commit prompt.

## Completion

Report the spec path, readiness verdict, blocker/warning/info counts, any repairs actually
applied, and the next action taken. An unreadable file or malformed report is reported
as blocked, never as an empty successful review.
