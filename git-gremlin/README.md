# git-gremlin

![git-gremlin](./assets/banner.png)

Commit and PR helper for Claude Code and Codex.

It recognizes commit or PR intent, drafts the boring text from the current git state, and performs mutations only after explicit confirmation.

## Skills

| Skill                | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `git-gremlin:commit` | Draft and optionally run a conventional commit from staged or approved changes |
| `git-gremlin:pr`     | Draft and optionally create a GitHub pull request from branch history and diff |

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
