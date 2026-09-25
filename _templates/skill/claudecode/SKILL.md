<!-- template-meta
genre: workflow
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, allowed-tools, argument-hint, disable-model-invocation, user-invocable, paths, disallowed-tools, context, agent]
required_sections: ["## Workflow"]
variables: [plugin, skill, description]
-->

---

name: {{skill}}
description: {{description}}

# allowed-tools: Read, Glob, Grep, Bash

# argument-hint: "[issue-id]"

# context: fork

---

# {{skill}}

Read `../../persona.md`; it is canonical for user-facing output until the final report. Match the
user's language and keep technical identifiers unchanged.

[One sentence naming the outcome and the workflow's degree of freedom.]

## Workflow

1. [Preconditions and evidence required before action.]
2. [Ordered decisions and actions.]
3. [Verification and stopping conditions.]
4. [Concise final report or handoff.]

## References

Delete this section when the skill has no conditional detail.

- Before [specific condition], read [references/topic.md](references/topic.md).

## Boundaries

- [Only invariants that prevent a concrete permission, safety, or correctness failure.]
- Run the repository's mechanical checks instead of restating lint rules.

<!-- Keep SKILL.md concise. Put conditional procedures, schemas, and extended examples in a
directly linked references/ file. Do not create references for content used on every invocation. -->
