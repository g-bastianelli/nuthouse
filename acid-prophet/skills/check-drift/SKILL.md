---
name: check-drift
description: Detect drift against authoritative Acceptance during planning, after an implementation block, or before a PR. Covers committed and working-tree changes without editing the source.
argument-hint: "[--plan <path> --spec <path>] [--scope worktree|committed] [--base <ref>]"
effort: high
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git status:*), Bash(git ls-files:*), Bash(git show:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(gh:*), Read, Write, Glob, Grep, Agent
paths: ["docs/acid-prophet/**"]
disallowed-tools: Edit, NotebookEdit
---

# acid-prophet:check-drift

Before delegation, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`. Read
`../../persona.md`; it is canonical for user-facing output until the report.

This is a rigid read-only comparison. Every active Acceptance id and normative constraint receives
`CLEAN`, `DRIFT`, `AMBIGUOUS`, or `UNRELATED`, with evidence, or there is no verdict.

## Workflow

1. Select one mode:
   - named absolute `PLAN_FILE` and `SPEC_FILE` supplied before implementation → read
     [references/planned-intent.md](references/planned-intent.md), write its evidence artifact,
     return to the caller, and stop;
   - development checkpoint or pre-PR comparison → read
     [references/development-pr.md](references/development-pr.md).
2. Preserve source ids exactly, including standalone Linear ids. Missing ids are `AC-UNKNOWN` and
   ambiguous; unresolved clarification markers make affected findings ambiguous.
3. Scope every statement: a clean comparison is not a passing test suite or human acceptance.
   Pending work outside the assessed block may be unrelated, but affected cross-cutting constraints
   still require classification.
4. If code or source changes during review, refresh affected evidence before the verdict.
5. Return findings for reconciliation. Publish a PR comment only on an explicit request and after
   confirmation of its exact content unless already authorized.

## Report

```text
acid-prophet:check-drift
  Branch:       <current>
  Project:      <name/id | unknown>
  Source:       <spec path | Linear fallback>
  Scope:        planned-intent | worktree | committed
  Comparison:   <base/head or plan/spec versions>
  Open markers: <count or none>
  Drift:        <confirmed · ambiguous · clean · unrelated>
  Evidence:     <artifact path when created>
  PR comment:   <posted | skipped | unavailable>
```

Never mutate Linear, specs, plans, code, the Git index, or worktree; never post without authority;
never commit, push, or rebase; and never turn missing comparison evidence into a clean result.
