# subroutine — code-organisation contract

How files, exports, and modules are shaped. The repo's `AGENTS.md` wins on any
specific — read it first.

## Exports

- **Named exports only.** No default exports (exception: tool config files that
  require them — `vite.config.ts`, `drizzle.config.ts`).
- A library's public API is declared via `package.json#exports`, **not** a barrel
  `index.ts` that re-exports everything.

## `index.ts` is a boundary, not a home for logic

- Allowed in `index.ts`: named re-exports, declarative composition
  (`export const router = oc.router({...})`).
- **Forbidden** in `index.ts`: `if`/`switch`/`try`/`for`, I/O, side effects on
  module load, business logic. If you're writing logic there, it belongs in a
  named file.

## Files

- **One file, one responsibility.** Name files after what they contain
  (`partition.ts`, `gateway-service.ts`) — never `utils.ts` / `helpers.ts` /
  `misc.ts` dumping grounds.
- Under a feature/domain folder, split into one subfolder per resource as soon as
  there are ≥2 resources — not one dense file.

## Functions

- **Top-level functions**: `function` declarations (readable stack traces,
  hoisting).
- **Callbacks / inline expressions**: arrow functions.
- **React components**: named `function` declarations.

## Libraries (monorepo)

- Many small, autonomous libs each covering one precise concern — never a
  catch-all `libs/utils` or `libs/shared` dumping ground.
- Respect runtime/layer boundaries the repo declares (e.g. `frontend ↛ backend`,
  `shared` stays agnostic). In a moon repo these are often enforced by tags and
  fail the build if violated.

## Reuse before writing

- Before writing any helper, grep the repo's shared libs for an existing
  equivalent. Never reimplement what a shared package already exports.
