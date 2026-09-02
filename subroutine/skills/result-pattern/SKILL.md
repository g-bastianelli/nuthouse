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
export type OrdersError =
  | { code: "NOT_FOUND"; orderId: string }
  | { code: "CONFLICT"; reason: "duplicate-reference" };

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
- Propagate a failed dependency result immediately; do not unwrap and rewrap it.
- Keep domain code free of Hono/RPC/HTTP imports.

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
export function unwrap<T>(result: Result<T, OrdersError>): T {
  if (result.ok) return result.value;
  return match(result.error)
    .with({ code: "NOT_FOUND" }, (e) => {
      throw new TransportError("NOT_FOUND", { orderId: e.orderId });
    })
    .with({ code: "CONFLICT" }, (e) => {
      throw new TransportError("CONFLICT", { reason: e.reason });
    })
    .exhaustive();
}
```

A new error variant moves three artifacts together: the error union, this
unwrap mapping, and the transport contract's declared error codes.
