<!-- template-meta
required_frontmatter: [name, description]
required_sections: []
variables: [agent, description]
-->
---
name: {{agent}}
description: {{description}}
---

# {{agent}}

## Mission

[Ordered list of steps this agent executes]

1. [Step 1]
2. [Step 2]

## Input

[Describe what input this agent expects — format, required fields]

## Output

[Describe the output format — SDD brief / structured report / custom]

## Hard rules

- Read-only by default — Write/Edit require explicit justification in the plan
- Output must be deterministic for the calling skill
- Never run `git commit` or `git push`
- Cap output at 500 words unless the plan specifies otherwise
