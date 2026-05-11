# git-gremlin

![git-gremlin](./assets/banner.png)

> chaotic saboteur / breaks everything except your context

A tamed WWII aviation gremlin, once blamed for every mechanical failure on Allied aircraft, now working exclusively on your git pipeline. It recognizes commit and PR intent from natural prompts, drafts the boring parts, and keeps `git commit` / `gh pr create` behind explicit confirmation gates.

## Skills

| Skill | What it does |
|---|---|
| `git-gremlin:commit` | Auto-triggers on commit intent, drafts a conventional commit message, then commits only after confirmation |
| `git-gremlin:pr` | Auto-triggers on PR intent, drafts a GitHub PR title/body, then creates it only after confirmation |

## Agents

| Agent | Used by | Role |
|---|---|---|
| `commit-drafter` | Claude Code `git-gremlin:commit` | Reads staged diffs and returns a conventional commit proposal or commit hash |
| `pr-drafter` | Claude Code `git-gremlin:pr` | Reads branch log/diff and returns a PR title/body proposal or PR URL |

## Install

```
/plugin marketplace add g-bastianelli/nuthouse
/plugin install git-gremlin@nuthouse
```

Restart Claude Code after install.

For Codex CLI:

```
codex plugin marketplace add g-bastianelli/nuthouse
```

Then install `git-gremlin` from `/plugins`.

## License

MIT
