# Transport unwrapping

Read this when a transport handler converts a domain `Result` into framework errors.

Use one resource-local function. Exhaustive matching makes a new domain variant fail
compilation until its transport behavior is declared.

```ts
export function unwrap<T>(result: Result<T, OrdersError>, errors: OrdersErrorConstructors): T {
  if (result.ok) return result.value;

  return match(result.error)
    .with({ code: "NOT_FOUND" }, (error) => {
      throw errors.NOT_FOUND({ data: { orderId: error.orderId } });
    })
    .with({ code: "CONFLICT" }, (error) => {
      throw errors.CONFLICT({ data: { reason: error.reason } });
    })
    .exhaustive();
}
```

Type `errors` with the stack's constructor-map type applied to the contract. A handwritten
map can survive a contract rename and fail only at runtime. Let constructors enforce code,
data, and status; never build the framework error by hand or set its status here.
