---
name: validation
description: Validation discipline for TypeScript — one schema source of truth, parse data once at each trust boundary, and derive static types from schemas. Applies whenever editing or creating TypeScript files.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — validation discipline

Use the repository's validation library; default to Zod when none is specified.
The nearest `AGENTS.md` wins.

## One boundary, one parse

- Declare HTTP/RPC body, query, and path schemas in the route or contract.
- Parse third-party responses, decoded tokens, environment input, and file
  contents immediately after reading them. Do not pass raw `unknown` deeper.
- Use `parse` when invalid data violates a boundary invariant. Use `safeParse`
  when invalid input is an expected outcome that must become a typed error.

```ts
export const ProfileSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
});
export type Profile = z.infer<typeof ProfileSchema>;

export async function fetchProfile(response: Response): Promise<Profile> {
  const raw: unknown = await response.json();
  return ProfileSchema.parse(raw);
}
```

## Keep one source of truth

- Infer types with `z.infer<typeof Schema>`; never maintain a parallel
  hand-written interface for the same shape.
- Reuse the parsed value downstream; do not revalidate inside the service.
- Move a schema to the repository's shared contract/types package only when at
  least two packages consume the same wire shape. Otherwise colocate it.
- Do not replace schema parsing with hand-written property/`typeof` checks for
  structured external data.
