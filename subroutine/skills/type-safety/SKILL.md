---
name: type-safety
description: Type-safety discipline for all TypeScript work — no `any`/`as`/`!`, string-literal unions over enums, exhaustive matching. Applies whenever editing or creating TypeScript files.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — type-safety discipline

Applies to every TypeScript file touched, React or Hono, front or back. The
collar. The repo's own `AGENTS.md` overrides this file when it states something
stricter or different — read it first. Otherwise, this is the discipline.

## Non-negotiable

- **No `any`.** Use `unknown` + narrowing. If a third-party type is `any`, wrap
  it and narrow at the boundary.
- **No `as T` assertions.** Use type guards, discriminated unions, or schema
  parsing (`Schema.parse`) to _prove_ the type instead of asserting it.
- **No `!` non-null assertions.** Use optional chaining, explicit null checks, or
  a local narrowed variable.
- These three are typically enforced by the linter (oxlint/eslint). Treat a lint
  error here as a design smell, not a nuisance to silence.

## Inference & annotation

- **Maximize inference.** Annotate only at public API boundaries (exported
  function signatures, lib entry points). Let internal code infer.
- Prefer `as const` for literal types and value sets.

## Unions & value sets

- **String literal unions over `enum`. Never use TS `enum`.**
  ```ts
  type Role = "platform_admin" | "admin" | "operator"; // ✓
  ```
- For a named, symbol-accessible value set, prefer an **object-as-const** over an
  array-as-const (safer renames, IDE symbol access):
  ```ts
  export const DEPLOY_STATUS = { idle: "idle", running: "running" } as const; // ✓
  type DeployStatus = (typeof DEPLOY_STATUS)[keyof typeof DEPLOY_STATUS];
  ```
- **Discriminated unions with >2 variants → `ts-pattern` `.match().exhaustive()`.**
  The `.exhaustive()` makes a missing variant a _compile_ error, not a runtime
  surprise. Tie off every union this way.

## Database value sets

- Never use Postgres `ENUM` / Drizzle `pgEnum`. Model as
  `text('col').$type<'a' | 'b'>()` and validate with Zod at the boundary —
  `ALTER TYPE` is painful and irreversible-ish. (Applies when the repo uses
  Drizzle/Postgres; skip otherwise.)
