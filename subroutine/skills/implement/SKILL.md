---
name: implement
description: Use when creating, refactoring, or implementing TypeScript in a monorepo — React components/hooks/pages (front) or Hono procedures/services/domain libs (back). Explores first, applies a shared discipline (type-safety, Result/unwrap, Zod, named exports), defers to the repo's own AGENTS.md, and verifies through the project toolchain.
argument-hint: [plan-file|task-description]
effort: high
allowed-tools: Read, Glob, Grep, Bash(moon run:*)
---

# implement

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

## Voice

Read `../../persona.md` at skill start — the subroutine voice is canonical for
the wrapper lines. All code artifacts (components, services, types, comments) are
always English; chat adapts to the user's language. The architectural and
type-safety rules below are non-negotiable regardless of how breathy the voice
gets.

**Scope:** local to this skill's execution only; revert to the session default
voice after the final report.

This skill is **rigid** — execute steps in order.

## Context

> Auto-injected on Claude Code at skill load. If the lines below show literal `` !`...` `` text, run those commands manually before step 1.

- Type-safety contract: !`cat "${CLAUDE_PLUGIN_ROOT}/shared/type-safety.md"`
- Validation contract: !`cat "${CLAUDE_PLUGIN_ROOT}/shared/validation.md"`
- Code organisation: !`cat "${CLAUDE_PLUGIN_ROOT}/shared/code-organisation.md"`

## Language

Adapt chat output to the user's language. Code and technical identifiers stay
English / original form.

## Input (optional)

This skill runs standalone or chained from `linear-devotee:plan`, which may pass
a validated plan artifact:

```
PLAN_FILE: <abs path to docs/linear-devotee/plan/*.md>
```

Resolve the input from `$ARGUMENTS` first: if `$ARGUMENTS` contains a
`PLAN_FILE:` line or a path to a plan markdown, treat it as `PLAN_FILE`;
otherwise treat `$ARGUMENTS` as the task description (and ask if empty and no
task is evident from the conversation).

When `PLAN_FILE` is present, read it first and treat its **Files**, **Steps**,
**Verify**, and **Out of scope** sections as the authoritative plan — do not
re-plan from scratch in Step 3. Still run Step 2 exploration to ground the edits
in real code, but scope it to the plan's Files and honour its Out-of-scope
boundary. If the file path is missing or unreadable, fall back to the normal
explore-then-plan flow and say so.

## The contract you're bound to

This skill applies a shared discipline that lives in
`${CLAUDE_PLUGIN_ROOT}/shared/`. The three always-active contracts —
`type-safety.md`, `validation.md`, `code-organisation.md` — are already loaded
via the `## Context` block above; do not re-read them. Read the stack-specific
ones only when relevant to the task:

- `react-rules.md` — when the target is React (front)
- `hono-pipeline.md` — when the target is Hono/backend (back)

**The repo's own `AGENTS.md` always wins** over these contracts. Read it first;
the `shared/` files are the fallback discipline when the repo is silent.

## Step 0 — Track progress

Use `TodoWrite` to create one task per major step: read local instructions →
explore → plan → implement → verify → report. Mark each `in_progress`/`completed`.

## Step 1 — Read local instructions (repo wins)

Read, in priority order:

- The nearest `AGENTS.md` for the target path, and scoped ones up the tree
  (highest priority — these are the repo's real conventions).
- `CLAUDE.md` (often re-imports `AGENTS.md`).
- The target package's `package.json#exports`, `moon.yml` (if a moon repo), and
  any repo-local skills that cover this exact task (e.g. an `atlas-api-procedure`
  recipe). **Prefer a repo-local recipe over this skill's generic steps when one
  exists** — defer to it.

If local instructions conflict with the `shared/` contract, the repo wins.

## Step 2 — Determine the stack & explore

Decide React (front) vs Hono/backend (back) from the target path and surrounding
code. Then dispatch the `subroutine:explorer` subagent (see `## Subagent
dispatch`) to gather context in parallel — design system + data patterns for
React, or contract/errors/service/unwrap siblings for Hono. If subagents are
unavailable, do the same discovery inline before editing.

## Step 3 — Plan

If a `PLAN_FILE` was provided (see `## Input`), adopt its **Steps** / **Files**
as the plan, reconcile them against what Step 2 found, and skip blind planning —
flag any mismatch between the plan and the real code before editing. Otherwise:

- **React**: sketch the JSX render tree, map it to the folder structure
  (`react-rules.md` Rule 2), decide leaves vs folders, plan edits deepest-first.
- **Hono**: identify which pipeline layers the change touches (contract → error
  union → service → unwrap → router → wiring) per `hono-pipeline.md`. Most
  changes touch several; an existing resource rarely needs new wiring.

State the plan in one tight block before editing.

## Step 4 — Implement (bound to the contract)

Write the code applying the relevant `shared/` contracts + the repo's
conventions. Before writing any helper, grep shared libs for an existing
equivalent (`code-organisation.md`). Type-safety is non-negotiable: no
`any`/`as`/`!`; model failures as `Result` variants (back); props are
IDs/primitives (front).

## Step 5 — Verify (moon-aware)

- **If a `.moon/` workspace is present**: run checks via `moon run
<project>:<task>` (typecheck / lint / test) — never raw `tsc`/`eslint`/`bun
test`. Better: hand off to `moon-moth:verify` to run the affected set with
  evidence. For backend changes, write the test first and watch it fail before
  implementing (TDD) where behaviour is involved.
- **Otherwise**: run the exact lint/typecheck/test commands documented in the
  repo's `AGENTS.md`/`CLAUDE.md`. Never invent raw tool calls.

## Step 6 — Final report + hand-off

```text
subroutine:implement report
  Stack:    react | hono
  Target:   <main path created or refactored>
  Files:    <N created, M edited — short summary>
  Contract: type-safety ✓ · validation ✓ · <react-rules | hono-pipeline> ✓
  Checks:   <typecheck/lint/test — pass|fail, via moon run | project toolchain>
```

Then hand off:

```
<voice line — subroutine>
(v) verify → moon-moth:verify on the affected set (recommended in a moon repo)
(c) commit → git-gremlin:commit
(s) stop
```

## Subagent dispatch (Step 2)

```
Agent({
  subagent_type: 'subroutine:explorer',
  description: 'explore before implementing',
  prompt: `PROJECT_ROOT: /abs/path/to/project
TARGET: /abs/path/to/target/file.ts(x)
STACK: react | hono | auto
Return the structured context report.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Use `any`, `as T`, or `!` (use `unknown`+narrowing, guards, schema parse).
- Throw business errors from domain/service code — return a `Result` variant.
- Pass domain objects as React props — IDs and primitives only.
- Put logic in an `index.ts` (declarative re-exports only).
- Run raw `tsc`/`eslint`/`vitest`/`bun test` in a moon repo — always `moon run`.
- Override the repo's `AGENTS.md` with the `shared/` contract — the repo wins.
- Mutate external services without explicit user confirmation.
