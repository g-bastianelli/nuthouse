---
name: route
description: Use when classifying a task through Warden as `project-creation`, `issue-delivery`, `direct-task`, or `ambiguous` without executing the selected workflow.
argument-hint: "[task description]"
model: haiku
allowed-tools: Bash(node:*), Bash(git rev-parse:*), Bash(which linear), Bash(linear:*), Read, mcp__claude_ai_Linear__list_teams
---

# route

## Voice

Read `../../persona.md` at the start of this skill. That persona is canonical for all output of this skill. Keep classification and target data literal; apply the persona only to short user-facing transitions.

**Scope:** local to this skill's execution only. Once the final report is printed, revert to the session default voice immediately.

This skill is **rigid** — execute steps in order.

## Language

Match the user's language. Keep workflow names, JSON fields, file paths, CLI flags, diagnostic codes, and skill identifiers unchanged.

## When you're invoked

Use this skill for an explicit `warden:route` invocation or a request for Warden to classify a task. It returns a declarative target only; it never executes the selected workflow or owns domain artifacts.

## Workflow

1. Preconditions:
   - Treat `$ARGUMENTS` as the task description; preserve it verbatim when passing it to the client.
   - Verify the current directory is inside a Git worktree with `git rev-parse --show-toplevel`.
   - Resolve `PLUGIN_ROOT`. Prefer `${CLAUDE_PLUGIN_ROOT}` when set; otherwise infer it as two directories above this skill folder from the installed skill path or current repository layout.
   - Require `<PLUGIN_ROOT>/scripts/route.mjs`. Do not fall back to repository-only `_shared` files.
2. Normalize explicit project intent:
   - Interpret whether the task explicitly asks to create a Linear project, regardless of the user's language.
   - Pass exactly one `--project-intent` value: `explicit` when that intent is clear, `absent` when it is clearly absent, or `ambiguous` when it cannot be resolved confidently.
   - Do not maintain a language-specific phrase list and do not extract or select Linear issue identifiers yourself; the kernel client owns syntactic identifier normalization and conflict handling.
3. Resolve valid Linear team keys read-only:
   - Use the configured Linear provider's `list_teams` operation and collect each exact `team.key`. Prefer `mcp__claude_ai_Linear__list_teams` when available; otherwise use a read-only Linear CLI on `PATH` after `which linear` confirms it exists.
   - Accept only canonical keys matching `[A-Za-z][A-Za-z0-9]*`, normalize them to uppercase, deduplicate them, and add one `--linear-team-key <KEY>` flag per key.
   - If the lookup succeeds and returns no teams, pass exactly `--linear-team-keys-empty`. If any returned team lacks a canonical key, treat the lookup as failed instead of silently dropping it.
   - If neither provider is available or the lookup fails, pass exactly `--linear-team-keys-unavailable`. Never infer a team key from an arbitrary `<word>-<digits>` token, branch name, acceptance id, standard name, or task prose.
   - Treat the lookup as ephemeral input. Do not persist provider output, team metadata, or derived keys.
4. Execute the kernel client through stdin:
   - Build the command only from `node <PLUGIN_ROOT>/scripts/route.mjs`, the normalized project-intent flag, the validated team-key flags (or the explicit empty/unavailable flag), and `--stdin`.
   - Never place the task in the command line, an environment variable, a command substitution, or an unquoted heredoc. In particular, never interpolate `$ARGUMENTS` inside double quotes: backticks and `$()` must remain inert task text.
   - Pass the verbatim task through stdin with a single-quoted heredoc delimiter. Generate a unique alphanumeric delimiter and verify that it does not occur as an exact line anywhere in the task before running this shape:

     ```bash
     node <PLUGIN_ROOT>/scripts/route.mjs --project-intent <explicit|absent|ambiguous> <TEAM_KEY_FLAGS> --stdin <<'<UNIQUE_DELIMITER>'
     <verbatim task text>
     <UNIQUE_DELIMITER>
     ```

   - Capture stdout, stderr, and the exit status. If a collision-free delimiter cannot be established, stop without executing the client.
   - Parse stdout as the script's JSON result even when the process exits non-zero. If stdout is not valid JSON, report stderr verbatim and stop.
   - Treat the returned `workflow`, `target`, `blocked`, and `diagnostics` as authoritative. Never replace or reinterpret them.

5. Handle blocked classification:
   - When `blocked` is `true`, report the returned diagnostics and stop with no target invocation.
   - Do not choose one issue, downgrade `ambiguous`, retry with altered evidence, or ask another plugin to mutate an artifact.
6. Report the result:
   - Render every field in the final report.
   - A non-null target is a declarative handoff descriptor only. End the skill without invoking it.
   - A `{ kind: "current-turn", name: "direct-task" }` target returns the exact task, branch, and
     validated `linearTeamKeys` as `target.input`, plus the mandatory continuation order
     `resolveWorkflowDecision`, `prepareDirectTask`, `evaluateDirectTaskCompletion`. Warden ends
     before this continuation and never writes its state.
   - Before calling `prepareDirectTask`, the caller must import `discoverGitContext`,
     `readWorktreeOverride`, `normalizeRuntimeWorkflowInput`, `classifyWorkflow`,
     `resolveConfiguration`, and `resolveWorkflowDecision` from one available participating
     plugin's install-local `lib/workflow/index.mjs`, and read that same bundle's `bundle.json`.
     Preserve `target.input.task` verbatim as the request/prompt, reuse its branch and validated team
     keys, resolve the complete personal/repository/worktree configuration stack, and build the
     canonical risk/capability policy input. Mint one UUID v4 `runId`, use the bundle `sourceHash` as
     `policyHash`, and set expiry to the earlier of the active override expiry and 24 hours from the
     canonical `now`. Call `resolveWorkflowDecision(...)` exactly once and require its persisted
     `currentRun.decision.workflow === "direct-task"`, non-blocked decision, valid
     `effectiveProfile`, and enabled immutable `verification` gate.
   - Only then call `prepareDirectTask` with `task: target.input.task`,
     `decision: currentRun.decision`, and `decisionHandoff: currentRun.handoff`. Never pass the
     classification result itself as a decision and never synthesize a handoff descriptor. Continue
     with profile preparation, Moon/native scope, Acid Prophet artifact ownership, and snapshot-bound
     executed verification evidence outside Warden. This same install-local decision-resolution
     boundary is mandatory when Warden was never invoked.

## Final Report

```text
warden:route report
  Workflow:          <project-creation | issue-delivery | direct-task | ambiguous>
  Project intent:    <explicit | absent | ambiguous>
  Issue identifiers: <ordered list | none>
  Target:            <descriptor | none>
  Diagnostics:       <list | none>
  Blocked:           <yes | no>
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Import or execute repository-only `_shared/workflow` files at runtime.
- Execute the returned target or invoke `linear-devotee:create-project`, `linear-devotee:greet`, or a direct-task implementation.
- Write workflow state, domain artifacts, configuration, worktree overrides, voice state, or external-service data.
- Reclassify after the kernel result, select among multiple issue identifiers, or turn `ambiguous` into a routable workflow.
- Infer Linear team keys from syntactic candidates or continue to `greet` when team metadata is unavailable.
- Interpolate raw task text into a shell command, double-quoted argument, variable assignment, or executable substitution.
- Embed a natural-language phrase dictionary in the kernel client or the skill.
