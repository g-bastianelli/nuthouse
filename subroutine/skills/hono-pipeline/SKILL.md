---
name: hono-pipeline
genre: contract
description: Implementation discipline for Hono with a typed RPC/contract stack — discover local conventions, then move contract → resource error → pure service Result → exhaustive unwrap → thin router → wiring.
user-invocable: false
paths: ["**/*.ts"]
---

# subroutine — Hono pipeline discipline

Apply this only to Hono backend/contracts/domain code. First read the scoped
`AGENTS.md` and one complete neighboring resource; reuse its stack and commands.

## Implement the whole vertical slice

1. **Contract** — input/output schemas plus every transport error code.
2. **Resource error** — discriminated variants for expected failures.
3. **Service** — framework-pure `Promise<Result<T, ResourceError>>`; pass
   tenant/auth values explicitly.
4. **Unwrap** — exhaustive translation to framework errors.
5. **Router** — contract validation → service → unwrap → return.
6. **Wiring** — mount a new resource/domain only; an existing router is wired.

```ts
// contract.ts
export const ordersContract = oc.router({
  get: oc
    .route({ method: "GET", path: "/orders/{id}" })
    .input(z.object({ id: z.uuid() }))
    .output(OrderSchema)
    .errors({ NOT_FOUND: { data: z.object({ orderId: z.uuid() }) } }),
});

// errors.ts + service.ts
export type OrdersError = { code: "NOT_FOUND"; orderId: string };
export function createOrdersService(tenantId: string) {
  return {
    async get(id: string): Promise<Result<Order, OrdersError>> {
      const order = await findOrder(tenantId, id);
      return order ? ok(order) : err({ code: "NOT_FOUND", orderId: id });
    },
  };
}

// _unwrap.ts + router.ts
export const ordersRouter = {
  get: os.orders.get.handler(async ({ input, context }) =>
    unwrap(await createOrdersService(context.tenantId).get(input.id)),
  ),
};
```

The omitted `unwrap` follows `result-pattern`; its payload must match the
contract's `.errors()` schema exactly.

## Preserve layer boundaries

- Keep Hono/RPC/HTTP imports out of domain/service code.
- Read auth/session at the edge; pass only required values into services.
- Prefer resource subpath imports; broad barrels can load a whole context.
- Follow the repo's persistence slices. Do not add a generic repository layer;
  isolate a store only for a complex transactional aggregate.
- Keep token/session acquisition, webhooks, and health probes as plain Hono
  routes when they sit outside the authenticated RPC pipeline.

## Verify the chain

- Test service behavior and every expected error. Test serialization/auth at the
  router edge only when repo policy permits it.
- Typecheck contract, domain, and API together. Exhaustiveness catches
  union/unwrap drift; explicitly compare unwrap codes with contract errors.
