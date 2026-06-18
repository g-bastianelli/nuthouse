<!-- template-meta
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, allowed-tools, argument-hint, disable-model-invocation, user-invocable, paths, disallowed-tools, context, agent]
required_sections: ["## Workflow", "## Never"]
variables: [plugin, skill, description]
-->

---

name: {{skill}}
description: {{description}}

# model: haiku # haiku = lightweight read/report · omit = orchestration/reasoning

# effort: high # high = multi-step orchestration · low = cheap scout · omit = default

# allowed-tools: Read, Glob, Grep, Bash # explicit allowlist

# argument-hint: "[issue-id]" # REQUIRED when the skill takes arguments — autocomplete hint

# disable-model-invocation: true # user-triggered only (deploy, commit, …) — Claude never auto-invokes

# user-invocable: false # background knowledge skill — Claude reads it, users can't invoke it

# paths: `src/**/*.ts` # glob pattern(s) — activate only when working with matching files (drop the backticks)

# disallowed-tools: Write, Edit # remove tools from the pool while the skill is active

# context: fork # run the skill in a forked subagent instead of inline

# agent: Explore # subagent to use when context: fork is set

---

# {{skill}}

Rigid [gate type]. Match the user's language; keep technical identifiers unchanged.

[IF plugin has persona-line-contract.md — warden voice]

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.
> [/ENDIF]

[IF the skill needs dynamic context — optional section, repo-wide convention]

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- [Label]: !`[read-only command]`
- [Label]: !`[read-only command]`

[/ENDIF]

## Workflow

1. Preconditions:
   - [List the things that must be true before this skill runs. Examples: MCP tools loaded, git repo verified, state file readable.]
2. [Step name]:
   - [Ordered actions. Use Bash / Read / MCP tools as needed. Keep bullets tight.]
3. [Step name]:
   - [...]
     N. [Final action — handoff, report, or stop]:
   - [...]

[IF hand-off menu]
Present numbered options after the final action:

```
[voice intro line]
  (a) <label> → <what happens>
  (b) <label> → <what happens>
  (s) stop    → <clean exit message>
```

Branch on response. Exit skill when the chosen branch finishes.
[/ENDIF]

## Final Report

```text
{{plugin}}:{{skill}} report
  <Field>:        <value>
  <Field>:        <value>
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Mutate external services without explicit user confirmation.
- Skip the preconditions step.
- [Skill-specific don'ts]
