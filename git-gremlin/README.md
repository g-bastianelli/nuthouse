# git-gremlin

![git-gremlin](./assets/banner.png)

Review-comment discipline, commit, and PR helper for Claude Code and Codex.

It recognizes commit or PR intent, drafts the boring text from the current git state, stages
dirty changes when an actual commit needs them, and publishes local branches after the PR
confirmation gate. Code review itself belongs to the runtime's native reviewer; verification
belongs to hooks and CI; workspace orchestration stays outside Git Gremlin.

## Skills

| Skill                                | Purpose                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `git-gremlin:commit`                 | Commit a staged selection, or stage dirty changes when no selection exists    |
| `git-gremlin:handle-review-comments` | Push before announcing a fix; reply, then resolve on dismissal                |
| `git-gremlin:pr`                     | Draft a PR, then publish the branch and create it after explicit confirmation |

`handle-review-comments` is an ambient discipline, not a triage workflow. It never decides
whether feedback is valid, and it orders no `git commit` or `git push` of its own. It adds
two invariants to whatever workflow the acting agent already has. A reply announcing a fix
must not precede the push of that fix: until the code is on the remote, the thread would be
claiming a correction no later agent and no human reader can see. And once the acting agent
has decided to dismiss a review comment, an explanatory reply followed by thread resolution
becomes part of completing the task.

## Agents

None. Commit and PR drafting run directly in their skills so the approval context and Git
permissions stay in one place.

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
