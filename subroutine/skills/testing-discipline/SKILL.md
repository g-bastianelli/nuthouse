---
name: testing-discipline
genre: contract
description: Testing discipline for TypeScript test files — reproduce regressions first, test observable behavior and typed failures, keep doubles at owned boundaries, and preserve unexpected rejections.
user-invocable: false
paths: ["**/*.test.ts", "**/*.spec.ts", "**/*.test.tsx", "**/*.spec.tsx"]
---

# subroutine — testing discipline

Apply this to TypeScript tests. The nearest `AGENTS.md` decides the runner,
allowed layers, and React test policy.

## Prove behavior

- For a bug, write the smallest regression test and see it fail before the fix.
  Name the behavior, not the implementation.
- Assert public outputs, effects, events, or typed errors. Avoid private tests,
  incidental call counts, and broad snapshots.
- Cover success, every expected `Result` variant introduced by the change, and
  unexpected rejection when propagation is part of the contract.

```ts
test("returns CONFLICT for a duplicate reference", async () => {
  store.insert.mockRejectedValue(uniqueViolation);
  await expect(createOrder({ input, store })).resolves.toEqual(
    err({ code: "CONFLICT", reason: "duplicate-reference" }),
  );
});

test("preserves an unexpected database outage", async () => {
  store.insert.mockRejectedValue(outage);
  await expect(createOrder({ input, store })).rejects.toBe(outage);
});
```

## Keep tests trustworthy

- Inject time, IDs, randomness, and clients only when behavior depends on them.
  Fake an owned port; never mock a query builder or private call chain.
- Keep fixtures minimal and explicit. A fixture default must not hide the field
  the test is meant to exercise.
- Unit-test deterministic logic; integration-test real serialization, database,
  or transport boundaries. Do not simulate integration with a forest of mocks.
- Never add `.test.tsx`, DOM tooling, or component snapshots when repository
  policy tests only extracted pure UI logic.
