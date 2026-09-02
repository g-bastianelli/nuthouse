---
name: code-organisation
genre: contract
description: Code-organisation discipline for TypeScript — named exports, declarative entry points, one responsibility per file, explicit package boundaries, and reuse before writing. Applies whenever editing or creating TypeScript files.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — code-organisation discipline

Apply this to every TypeScript module. Read the nearest `AGENTS.md` first.

## Shape modules around responsibilities

- Use named exports. Allow a default export only when a tool config requires it.
- Give each file one reason to change and a specific name (`partition.ts`,
  `gateway-service.ts`), never a `utils.ts`/`helpers.ts` dumping ground.
- Split a feature into resource folders once it owns multiple resources. Keep
  tests and private support code beside the responsibility they cover.

```text
orders/
├── errors.ts
├── service.ts
├── service.test.ts
└── index.ts
```

## Keep entry points declarative

Use `index.ts` for named re-exports or declarative composition only:

```ts
export { createOrdersService } from "./service.js";
export type { OrdersError } from "./errors.js";
```

Move branching, loops, I/O, side effects, and business logic into named files.
Declare a library's public subpaths in `package.json#exports`; do not create a
barrel that exposes every internal module.

## Preserve readable code and boundaries

- Use `function` declarations for top-level functions and React components;
  use arrows for callbacks and inline expressions.
- Prefer small autonomous libraries with explicit runtime/layer direction.
  Never hide ownership in catch-all `shared` or `utils` packages.
- Before adding a helper, search the repository and its shared packages for an
  existing equivalent. Reuse the established abstraction and import path.
