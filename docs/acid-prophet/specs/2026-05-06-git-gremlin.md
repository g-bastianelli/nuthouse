---
id: git-gremlin
status: draft
linear-project: _none_
verified-by: guillaume.bastianelli@notom.io
last-reviewed: 2026-05-06
---

# git-gremlin

A nuthouse plugin for delegating git commit and PR creation to subagents — keeping diffs out of the main context and saving tokens.

## Problem & Why

Each meaningful git operation (well-crafted commit, described PR) requires reading the full diff — which floods the main context with raw tokens. Claude Code already has RTK to filter simple outputs, but no mechanism delegates the *diff reading + message writing* to an isolated subagent. Result: writing a good commit message or PR description is expensive in context, or you cut corners to save tokens.

This plugin delegates these operations to subagents: the diff stays in their context, the main context only receives a short proposal to validate and the final URL.

## Solution

A nuthouse plugin (`git-gremlin`) with two skills:

- **`git-gremlin:commit`** — delegates to a subagent that reads `git diff --staged`, proposes a conventional commit message, waits for confirmation, executes `git commit`.
- **`git-gremlin:pr`** — delegates to a subagent that reads `git log <base>...HEAD` + `git diff <base>...HEAD`, proposes title + PR description, waits for confirmation, executes `gh pr create`.

In both cases: the diff never transits through the main context. Flow: `invoke skill → subagent proposes → user confirms → subagent executes → skill returns compact result`.

Runtime prerequisites: `git` + authenticated `gh` CLI. No npm dependencies.

## Architecture

```
user → git-gremlin:commit (SKILL.md)
             └─ Agent(subagent_type: git-gremlin:commit-drafter)
                    reads: git diff --staged
                    proposes: commit message (conventional commits)
                    ← returns proposal to skill
             └─ user confirms
             └─ Agent(subagent_type: git-gremlin:commit-drafter, continuation)
                    executes: git commit -m "..."
                    ← returns: commit hash

user → git-gremlin:pr (SKILL.md)
             └─ Agent(subagent_type: git-gremlin:pr-drafter)
                    reads: git log <base>...HEAD + git diff <base>...HEAD
                    infers: base branch (main/master/origin default)
                    proposes: title + body (markdown)
                    ← returns proposal to skill
             └─ user confirms (or edits)
             └─ Agent(subagent_type: git-gremlin:pr-drafter, continuation)
                    executes: gh pr create --title "..." --body "..."
                    ← returns: PR URL
```

Two agents: `commit-drafter`, `pr-drafter`. Allowed tools: `Bash` only (git + gh CLI).

## Components / Data flow

**`git-gremlin:commit`** (SKILL.md)
1. Verify staged files exist (`git diff --staged --name-only`). Error if empty.
2. Dispatch `commit-drafter` → receives `{ message: string, files: string[] }`.
3. Display proposal to user, wait for confirmation.
4. Re-dispatch `commit-drafter` with `action: execute` → receives `{ hash: string }`.
5. Return: `Committed <hash> — <message>`.

**`git-gremlin:pr`** (SKILL.md)
1. Verify `gh` is available (`gh auth status`). Error if not authenticated.
2. Infer base branch: `gh repo view --json defaultBranchRef` or fallback `main`.
3. Dispatch `pr-drafter` → receives `{ title: string, body: string, base: string }`.
4. Display proposal, wait for confirmation (or edit request).
5. Re-dispatch `pr-drafter` with `action: execute` → receives `{ url: string }`.
6. Return: `PR created → <url>`.

**`commit-drafter`** (agent, Bash only)
- Input: raw staged diff. Output: conventional commit message + file list.

**`pr-drafter`** (agent, Bash only)
- Input: log + diff vs base. Output: title ≤ 72 chars + structured markdown body.

## Error handling

| Situation | Behaviour |
|---|---|
| No staged files | `git-gremlin:commit` exits with clear message before dispatch |
| `gh` absent or not authenticated | `git-gremlin:pr` exits with `gh auth login` instruction |
| Empty diff vs base branch | `git-gremlin:pr` exits: "nothing to PR — no commits ahead of `<base>`" |
| User rejects proposal | Skill offers to regenerate or cancel — no silent commit/PR |
| `git commit` fails (pre-commit hook) | `commit-drafter` surfaces stderr verbatim; skill displays error, does not retry |
| `gh pr create` fails | `pr-drafter` surfaces stderr verbatim; skill displays error, does not retry |

Warden dispatches at visible transitions — left to scaffold.

## Testing approach

Unit tests (`bun test`) for any Node helpers present (base branch inference, empty staged diff validation).

No integration tests on `git commit` / `gh pr create` — these are external side-effects, too costly to mock usefully. Real coverage comes from manual usage in a test repo.

Agents (`commit-drafter`, `pr-drafter`) are not unit-tested — their logic is prompt + Bash, not Node code.

## Non-goals

- Rebase, cherry-pick, stash, merge — out of scope v1
- Automatic branch creation
- PR review or review/comment management
- Multi-remote support (GitLab, Bitbucket…) — GitHub + `gh` CLI only
- SessionStart/UserPromptSubmit hooks — automatic background hooks are out of scope; implicit skill invocation is driven by skill metadata
- Replacing RTK for simple git commands
