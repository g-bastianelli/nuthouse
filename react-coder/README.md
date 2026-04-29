# react-coder

React implementation specialist with parallel codebase exploration.

## What it does

The `react-coder` skill auto-invokes when you work on React components, hooks, or pages (`.tsx`/`.jsx` files). It:

1. Spawns a parallel exploration agent (`react-explorer`) to discover your design system, data fetching patterns, and surrounding code — before writing a single line
2. Plans the folder structure (folder tree mirrors JSX tree)
3. Implements components following 5 strict architectural rules
4. Runs lint and typecheck using your project's toolchain

## The 5 rules

1. **One component per file** — no helper components in the same file
2. **Folder mirrors JSX tree** — file layout = component nesting
3. **IDs-only props** — no domain objects in props; components fetch their own data
4. **Shared data via select hooks** — siblings share a colocated hook, no extra requests
5. **Split large components into subfolders** — max ~80 lines per component

## Installation

Add to your `marketplace.json`:

```json
{ "name": "react-coder", "source": "./react-coder", "category": "productivity" }
```

## Trigger

Auto-invokes on any React work. Also triggered by `/react-coder`.
