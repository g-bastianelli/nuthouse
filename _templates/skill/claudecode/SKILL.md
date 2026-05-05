<!-- template-meta
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, allowed-tools]
required_sections: ["## Workflow", "## Never"]
variables: [plugin, skill, description]
-->
---
name: {{plugin}}:{{skill}}
description: {{description}}
# model: haiku            # haiku = lightweight read/report · omit = orchestration/reasoning
# effort: high            # high = multi-step orchestration · low = cheap scout · omit = default
# allowed-tools: Read, Glob, Grep, Bash   # explicit allowlist
---

# {{plugin}}:{{skill}}

Rigid [gate type]. Match the user's language; keep technical identifiers unchanged.

[IF plugin has persona-line-contract.md — warden voice]
> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.
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
