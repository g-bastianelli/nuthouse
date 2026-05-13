# react-monkey

![react-monkey](./assets/banner.png)

React implementation specialist for Claude Code and Codex.

It reads local project instructions, explores the surrounding React codebase, plans the component tree, then edits with strict component boundaries.

## Skill

| Skill                    | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| `react-monkey:implement` | Create or refactor React components, hooks, and pages |

## Agent

| Agent      | Purpose                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| `explorer` | Read-only codebase discovery for design system, data fetching, and nearby patterns |

## Rules

- One component per file.
- Folder structure mirrors the JSX tree.
- Props carry ids, not domain objects.
- Shared data lives in colocated select hooks.
- Large components split into focused children.

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install react-monkey@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `react-monkey`.

## Layout

```text
react-monkey/
  assets/
  persona.md
  skills/
  agents/
  shared/
  claudecode/
```
