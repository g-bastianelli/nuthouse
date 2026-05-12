# linear-devotee

![linear-devotee](./assets/banner.png)

Linear workflow plugin for Claude Code and Codex.

It turns Linear issues and specs into SDD-shaped context, validated implementation plans, and gated Linear project/milestone/issue creation.

## Skills

| Skill | Purpose |
|---|---|
| `linear-devotee:greet` | Detect a Linear issue, load context, optionally prepare branch/status, then hand off to planning |
| `linear-devotee:plan` | Write and validate an implementation plan, detect spec drift, and sync accepted drift after approval |
| `linear-devotee:create-project` | Draft a Linear project cascade from a spec, preview it, then create project/milestones/issues after one approval gate |
| `linear-devotee:create-milestone` | Add or resume the next milestone in a project cascade |
| `linear-devotee:create-issue` | Add or resume the next SDD-formatted issue in a project cascade |

## Agents

| Agent | Purpose |
|---|---|
| `issue-context` | Read issue, comments, status, and referenced files into an SDD brief |
| `plan-auditor` | Compare plan, issue context, and source spec before implementation |
| `project-drafter` | Draft project SDD, milestones, and initial issue outline |
| `milestone-drafter` | Draft a milestone name, scope, target-date hint, and suggested issues |
| `issue-drafter` | Draft strict SDD issue bodies |
| `plan-writer` | Write plan artifacts to disk from structured input |

All Linear writes stay in skills and require explicit user confirmation. Agents are scouts/drafters, not Linear mutators.

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install linear-devotee@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `linear-devotee`.

## Layout

```text
linear-devotee/
  assets/
  persona.md
  shared/
  skills/
  agents/
  claudecode/
    hooks/
    lib/
    tests/
```
