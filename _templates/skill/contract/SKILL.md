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
description: {{description}} Background knowledge contract, preloaded into {{plugin}} agents; not a user-facing workflow.

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
Genre notes — read before choosing this template over `_templates/skill/claudecode/`.

A **contract** is background knowledge: a discipline a reader implements against, a schema
two components exchange, or a canonical set of invocations. It is read, not run. It has no
preconditions, no ordered steps, no approval gate, and no final report — so `## Workflow`,
`## Final Report`, and `## Never` do not apply, and `/audit` skips those checks for this
genre.

Declare the genre in the description with the exact phrase
`not a user-facing workflow`. That phrase is what routes `/audit` to this template.

Choose the workflow template instead whenever the skill performs ordered actions, gates a
mutation, dispatches subagents, or reports a result. A skill that does anything is a
workflow, however short.

Existing contracts in this marketplace:

- `subroutine/skills/*` — ambient implementation disciplines injected by a hook
- `moon-moth/skills/affected-scope` — the scope map JSON contract
- `moon-moth/skills/moon-commands` — canonical `moon` CLI invocations
-->
