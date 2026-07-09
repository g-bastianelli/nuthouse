---
name: spawn
description: Use when a new branch is needed — to create a branch, start work on a new branch, "crée une branche", "nouvelle branche", "bosse sur X dans une nouvelle branche", "spawn a workspace", "nouveau workspace", or when the PreToolUse hook blocked an in-place `git checkout -b` / `git switch -c` / `git branch <new>`. Creates a dedicated Superset workspace (one git worktree per branch) and spawns a fresh agent on the task instead of branching in place. Do not use for switching to an existing branch, deleting/renaming branches, commits, or PRs.
argument-hint: "[branch-or-task-description]"
effort: high
allowed-tools: Bash(git rev-parse:*), Bash(git branch --show-current), Bash(superset --version), Bash(superset projects list:*), Bash(superset agents list:*), Bash(superset workspaces create:*), Bash(superset workspaces open:*), Bash(superset workspaces list:*), Bash(superset workspaces delete:*), Read
---

# git-gremlin:spawn

One workspace per branch. This skill never creates a branch in place — it spins up an isolated Superset workspace (a dedicated git worktree) and hands the task to a fresh agent running inside it. The current agent does not follow the branch; it stops once the workspace is spawned. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.
> Relay prompt marker: `AUTOPILOT RELAY (monkey-maestro)` — if `--prompt` begins with this exact marker, step 3 treats the spawn as relay-origin and skips the final command confirmation after the user has chosen the agent. Do not require reading or validating `autopilot.json` in this skill; the caller owns relay state.

## Voice

Read `../../persona.md` at the start of this skill. That persona is
canonical for all output of this skill. Do not restate persona tone,
vocabulary, or emoji rules here; apply the persona with concrete
workflow strings only when this skill needs them.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.

## Workflow

1. Preconditions:
   - Verify the `superset` CLI is available: `superset --version`. If missing, abort and tell the user to install the Superset CLI.
   - Verify it is authenticated: `superset projects list --json`. If it errors with "Not logged in", abort and tell the user to run `superset auth login` (or set `SUPERSET_API_KEY`) themselves, then re-invoke. Never attempt the login.
   - Verify this is a git repository (`git rev-parse --is-inside-work-tree`).
2. Resolve the workspace inputs (do not invent — ask the user for anything genuinely unknown):
   - **branch**: the new branch name. Take it from `$ARGUMENTS` when present (a branch name or a task description to derive one from), else from the user's request or from the blocked command the hook intercepted. If absent, ask.
   - **name**: the workspace name (required by `superset workspaces create`). Default it to the **branch** name; surface it and let the user override.
   - **base-branch**: a caller- or relay-supplied `base-branch` is **authoritative** and wins (the autopilot relay passes `main`); only when none is supplied, default to the current branch (`git branch --show-current`). Surface it; let the user override. In autopilot the step-3 confirmation is skipped, so the supplied `base-branch` must be honored as-is — never silently substitute the current branch (else the new worktree would stack on the previous issue's unmerged branch).
   - **project**: match the current repo to a Superset project from `superset projects list --json` (by repo path / name). If exactly one matches, use its id; if ambiguous or none, ask the user to pick.
   - **agent**: run `superset agents list --local`, then always ask the user to choose `codex` or `claude` before building the final command. Do not default to the current runtime. Do not treat a caller/user hint such as `--agent codex`, `--agent claude`, "use Codex", or "use Claude" as consent; mention it as the preselected option if useful, but still require the user's explicit choice. If one of `codex` or `claude` is not listed locally, surface that and ask only among the available choices. This agent-choice gate is separate from the command confirmation gate and is never skipped, including autopilot.
   - **prompt**: a concise summary of the task the new agent should continue. Derive it from the conversation; confirm with the user before spawning.
   - **cleanup_workspace_id**: optional, caller-supplied only. Used by `monkey-maestro:advance` to delete the previous workspace after the new workspace is opened. Never invent it. If present, validate it with `superset workspaces list --local --json`; delete only when it exists locally, is `type: "worktree"`, and is not the newly created workspace id.
3. Mutation gate (user decision point):
   - If the `--prompt` begins with the exact marker line `AUTOPILOT RELAY (monkey-maestro)` (the only relay-origin signal spawn can observe — spawn cannot see its caller, and every spawn carries some `--prompt`): after the user has explicitly chosen the agent, skip only the final command confirmation and run the command directly. Otherwise: show the exact command that will run and ask for explicit confirmation. Do not proceed without it.
     ```
     superset workspaces create --local \
       --project <project-id> --name "<name>" --branch <branch> --base-branch <base-branch> \
       --agent <agent> --prompt "<prompt>"
     ```
4. Execute on approval:
   - Run the confirmed `superset workspaces create …` command.
   - Capture the new workspace id from the output (`--json` for a stable parse if needed).
5. Open in the desktop app:
   - Run `superset workspaces open <workspace id>` so the new workspace surfaces in the Superset desktop app right away. Without this the workspace exists but the user has to open it by hand. If `open` errors (e.g. the desktop app is not running), report the failure and the manual command — do not retry.
6. Cleanup previous workspace (optional, best effort):
   - If `cleanup_workspace_id` is supplied and step 5 opened the new workspace, validate it as above, then run `superset workspaces delete --local <cleanup_workspace_id>` from a neutral cwd such as `/tmp`.
   - If validation fails, the id equals the new workspace id, the workspace is not local, or the workspace is `type: "main"`, skip cleanup and report the reason.
   - If delete errors, report the manual command. Do not retry and do not mark the spawn failed; the new workspace already owns the next task.
7. Report and stop:
   - Report the spawned workspace and confirm it was opened (or surface the manual `superset workspaces open <id>` if step 5 failed). The current agent's work on this task ends here — the spawned agent owns the branch.

## Final Report

```text
git-gremlin:spawn report
  Name:        <name>
  Branch:      <branch>
  Base:        <base-branch>
  Workspace:   <workspace id>
  Agent:       <agent> spawned with the task prompt
  Opened:      desktop app (or: superset workspaces open <workspace id> — run manually)
  Cleanup:     deleted <cleanup_workspace_id> | skipped (<reason>) | not requested
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Create the branch in place with `git checkout -b` / `git switch -c` / `git branch <new>` — that is exactly what this skill replaces.
- Run `superset workspaces create` without the explicit confirmation gate — except a relay-marked spawn whose `--prompt` begins with the `AUTOPILOT RELAY (monkey-maestro)` marker.
- Choose `claude` or `codex` silently. The agent-choice question is mandatory every time this skill spawns a workspace.
- Run `superset auth login` on the user's behalf — surface the requirement and stop.
- Continue working on the task in the current workspace after spawning — hand it off and stop.
- Delete a workspace before the new workspace has been opened, delete `type: "main"`, or delete the newly created workspace id.
- Invent a project id, branch name, or task prompt — ask when unknown.
