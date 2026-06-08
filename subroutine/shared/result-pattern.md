# subroutine — Result / error contract

How success and failure travel through the code. Domain/business logic **returns
errors, never throws them**; the throw happens once, at the transport boundary.
The repo's own `AGENTS.md` wins if it defines a different shape — read it first.

## The Result type

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

If the repo already exports a `Result`/`ok`/`err` (e.g. from a shared types
package), **use the repo's** — never redeclare it.

## Where each layer lives

1. **Domain / service layer** — framework-pure (no HTTP, no router imports).
   Returns `Promise<Result<T, ResourceError>>`. Propagates failures by returning
   the `err(...)`, never by throwing a business error.
   ```ts
   async function listGateways(): Promise<Result<Gateway[], GatewaysError>> {
     const resolved = resolveTenantDb();
     if (!resolved.ok) return resolved; // propagate, don't throw
     return ok(await resolved.value.query.gateways.findMany());
   }
   ```
2. **Error type** — a **discriminated union per resource**, `code` + variant
   fields:
   ```ts
   type GatewaysError =
     | { code: "NOT_FOUND"; resource: "tenant" | "gateway" }
     | { code: "VALIDATION"; field: string; reason: string }
     | { code: "CONFLICT"; reason: string };
   ```
3. **Unwrap at the boundary** — one place translates `Result.error` to a
   transport error and throws it, via `ts-pattern` `.exhaustive()` so a new error
   variant can't be forgotten:
   ```ts
   function unwrap<T>(result: Result<T, GatewaysError>): T {
     if (result.ok) return result.value;
     return match(result.error)
       .with({ code: "NOT_FOUND" }, (e) => {
         throw new XError("NOT_FOUND", e);
       })
       .with({ code: "VALIDATION" }, (e) => {
         throw new XError("BAD_REQUEST", e);
       })
       .with({ code: "CONFLICT" }, (e) => {
         throw new XError("CONFLICT", e);
       })
       .exhaustive();
   }
   ```
4. **Handler** — thin: call the service, `unwrap` the result, return the value.
   Let the unwrap's throw bubble to the framework's global error handler.

## The discipline

- A new error variant moves **three files together**: the error union, the
  unwrap mapping (`.exhaustive()` forces it), and the transport contract's
  declared error codes. Drift is caught at compile time.
- Never `try/catch` a business outcome — model it as a `Result` variant.
- Infrastructure failures (DB down, S3 timeout) may throw and be caught by the
  global handler as a 500 — they are not domain errors.
