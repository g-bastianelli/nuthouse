<!-- template-meta
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, allowed-tools, argument-hint, disable-model-invocation, user-invocable, paths, disallowed-tools, context, agent]
genre: workflow
required_sections: ["## Voice"]
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

## Voice

Read `../../persona.md` at the start of this skill. It is canonical for every
user-facing string this skill emits, and its scope ends with the final report.

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

[IF this skill hands to a specific next skill]
Name the next skill explicitly, on its own line, so the chain cannot be guessed:

**REQUIRED SUB-SKILL:** Use `<plugin>:<skill>`
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

<!--
Genre notes — read before choosing this template over `_templates/skill/contract/`.

A **workflow** performs ordered actions, gates a mutation, dispatches subagents, or
reports a result. `/audit` requires only `name`, `description`, and a `## Voice` section
that points to the plugin's `persona.md`. The `## Workflow`, `## Final Report`, and
`## Never` sections above are a starting skeleton, not a contract: rename or regroup
them around what the skill does, and orchestrate in prose
(`_adr/0007-prose-orchestration-over-a-workflow-kernel.md`).

A rule the skill must not break becomes a named law: the rule in capitals, then a short
`| Excuse | Reality |` table. `git-gremlin/skills/commit/SKILL.md` is the reference.
-->
