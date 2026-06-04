# git-gremlin

![git-gremlin](./assets/banner.png)

Commit and PR helper for Claude Code and Codex.

It recognizes commit or PR intent, drafts the boring text from the current git state, commits from explicit commit intent, and keeps PR creation behind a confirmation gate. It also enforces **one workspace per branch**: any attempt to create a branch in place is intercepted and redirected to a dedicated Superset workspace.

## Skills

| Skill                | Purpose                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- |
| `git-gremlin:commit` | Run a conventional commit from staged or explicitly approved changes                    |
| `git-gremlin:pr`     | Draft and optionally create a GitHub pull request from branch history and diff          |
| `git-gremlin:spawn`  | Create a per-branch Superset workspace (one git worktree per branch) and spawn an agent |

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
