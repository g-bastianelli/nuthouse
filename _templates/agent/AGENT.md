<!-- template-meta
required_frontmatter: [name, description]
optional_frontmatter: [model, effort, tools, skills, memory, maxTurns, color, disallowedTools]
required_sections: []
variables: [agent, description]
-->

---

name: {{agent}}
description: {{description}}

# model: haiku # haiku = fetch/parse/scout · omit = reasoning/audit

# effort: low # low = parse/summary · high/xhigh = deep reasoning · omit = default

# skills: [plugin:skill] # preload full skill content into the agent context at startup (not just descriptions)

# memory: project # persistent memory across conversations — scope: user | project | local

# maxTurns: 15 # cap agentic turns before the subagent stops

# color: cyan # UI identification — red/blue/green/yellow/purple/orange/pink/cyan

# disallowedTools: [Write, Edit] # remove tools from the inherited or specified list

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
