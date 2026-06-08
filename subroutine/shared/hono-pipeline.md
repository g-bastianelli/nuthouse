# subroutine — Hono pipeline contract

The backend discipline (back-of-stack), for a Hono + typed-RPC monorepo. Builds
on `result-pattern.md`, `validation.md`, and `type-safety.md`. The repo's
`apps/*/api/AGENTS.md` wins on exact paths, RPC lib, and auth — read it first;
this is the layered pipeline that holds.

## The layers (a new procedure moves through all of them, in order)

1. **Contract** — the typed input/output schema (Zod) + declared error codes,
   in the contracts package. Single source of truth for the wire shape.
2. **Error union** — a discriminated `{Resource}Error` (`code` + variant fields)
   in the domain lib. See `result-pattern.md`.
3. **Service** — framework-pure domain logic in the domain lib. Returns
   `Promise<Result<T, {Resource}Error>>`. **No `hono` / RPC / HTTP imports.**
   Threads `tenantId` / auth context explicitly through its signature — no
   implicit globals, no DI container.
4. **Unwrap** — one `_unwrap.ts` per resource translates `Result.error` to the
   transport error via `ts-pattern` `.match().exhaustive()` and throws it.
5. **Router/handler** — thin Hono/RPC handler: validate input (contract schema),
   call the service, `unwrap` the result, return the value. No business logic.
6. **Wiring** — mount the new resource/router in the app entry only when adding a
   new resource folder; an existing resource needs no wiring edit.

## Domain libs stay pure

- No `hono`, RPC-server, or HTTP imports in domain/service code.
- Subpath exports per resource via `package.json#exports`.
- DB access via the repo's tenant-scoped accessor; map driver errors (unique /
  FK violations) to error-union variants, don't leak raw DB errors.

## Auth / context

- Auth context (`user`, `tenantId`) is read at the edge (middleware) and **passed
  explicitly** into service calls. Keep signatures honest.
- Token-acquisition / session routes that must run _before_ auth are plain Hono
  routes, not RPC procedures — check the repo's convention for where they live.

## The discipline

- Business outcomes are `Result` variants, never thrown. Only the unwrap (and
  infra failures) throw.
- A new error variant updates **contract `.errors()` + error union + unwrap
  mapping** together; `.exhaustive()` makes a forgotten mapping a compile error.
- Validate at the boundary with the contract's Zod schema; downstream code trusts
  the parsed type.
