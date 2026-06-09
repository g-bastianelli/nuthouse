---
name: review
description: Use automatically when the user asks to review code, review the current diff, inspect a PR/branch/commit range, run a contextual code review, "review la PR", "review ce diff", or "fais une review". Loads repo instructions such as AGENTS.md, CLAUDE.md, Copilot instructions, path-scoped rules, and PR/spec context before producing severity-ranked findings. Do not use for commit creation, PR creation, branch creation, or implementing fixes unless the user explicitly asks to address findings.
effort: high
---

# git-gremlin:review

Rigid review harness. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Voice

Read `../../persona.md` at the start of this skill. That persona is
canonical for all output of this skill. Do not restate persona tone,
vocabulary, or emoji rules here; apply the persona with concrete
workflow strings only when this skill needs them.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.
Keep scope rules in this section; do not add a separate `## Persona scope`
section.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original format regardless of language.

## When you're invoked

Use this skill for code-review intent:

- current diff, staged diff, branch diff, PR diff, commit range, or specific file review
- convention-focused review using local repo rules
- adversarial review before commit, PR, merge, or handoff
- "review", "code review", "review la PR", "review ce diff", "check this branch"

This skill reviews and reports. It does not implement fixes unless the user explicitly asks for a follow-up fix pass.

## Workflow

1. Preconditions:
   - Verify this is a git repository.
   - Verify `node` is available.
   - Resolve `PLUGIN_ROOT`. Prefer `${CLAUDE_PLUGIN_ROOT}` when set; otherwise infer it from the installed skill path or current repo layout.
   - Run the context compiler:
     ```bash
     node <PLUGIN_ROOT>/scripts/review-context.mjs
     ```
     Add `--base <ref>` or `--staged` if the user explicitly requested a base or staged-only review.
2. Load review context:
   - Read the generated context manifest.
   - Read every instruction source marked `applies`.
   - If an instruction source is marked `large`, read only the relevant section(s) by searching for touched paths, frameworks, or review keywords first.
   - If PR context is available through `gh`, read `gh pr view --json title,body,baseRefName,headRefName,reviewDecision` and include it as intent context.
   - If Linear/spec identifiers appear in the PR body, branch name, or user request, load the available local spec/issue context before judging drift.
3. Inspect the diff:
   - Use the manifest's `Diff command` as the primary diff.
   - Read surrounding source files when the diff alone is insufficient to prove or dismiss a finding.
   - Review every changed human-written source file unless the user scoped the review narrower.
   - For generated files, vendored code, lockfiles, large snapshots, and fixture blobs, scan for blast radius and state if they were not line-reviewed.
4. Run review passes in this order:
   - Correctness, runtime behavior, edge cases, concurrency, data loss, migrations, and backward compatibility.
   - Local instruction and convention violations from `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `.github/instructions/**`, `.cursor/rules/**`, `.codex/**`, `.agents/**`, and equivalent repo rules.
   - Architecture boundaries, dependency direction, ownership, and module shape.
   - Tests: missing coverage, tests that cannot fail, wrong assertion level, fixture drift.
   - Documentation, release notes, generated artifacts, and API/client collections when the change affects user-facing behavior.
   - Security, privacy, accessibility, and performance only where touched or plausibly impacted.
5. Validate findings:
   - Do not emit a finding unless it has local evidence and a concrete impact.
   - Each finding must include severity, title, `File`, `Evidence`, `Impact`, and `Fix`.
   - Use `Files:` instead of `File:` only for cross-file findings where one line number would be misleading.
   - If drafting the report into a temporary file is practical, run:
     ```bash
     node <PLUGIN_ROOT>/scripts/validate-findings.mjs <report.md>
     ```
     Fix format failures before final output.
   - If no concrete issues are found, say `No blocking findings` and list residual risk.
6. Report:
   - Findings first, ordered by severity.
   - Keep summary secondary and short.
   - Include the context manifest summary: review target, diff command, instruction sources loaded, and sources missing/truncated.

## Finding Contract

```markdown
HIGH: Short title
File: path/to/file.ts:123
Evidence: The local code path or diff line that proves the issue.
Impact: The concrete failure mode, regression, or policy breach.
Rule: Optional source such as AGENTS.md, CLAUDE.md, or local convention.
Fix: Minimal direction, not a full implementation unless tiny.
```

Severity meanings:

- `BLOCKER` — likely correctness/security/data-loss break or violates a hard merge gate.
- `HIGH` — serious bug, broken workflow, or strong architectural violation.
- `MEDIUM` — real maintainability, coverage, or behavior risk that should be handled soon.
- `LOW` — small but concrete issue.
- `NIT` — optional polish; never blocks.
- `INFO` — useful context, not a requested change.

## Final Report

```text
git-gremlin:review report
  Target:       <branch | staged | worktree | explicit range>
  Diff:         <git diff command used>
  Rules loaded: <n applied instruction sources>
  Findings:     <n blockers/high/medium/low/nit/info or "none">
  Residual risk:<tests not run / PR unavailable / generated files scanned only / none>
```

## Never

- Never `git commit`, `git push`, or `git rebase`.
- Never create or update a PR.
- Never mutate external services without explicit user confirmation.
- Never implement fixes during the review unless the user explicitly asks for a fix pass.
- Never invent rules that were not loaded or evident in local code.
- Never block on personal preference; mark optional polish as `NIT`.
- Never hide uncertainty: report missing PR context, missing base branch, unreadable rules, or skipped generated files.
