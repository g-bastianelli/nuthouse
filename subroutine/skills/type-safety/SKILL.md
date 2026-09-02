---
name: type-safety
genre: contract
description: Type-safety discipline for all TypeScript work — prove unknown values, avoid any/as/non-null assertions, prefer inference and exhaustive unions. Applies whenever editing or creating TypeScript files.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — type-safety discipline

Apply this to every TypeScript file. Read the nearest `AGENTS.md` first; the
repo wins when it defines a stricter or different convention.

## Prove types; do not silence the checker

- Never use `any`, `as T`, or non-null `!`. Narrow `unknown`, parse structured
  external data with the repo's schema library, and handle absence explicitly.
- Do not add lint disables to bypass these rules. A difficult type usually
  exposes a missing boundary or an imprecise model.
- `as const` is allowed for literals. Use `satisfies` when checking an object's
  shape without widening its inferred values.

```ts
const config = {
  mode: "strict",
  retries: 3,
} satisfies WorkerConfig;

const first = rows[0];
if (!first) return err({ code: "NOT_FOUND" });
return ok(first);
```

## Let inference work

- Annotate exported API signatures and intentional boundaries; let local
  variables and callbacks infer.
- Derive types from their source (`z.infer`, `Awaited<ReturnType<...>>`, indexed
  access) instead of redeclaring the same shape.

## Model finite states explicitly

- Prefer string-literal unions to TypeScript `enum`.
- Expose named value sets as object-as-const when callers need symbolic access.
- Match discriminated unions with more than two variants using `ts-pattern`
  `.exhaustive()`.

```ts
export const JOB_STATUS = {
  idle: "idle",
  running: "running",
  failed: "failed",
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

const label = match(status)
  .with("idle", () => "Idle")
  .with("running", () => "Running")
  .with("failed", () => "Failed")
  .exhaustive();
```

When using Drizzle/Postgres, prefer a typed text column plus boundary validation
to `pgEnum`; database enum migrations make removal and renaming unnecessarily
rigid. Skip this rule when the repository deliberately standardizes otherwise.
