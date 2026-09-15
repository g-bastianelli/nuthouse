---
name: result-pattern
genre: contract
description: Result/error discipline for backend domain and service code — expected outcomes return Result variants, infrastructure failures stay exceptional, and one exhaustive unwrap translates at the transport edge.
user-invocable: false
paths: ["**/*.ts"]
---

# subroutine — Result / error discipline

Apply this to backend domain/services and transport handlers, not frontend code.
Use the repository's existing `Result` helpers and error taxonomy; the nearest
`AGENTS.md` wins.

## Separate expected outcomes from exceptions

- Return `Result<T, ResourceError>` for expected business outcomes: not found,
  forbidden, validation, or conflict.
- Do not throw those outcomes or catch them as exceptions.
- Let unexpected infrastructure/programmer failures throw to the global error
  handler. Catch only when recognizing a specific driver failure and mapping it
  to a declared domain variant; rethrow everything else.

```ts
import type { ConflictReason } from "@app/contracts/orders/reasons";

export type OrdersError =
  | { code: "NOT_FOUND"; orderId: string }
  | { code: "CONFLICT"; reason: ConflictReason };

export async function createOrder(input: CreateOrder): Promise<Result<Order, OrdersError>> {
  try {
    return ok(await insertOrder(input));
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      return err({ code: "CONFLICT", reason: "duplicate-reference" });
    }
    throw cause;
  }
}
```

## Keep errors local and propagation explicit

- Define one discriminated error union per resource/slice, with `code` and only
  the fields required to explain or translate that variant.
- A refusal carries a `reason` typed as a union of literals, never `string`: a
  UI mapper cannot sort prose, and a new reason must break the build until its
  copy is decided. The literals live in a leaf module of the contract package —
  no routes, no framework imports, so nothing cycles back through the domain
  schemas the contract itself pulls in — and reach the domain through an
  `import type`, which erases at build. One `CONFLICT` per resource is the
  default; add a code per refused action only when reason sets or client
  reactions differ.
- Each error field keeps one meaning. A validation variant may carry `field` to
  name the form input to highlight; an entity the refusal names then gets its
  own carrier (`dataSource: { id, name }`), never a second meaning stuffed into
  `field`.
- Propagate a failed dependency result immediately; do not unwrap and rewrap it.
- Keep domain code free of Hono/RPC/HTTP imports; an `import type` of that leaf
  reason module is the one exception.

```ts
const tenant = resolveTenant(tenantId);
if (!tenant.ok) return tenant;
return ok(await listOrders(tenant.value));
```

## Unwrap once at the transport boundary

Translate every domain variant to the framework error in one resource-local
function. Exhaustive matching makes a newly added variant fail compilation
until transport behavior is declared.

```ts
// _unwrap.ts — the transport edge, so typing against the contract belongs here.
export function unwrap<T>(result: Result<T, OrdersError>, errors: OrdersErrorConstructors): T {
  if (result.ok) return result.value;
  return match(result.error)
    .with({ code: "NOT_FOUND" }, (e) => {
      throw errors.NOT_FOUND({ data: { orderId: e.orderId } });
    })
    .with({ code: "CONFLICT" }, (e) => {
      throw errors.CONFLICT({ data: { reason: e.reason } });
    })
    .exhaustive();
}
```

`errors` is the handler's constructor map. Type it with the stack's own
constructor-map type applied to the contract; never hand-write a structural map,
which keeps compiling after a code is renamed in `.errors()` and only fails at
runtime on the first refusal of that kind. The constructors check each code and
its `data` against the contract and carry the status declared there — never
build the framework error by hand, and never set a status in the unwrap.

One unwrap serving a whole resource needs one invariant: the resource declares
its full error set once on a shared contract builder, not per route, so every
handler's map carries every code this `match` can throw. Per-route `.errors()`
gives `get` a map without `CONFLICT`, and the `throw` becomes a 500 instead of
the declared status.

A new error variant moves three artifacts together: the error union, this
unwrap mapping, and the transport contract's declared error codes.
