# git-gremlin

![git-gremlin](./assets/banner.png)

Contextual review, review-comment discipline, commit, and PR helper for Claude Code and Codex.

It recognizes review, commit, or PR intent, compiles repo instructions before review,
drafts the boring text from the current git state, commits the existing staged selection,
and publishes local branches after the PR confirmation gate. Verification belongs to hooks
and CI; workspace orchestration stays outside Git Gremlin.

## Skills

| Skill                                | Purpose                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `git-gremlin:commit`                 | Draft a conventional message and commit exactly the staged selection          |
| `git-gremlin:handle-review-comments` | Push before announcing a fix; reply, then resolve on dismissal                |
| `git-gremlin:pr`                     | Draft a PR, then publish the branch and create it after explicit confirmation |
| `git-gremlin:review`                 | Review the current diff/branch with repo instruction files explicitly loaded  |

`handle-review-comments` is an ambient discipline, not a triage workflow. It never decides
whether feedback is valid, and it orders no `git commit` or `git push` of its own. It adds
two invariants to whatever workflow the acting agent already has. A reply announcing a fix
must not precede the push of that fix: until the code is on the remote, the thread would be
claiming a correction no later agent and no human reader can see. And once the acting agent
has decided to dismiss a review comment, an explanatory reply followed by thread resolution
becomes part of completing the task.

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

### Review Execution

After the deterministic repository context is loaded, the reviewer decides for itself what
to inspect and how deeply to inspect it. It may use a callable native review backend when
useful, but Git Gremlin does not prescribe a fixed taxonomy of review passes.

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

### Tuning Notes

Ship it as a first-pass review harness, then tune from real reviews:

- Add or adjust instruction-source patterns only when a real repo needs them.
- Keep false positives visible and convert them into examples or validator checks.
- Prefer tightening the finding contract over adding broad prose instructions.
- Keep helper scripts dependency-free (`node:fs`, `node:path`, `node:child_process` only).

## Agent

Commit and PR drafting run directly in their skills so the approval context and Git
permissions stay in one place. The only dedicated agent is the read-only review host.

| Agent      | Purpose                                                                |
| ---------- | ---------------------------------------------------------------------- |
| `reviewer` | Host `git-gremlin:review` forked runs after loading repository context |

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
