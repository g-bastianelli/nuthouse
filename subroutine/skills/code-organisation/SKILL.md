---
name: code-organisation
genre: contract
description: Code-organisation discipline for TypeScript — named exports, declarative entry points, one responsibility per file, explicit package boundaries, and reuse before writing. Applies while editing TypeScript and requires check-folder-shape after structural changes, before verification.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — code-organisation discipline

For every TypeScript module; read the nearest `AGENTS.md` first.

## Shape modules around responsibilities

- Use named exports. Allow a default export only when a tool config requires it.
- One responsibility per file, named specifically (`partition.ts`), never
  a `utils.ts`/`helpers.ts` dumping ground.
- Group multiple resources into owner folders; colocate tests and private support.

```text
orders/
├── errors.ts
├── service.ts
├── service.test.ts
└── index.ts
```

## Keep entry points declarative

Keep `index.ts` to declarative composition or named re-exports, for example
`export { createOrdersService } from "./service.js";`.

Move branching, loops, I/O, side effects, and business logic into named files.
Declare a library's public subpaths in `package.json#exports`; do not create a
barrel that exposes every internal module.

## Preserve readable code and boundaries

- Use `function` declarations for top-level functions and React components;
  use arrows for callbacks and inline expressions.
- Prefer small autonomous libraries with explicit runtime/layer direction.
  Avoid catch-all `shared`/`utils` packages that hide ownership.
- Search the repo and shared packages first; reuse established abstractions/imports.

## Check the settled folder

After structural edits, before verification/completion, review the settled tree
and unchanged siblings.

**REQUIRED SUB-SKILL:** Use `subroutine:check-folder-shape`
