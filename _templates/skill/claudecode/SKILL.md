<!-- template-meta
required_frontmatter: [name, description]
required_sections: ["## Voice", "## Language"]
variables: [plugin, skill, description, persona_path]
-->
---
name: {{plugin}}:{{skill}}
description: {{description}}
---

# {{skill}}

## Voice

Read `{{persona_path}}` at the start of this skill. That persona is
canonical for all output of this skill. Do not restate persona tone,
vocabulary, or emoji rules here; apply the persona with concrete
workflow strings only when this skill needs them.

**Scope:** local to this skill's execution only. Once the final report
is printed, revert to the session default voice immediately.
Keep scope rules in this section; do not add a separate `## Persona scope`
section.

This skill is **rigid** — execute steps in order.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

[Describe when this skill should be used]

## Step 0 — Preconditions

1. Verify cwd contains `.claude-plugin/marketplace.json`. If not, abort.

## Step 1 — [First step name]

[Step description]

## Final report

[Describe what the skill reports back to the user]
