---
title: shared session store — context passing between nuthouse skills
date: 2026-05-06
status: draft
id: shared-session-store
verified-by: gbastianelli
last-reviewed: 2026-05-06
---

# 🔮 shared session store

## Goal

A shared session store across all nuthouse plugins. Each skill declares what it reads and writes. No more codebase re-exploration when the context already exists.

## Context

Skills chain together — `greet → plan`, `write-spec → audit-spec → create-project` — and each step re-collects identical context from scratch. `plan-auditor` re-reads files that `greet` already resolved. `project-drafter` re-derives project structure that `write-spec` just explored. ~15× the cost of a simple chat.

The correct pattern for synchronous local pipelines (confirmed 2026: MindStudio, LangGraph, Anthropic) is the **shared run store**: JSON files on disk per session, each skill reads/writes declaratively. Nuthouse already does this partially (`greet-<ISSUE_ID>.json`, `chain-<SESSION_ID>.json`). The common foundation is missing.

## Files

**To create:**

- `shared/session-store.mjs` — shared JS utility
- `shared/context-schema.md` — declarative key schema

**To modify:**

- `linear-devotee/agents/issue-context.md`
- `linear-devotee/skills/plan/SKILL.md`
- `linear-devotee/agents/plan-auditor.md`
- `acid-prophet/skills/write-spec/SKILL.md`
- `linear-devotee/skills/create-project/SKILL.md`
- `linear-devotee/agents/project-drafter.md`
- SKILL.md for `greet`, `plan`, `write-spec`, `audit-spec`, `check-drift`, `implement` (frontmatter `context_policy`)

## Constraints

- ESM `.mjs` required (repo convention)
- No npm/bun dependencies added — `node:fs`, `node:path`, `node:child_process` only
- The store is never passed whole to a subagent — only relevant fields extracted and injected into the prompt
- Existing hooks unchanged — they handle stable transversal context (persona, voice), not dynamic inter-skill data
- oxlint and oxfmt clean, lefthook never bypassed

## Acceptance

- [ ] `shared/session-store.mjs` exports `read`, `write`, `merge`, `isStale`, `invalidate`
- [ ] `shared/context-schema.md` documents all keys with writer, readers, freshness policy
- [ ] Each concerned SKILL.md has a `context_policy: session | fresh` field in its frontmatter
- [ ] `greet` writes `relevant_files` to the store after `issue-context`
- [ ] `plan-auditor` consumes `relevant_files` from the store — skips re-read if present
- [ ] `write-spec` writes `handoff_spec` to the store at the handoff menu step
- [ ] `create-project` reads `handoff_spec` from the store in Step 0 if present
- [ ] `--fresh` forces a full re-fetch on all concerned skills
- [ ] `bunx bun test shared/` passes
- [ ] `bun run lint` and `bun run fmt:check` clean

## File structure

One file per session: `<PROJECT_ROOT>/.claude/nuthouse/sessions/<SESSION_ID>.json`.

Common fields at top level, plugin-specific fields namespaced. If a plugin hasn't run, its key is simply absent — no error.

```json
{
  "_meta": {
    "git_sha": "abc123",
    "written_at": "2026-05-06T...",
    "session_id": "$CLAUDE_SESSION_ID"
  },
  "spec_path": "",
  "relevant_files": [],
  "linear-devotee": {
    "issue": {},
    "plan_path": ""
  },
  "acid-prophet": {
    "handoff_spec": {}
  },
  "react-monkey": {
    "explorer_report": {}
  }
}
```

## Invalidation

| Key               | Namespace        | Policy                         | Reason                          |
| ----------------- | ---------------- | ------------------------------ | ------------------------------- |
| `spec_path`       | common           | Stale if file gone (`test -f`) | Spec may be moved               |
| `relevant_files`  | common           | Stale if `git_sha` ≠ `HEAD`    | Codebase may change             |
| `issue`           | `linear-devotee` | Always re-fetch                | Mutable external state (Linear) |
| `plan_path`       | `linear-devotee` | Stale if file gone             | Same as spec_path               |
| `handoff_spec`    | `acid-prophet`   | Stale if `spec_path` changed   | Derived from spec               |
| `explorer_report` | `react-monkey`   | Stale if `git_sha` ≠ `HEAD`    | Codebase exploration            |

## Non-goals

- No append-only log / event stream — synchronous local pipelines don't need it
- No Anthropic Managed Agents — designed for long async tasks with cloud sandbox, not local skills
- No dedicated context meta-agent — sequential pipeline, no central orchestrator needed
- No cache for `react-monkey:implement` — one-shot workflow, low ROI

## Edges

- If `sessionId` is absent (skill launched standalone without active session) → current behavior unchanged, store not consulted
- If store is corrupted (invalid JSON) → `read` returns `null`, skill falls back to fresh exploration, logs warning
- If two skills run in parallel on the same session → write conflict possible. Acceptable: nuthouse skills are not designed for concurrency. Document in `context-schema.md`
- If `git_sha` is absent (repo with no commits) → `isStale` returns `true` by default (safe fallback)

## Questions

- [x] `sessionId` is `$CLAUDE_SESSION_ID` — env var exposed by Claude Code, unique per session, shared by all skills in the same conversation
- [x] Store files in `<PROJECT_ROOT>/.claude/nuthouse/sessions/` — per project, not global
- [x] `chain_state` stays in `linear-devotee/data/chain-<SESSION_ID>.json` — linear-devotee specific, migration out of scope
