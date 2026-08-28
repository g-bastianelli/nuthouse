# git-gremlin

![git-gremlin](./assets/banner.png)

Contextual review, commit, and PR helper for Claude Code and Codex.

It recognizes review, commit, or PR intent, compiles repo instructions before review,
drafts the boring text from the current git state, stages dirty changes when a commit needs
them, and publishes local branches after the PR confirmation gate. Workspace orchestration
and branch guards belong to Monkey Maestro.

## Skills

| Skill                | Purpose                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| `git-gremlin:commit` | Commit a staged selection, or stage dirty changes when no selection exists    |
| `git-gremlin:pr`     | Draft a PR, then publish the branch and create it after explicit confirmation |
| `git-gremlin:review` | Review the current diff/branch with repo instruction files explicitly loaded  |

## Review Skill

`git-gremlin:review` is a contextual code-review orchestrator. It does not just ask the
model to "look at the diff"; it first compiles the local review context, then delegates
the review to the strongest available backend and renders only substantiated,
severity-ranked findings.

Typical prompts:

```text
review this diff
review la PR
use git-gremlin to review staged changes
review against origin/main
```

The skill detects the review target in this order:

1. explicit staged review when requested (`--staged`)
2. branch diff against PR base / `origin/HEAD` / `origin/main`
3. dirty worktree diff against `HEAD`

It loads applicable instruction sources before judging the diff:

- `AGENTS.md`
- `CLAUDE.md` / `CLAUDE.local.md`
- `CODEX.md`
- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md`
- `.cursor/rules/**`
- `.devin/rules/**`
- `.codex/**/*.md` and `.codex/{rules,instructions}/**`
- `.agents/**/*.md` and `.agents/{rules,instructions}/**`

The report is intentionally strict:

```text
HIGH: Short title
File: path/to/file.ts:123
Evidence: The local code path or diff line that proves the issue.
Impact: The concrete failure mode, regression, or policy breach.
Rule: Optional source such as AGENTS.md, CLAUDE.md, or local convention.
Fix: Minimal direction.
```

If there is no concrete issue, the skill should say `No blocking findings` and list residual
risk instead of inventing preferences.

### Review Backends

The skill is intentionally portable across Claude Code and Codex:

1. **Native review backend, when callable** — if the runtime exposes a callable bundled
   review backend inside the current turn, `git-gremlin:review` can pass it the compiled
   context packet and request findings in the same strict format.
2. **Portable multi-pass backend, default** — otherwise the skill runs the reusable passes
   from the `git-gremlin:review-passes` knowledge skill (preloaded into the `reviewer` host
   agent on Claude Code): correctness, conventions, tests/docs, and risk only when
   security/privacy/performance/accessibility is relevant. In runtimes with subagents, the
   passes can run in parallel; without subagents, the same passes run inline.
3. **Inline fast path** — tiny low-risk diffs can be reviewed in one pass, but still use
   the same context manifest and finding contract.

This keeps the deterministic repo-context layer while avoiding a hard dependency on
Claude-only `/code-review` or Codex-only `/review` slash commands.

### Review Helpers

The skill ships two deterministic Node helpers:

```bash
node git-gremlin/scripts/review-context.mjs
node git-gremlin/scripts/review-context.mjs --staged
node git-gremlin/scripts/review-context.mjs --base origin/main --json
```

`review-context.mjs` prints the diff target, changed files, applicable instruction sources,
diff stat, and warnings such as untracked files that require separate inspection.

```bash
node git-gremlin/scripts/validate-findings.mjs report.md
cat report.md | node git-gremlin/scripts/validate-findings.mjs
```

`validate-findings.mjs` rejects vague review output that lacks severity, file evidence,
impact, or fix direction.

The portable backend is defined in:

```bash
git-gremlin/skills/review-passes/SKILL.md
```

That knowledge skill (`user-invocable: false`) contains the shared packet format,
candidate finding schema, pass definitions, and aggregation rules used by both subagent
and inline fallback reviews. On Claude Code it is preloaded into the `reviewer` host
agent; on Codex the review skill reads it by name as a fallback.

### Tuning Notes

Ship it as a first-pass review harness, then tune from real reviews:

- Add or adjust instruction-source patterns only when a real repo needs them.
- Tune `skills/review-passes/SKILL.md` before adding runtime-specific agents; the same
  pass contract should keep Claude Code and Codex behavior aligned.
- Keep false positives visible and convert them into examples or validator checks.
- Prefer tightening the finding contract over adding broad prose instructions.
- Keep helper scripts dependency-free (`node:fs`, `node:path`, `node:child_process` only).

## Agents

| Agent            | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `commit-drafter` | Read staged diff and produce a commit proposal or approved commit hash          |
| `pr-drafter`     | Read branch log/diff, publish it, and produce a PR proposal or approved PR URL  |
| `reviewer`       | Host `git-gremlin:review` forked runs with the review-passes contract preloaded |

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install git-gremlin@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `git-gremlin`.
