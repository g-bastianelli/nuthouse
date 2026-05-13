<!-- template-meta
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, allowed-tools]
required_sections: ["## Workflow", "## Never"]
variables: [plugin, skill, description]
-->

---

name: {{skill}}
description: {{description}}

# model: haiku # haiku = lightweight read/report · omit = orchestration/reasoning

# effort: high # high = multi-step orchestration · low = cheap scout · omit = default

# allowed-tools: Read, Glob, Grep, Bash # explicit allowlist

---

# {{skill}}

Rigid [gate type]. Match the user's language; keep technical identifiers unchanged.

[IF plugin has persona-line-contract.md — warden voice]

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> [/ENDIF]

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
