# git-gremlin

![git-gremlin](./assets/banner.png)

Contextual review, commit, and PR helper for Claude Code and Codex.

It recognizes review, commit, or PR intent, compiles repo instructions before review, drafts the boring text from the current git state, commits from explicit commit intent, and keeps PR creation behind a confirmation gate. It also enforces **one workspace per branch**: any attempt to create a branch in place is intercepted and redirected to a dedicated Superset workspace.

## Skills

| Skill                | Purpose                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| `git-gremlin:commit` | Run a conventional commit from staged or explicitly approved changes                    |
| `git-gremlin:pr`     | Draft and optionally create a GitHub pull request from branch history and diff          |
| `git-gremlin:review` | Review the current diff/branch with repo instruction files explicitly loaded            |
| `git-gremlin:spawn`  | Create a per-branch Superset workspace (one git worktree per branch) and spawn an agent |

## Review Skill

`git-gremlin:review` is a contextual code-review harness. It does not just ask the model to
"look at the diff"; it first compiles the local review context, then forces a severity-ranked
review format.

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

## Hooks

| Event                 | What it does                                                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse` (`Bash`) | Intercepts in-place branch creation (`git checkout -b`, `git switch -c`, `git branch <new>`) and redirects to `git-gremlin:spawn`. Only fires when the cwd is under the Superset-managed tree (`~/.superset/projects` or `~/.superset/worktrees`). Disable with `GIT_GREMLIN_SPAWN_DISABLE=1`. |

### Codex note

The interception logic works identically on Codex (same `PreToolUse` `permissionDecision: "deny"` contract), but Codex does **not** load plugin-bundled `hooks/hooks.json` by default — it is gated behind the `plugin_hooks` feature flag ([openai/codex#16430](https://github.com/openai/codex/issues/16430), [PR #19705](https://github.com/openai/codex/pull/19705)). Until that flag is on by default, copy the same `PreToolUse` entry into `~/.codex/hooks.json` (pointing at the installed plugin's `claudecode/hooks/intercept-branch.mjs`) for the hook to fire under Codex.

## Agents

| Agent            | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `commit-drafter` | Read staged diff and produce a commit proposal or approved commit hash |
| `pr-drafter`     | Read branch log/diff and produce a PR proposal or approved PR URL      |

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
