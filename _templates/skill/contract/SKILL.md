<!-- template-meta
genre: contract
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, allowed-tools, user-invocable, paths, disable-model-invocation]
required_sections: []
forbidden_sections: ["## Workflow", "## Final Report"]
variables: [plugin, skill, description]
-->

---

name: {{skill}}
genre: contract
description: {{description}}

# user-invocable: false # set when only Claude and this plugin's agents should read it

# paths: `src/**/*.ts` # glob pattern(s) — activate only when working with matching files (drop the backticks)

---

# {{skill}}

[One line: what this contract is the single source of truth for, and who consumes it.]

## When this applies

[The exact condition under which a reader must follow this contract — a file kind being
edited, an agent being dispatched, a schema being exchanged. A contract has no steps, so
this replaces the workflow: it says when the rules bind, not what order to do things in.]

## [Rule group]

[Rules, invariants, schemas, or canonical invocations. Each group is one coherent topic.
State the rule, then the reason it exists. Show the shape a reader must produce or accept.]

## [Rule group]

[...]

<!--
Genre notes — read before choosing this template over `_templates/skill/workflow/`.

A **contract** is background knowledge: a discipline a reader implements against, a schema
two components exchange, or a canonical set of invocations. It is read, not run. It has no
preconditions, no ordered steps, no approval gate, no final report, and no voice — so
`## Voice`, `## Workflow`, `## Final Report`, and `## Never` do not apply, and `/audit`
rejects `## Workflow` and `## Final Report` for this genre.

Declare the genre with the frontmatter key `genre: contract`. That key is what routes
`/audit` to this template; it stays out of the description, which a hook may inject.

Choose the workflow template instead whenever the skill performs ordered actions, gates a
mutation, dispatches subagents, or reports a result. A skill that does anything is a
workflow, however short.

Existing contracts in this marketplace:

- `subroutine/skills/*` — ambient implementation disciplines injected by a hook
-->
