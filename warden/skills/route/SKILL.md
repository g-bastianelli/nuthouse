---
name: route
description: Use when classifying a task through Warden as `project-creation`, `issue-delivery`, `direct-task`, or `ambiguous` without executing the selected workflow.
argument-hint: "[task description]"
model: haiku
allowed-tools: Bash(node:*), Bash(git rev-parse:*), Read
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
3. Execute the kernel client:
   - Run `node <PLUGIN_ROOT>/scripts/route.mjs --project-intent <explicit|absent|ambiguous> -- "$ARGUMENTS"` from the current worktree and capture stdout, stderr, and the exit status.
   - Parse stdout as the script's JSON result even when the process exits non-zero. If stdout is not valid JSON, report stderr verbatim and stop.
   - Treat the returned `workflow`, `target`, `blocked`, and `diagnostics` as authoritative. Never replace or reinterpret them.
4. Handle blocked classification:
   - When `blocked` is `true`, report the returned diagnostics and stop with no target invocation.
   - Do not choose one issue, downgrade `ambiguous`, retry with altered evidence, or ask another plugin to mutate an artifact.
5. Report the result:
   - Render every field in the final report.
   - A non-null target is a declarative handoff descriptor only. End the skill without invoking it.

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
- Embed a natural-language phrase dictionary in the kernel client or the skill.
