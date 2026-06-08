---
name: implement
description: Use when implementing or refactoring non-React TypeScript code in a moon monorepo — backend services (Elysia/Bun), shared libs, configs, scripts. TDD-first (write the test, watch it fail, make it pass), bounded to the affected project set from moon-moth:scope. For React components/pages/hooks, prefer react-monkey:implement instead.
effort: high
---

# implement

## Voice

Read `../../persona.md` at the start of this skill. The moon-moth voice is
canonical for the wrapper lines; report blocks stay plain.

**Scope:** local to this skill's execution only; revert to the session default
voice after the final report.

This skill is **rigid** — execute steps in order. All code, comments, and
identifiers are English regardless of chat language.

## Language

Adapt chat output to the user's language. Code artifacts and technical
identifiers stay English / original form.

## When you're invoked

There's a change to make in a moon TypeScript monorepo that is **not** a React
component (those go to `react-monkey:implement`): a backend route/service, a
shared lib, a config, a script. The moon-moth lands only on the affected
packages and writes test-first.

## Step 0 — Preconditions

1. Confirm a moon workspace (`.moon/` up-tree). Capture `PROJECT_ROOT` = moon
   root. If not a moon repo, say so and defer to a generic implementation flow.
2. Obtain the **affected scope**: read a persisted scope map under
   `${PROJECT_ROOT}/docs/moon-moth/scope/` if present, else run `moon-moth:scope`
   first. You may only edit files inside the affected projects' `source` dirs —
   the dark stays dark.

## Step 1 — Read local instructions

Read the instructions that apply to the target path, in priority order:

- The nearest `AGENTS.md` (and scoped ones up the tree) — moon repos use
  `AGENTS.md` as the canonical agent contract.
- `CLAUDE.md` if present (often just re-imports `AGENTS.md`).
- The target project's `package.json#exports`, `moon.yml`, and `README.md`.

Local repo conventions **always win** over this skill (type-safety rules,
validation library, logging, ESM extension rules, naming).

## Step 2 — Locate, don't reinvent

Before writing any helper, search the affected project and its `libs/`
dependencies for an existing equivalent (the moon project graph tells you the
deps). Reuse shared code; never duplicate a util that already lives in a lib.

## Step 3 — Write the test first (TDD)

1. Write or extend a colocated `*.test.ts` next to the code under test, encoding
   the intended behaviour as concrete cases.
2. Run **only** the affected project's test task and watch it fail for the right
   reason: `moon run <project>:test` (red).
3. Do not write implementation before you have a failing test that pins the
   behaviour, unless the change is pure config/types with no runtime behaviour.

## Step 4 — Make it pass

Implement the smallest change that turns the test green. Respect the repo's
type-safety contract (no `any`/`as`/`!` if the repo forbids them), validation at
boundaries, named exports, and the package's ESM module/extension rules. Keep one
responsibility per file; name files after what they contain.

Re-run `moon run <project>:test` until green. Trust moon's cache — unchanged
projects are not re-run.

## Step 5 — Wire new workspace dependencies (if any)

If the change makes a project newly depend on another workspace package, follow
the repo's documented procedure (typically: add to the consumer's
`package.json`, its `moon.yml#dependsOn`, and its `tsconfig.json#references`),
then `bun install`. Check `AGENTS.md` for the exact steps — they vary per repo.

## Step 6 — Final report + hand-off

```text
moon-moth:implement report
  Affected:    <project ids edited>
  Files:       <N created, M edited — short summary>
  Tests:       <test files added/changed> — <red→green per project>
  New deps:    <workspace deps wired> | none
  Next:        verify (affected :typecheck/:lint/:test)
```

Then hand off:

```
<voice intro line — moon-moth>
(v) verify → moon-moth:verify on the affected set (recommended)
(s) stop   → leave it; wings unchecked
```

Recommend `(v)` — the moon-moth never declares a clean flight without checked
wings.

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Edit projects outside the affected scope.
- Skip the failing-test step for behavioural changes.
- Run raw `tsc`/`eslint`/`vitest`/`bun test` directly — always via `moon run`.
- Use `any`, `as`, or `!` when the repo's instructions forbid them.
- Mutate external services without explicit user confirmation.
