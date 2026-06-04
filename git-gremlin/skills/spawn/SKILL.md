---
name: spawn
description: Use when a new branch is needed — to create a branch, start work on a new branch, "crée une branche", "nouvelle branche", "bosse sur X dans une nouvelle branche", "spawn a workspace", "nouveau workspace", or when the PreToolUse hook blocked an in-place `git checkout -b` / `git switch -c` / `git branch <new>`. Creates a dedicated Superset workspace (one git worktree per branch) and spawns a fresh agent on the task instead of branching in place. Do not use for switching to an existing branch, deleting/renaming branches, commits, or PRs.
effort: high
---

# git-gremlin:spawn

One workspace per branch. This skill never creates a branch in place — it spins up an isolated Superset workspace (a dedicated git worktree) and hands the task to a fresh agent running inside it. The current agent does not follow the branch; it stops once the workspace is spawned. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.

## Workflow

1. Preconditions:
   - Verify the `superset` CLI is available: `superset --version`. If missing, abort and tell the user to install the Superset CLI.
   - Verify it is authenticated: `superset projects list --json`. If it errors with "Not logged in", abort and tell the user to run `superset auth login` (or set `SUPERSET_API_KEY`) themselves, then re-invoke. Never attempt the login.
   - Verify this is a git repository (`git rev-parse --is-inside-work-tree`).
2. Resolve the workspace inputs (do not invent — ask the user for anything genuinely unknown):
   - **branch**: the new branch name. Take it from the user's request or from the blocked command the hook intercepted. If absent, ask.
   - **base-branch**: default to the current branch (`git branch --show-current`). Surface it; let the user override.
   - **project**: match the current repo to a Superset project from `superset projects list --json` (by repo path / name). If exactly one matches, use its id; if ambiguous or none, ask the user to pick.
   - **agent**: `claude` or `codex`. Default to the runtime the user is currently in. Confirm.
   - **prompt**: a concise summary of the task the new agent should continue. Derive it from the conversation; confirm with the user before spawning.
3. Mutation gate (user decision point):
   - Show the exact command that will run and ask for explicit confirmation. Do not proceed without it.
     ```
     superset workspaces create --local \
       --project <project-id> --branch <branch> --base-branch <base-branch> \
       --agent <agent> --prompt "<prompt>"
     ```
4. Execute on approval:
   - Run the confirmed `superset workspaces create …` command.
   - Capture the new workspace id from the output (`--json` for a stable parse if needed).
5. Report and stop:
   - Report the spawned workspace + how to open it (`superset workspaces open <id>`). The current agent's work on this task ends here — the spawned agent owns the branch.

## Final Report

```text
git-gremlin:spawn report
  Branch:      <branch>
  Base:        <base-branch>
  Workspace:   <workspace id>
  Agent:       <claude|codex> spawned with the task prompt
  Open:        superset workspaces open <workspace id>
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Create the branch in place with `git checkout -b` / `git switch -c` / `git branch <new>` — that is exactly what this skill replaces.
- Run `superset workspaces create` without the explicit confirmation gate.
- Run `superset auth login` on the user's behalf — surface the requirement and stop.
- Continue working on the task in the current workspace after spawning — hand it off and stop.
- Invent a project id, branch name, or task prompt — ask when unknown.
