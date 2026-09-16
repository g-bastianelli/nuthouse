---
name: hono-pipeline
genre: contract
description: Implementation discipline for Hono with a typed RPC/contract stack — discover local conventions, then move contract → resource error → pure service Result → exhaustive unwrap → thin router → wiring.
user-invocable: false
paths: ["**/*.ts"]
---

# subroutine — Hono pipeline discipline

Hono backend/contracts/domain code only. Read the scoped `AGENTS.md` and one
complete neighboring resource first; reuse its stack and commands.

## Implement the whole vertical slice

1. **Contract** — input/output schemas plus every error code with an explicit
   `status` and `data` schema; refusal reasons are enums.
2. **Resource error** — discriminated variants for expected failures.
3. **Service** — framework-pure `Promise<Result<T, ResourceError>>`;
   auth/session read at the edge, only required values passed in.
4. **Unwrap** — exhaustive translation to framework errors (`result-pattern`).
5. **Router** — contract validation → service → unwrap → return.
6. **Wiring** — mount new resources only; an existing router is already wired.

```ts
// contracts/orders/reasons.ts — leaf module, no routes, no framework imports
export const conflictReasons = ["duplicate-reference"] as const;
export type ConflictReason = (typeof conflictReasons)[number];

// contract.ts — declare the full error set once on a shared builder so every
// procedure (`base.route().input().output()`) carries every code the shared
// unwrap can throw; a per-route map missing CONFLICT turns that throw into a
// 500.
const base = oc.errors({
  NOT_FOUND: { status: 404, data: z.object({ orderId: z.uuid() }) },
  CONFLICT: { status: 409, data: z.object({ reason: z.enum(conflictReasons) }) },
});

// router.ts — the handler's contract-typed `errors` constructors feed the
// unwrap
export const ordersRouter = {
  get: os.orders.get.handler(async ({ input, context, errors }) =>
    unwrap(await createOrdersService(context.tenantId).get(input.id), errors),
  ),
};
```

## Preserve layer boundaries

- Follow the repo's persistence slices: no generic repository layer, a dedicated
  store only for a complex transactional aggregate.
- Token/session acquisition, webhooks, and health probes stay plain Hono routes
  outside the authenticated RPC pipeline.

## Verify the chain

Test service behavior and every expected error; test serialization/auth at the
router edge only when repo policy permits. Typecheck contract, domain, and API
together.
