---
name: create-project
description: Create or review a Linear project from a spec or product brief, including its milestones, issues, dependencies, correction preview, and partial-creation recovery.
argument-hint: "[spec-file] [--fresh]"
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, Agent, ToolSearch
---

# linear-devotee:create-project

Before delegation, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`. Resolve
`PLUGIN_ROOT` from this skill directory, then read `../../shared/planning-context.md` and
`../../shared/provider-selection.md`. Read `../../persona.md`; it is canonical for user-facing
output until the report.

The project, milestones, complete issue packets, and dependency relations form one proposal and
one approval boundary. Standalone additions use their dedicated skills.

## Workflow

1. Resolve the repository and authoritative source before local state. Prefer the complete named
   Acid Prophet handoff (`SPEC_FILE`, `PLAN_FILE`, `CONTRACTS_DIR`, `QUICKSTART_FILE`,
   `CODEBASE_MAP_FILE`, `CONSTITUTION_FILE`); read every supplied path and preserve `_none_` for
   absent optional artifacts. A missing named path blocks work.
2. Choose exactly one path:
   - review or revise an existing Linear project → read
     [references/review-existing.md](references/review-existing.md), return its correction preview,
     and stop without mutation;
   - create or resume a full project cascade → read
     [references/creation-cascade.md](references/creation-cascade.md) before drafting or writing.
3. Preserve the active source Acceptance register exactly. A new idea may receive proposed stable
   criteria, but those criteria enter the same full preview and are never presented as previously
   approved source truth.
4. Keep readable proposal artifacts in runtime plugin data or an ignored
   `.nuthouse/<project-slug>/`: brief, Acceptance register, draft, `preview.md`, `graph.json`, and
   `envelope.json`. Keep recovery state in exactly one append-only
   `.nuthouse/<project-slug>/progress.md`; its first line names the subject
   (`# ledger — project: <project-slug>`) and each confirmed completed step gets one line. These aid
   review and recovery; Linear remains authoritative for remote state.
5. Before any write, show one validated exact preview and obtain authorization unless the user
   already approved that exact content and delegated choices. A content or source change invalidates
   prior approval.
6. After writes, require a fresh authoritative reload, graph comparison, and field comparison.
   Graph equality alone does not prove descriptions, labels, dates, status, or Acceptance text.

## Finish

Report the project link, created versus total entities, Acceptance coverage, graph/field evidence,
and exact unresolved operation. Partial work includes proposal and ledger paths and resumes through
this skill without replaying uncertain writes.

Recommend a next issue only from live status/blocker evidence. Show `monkey-maestro:start` only
after coordination, bodies, fields, and graph all verify. Continue into delivery only when the
user already requested it.

Never commit, push, rebase, recreate confirmed resources, mutate unrelated Linear work, treat an
entity id as completed work, or silently narrow the approved scope.
