---
name: validation
description: Validation discipline for all TypeScript work — Zod as the single validation library, parse at trust boundaries, types inferred from schemas. Applies whenever editing or creating TypeScript files.
user-invocable: false
paths: ["**/*.ts", "**/*.tsx"]
---

# subroutine — validation discipline

Applies to every TypeScript file that touches data crossing a trust boundary.
Zod is the single validation library across front, back, and libs. The repo's
`AGENTS.md` wins if it names a different one — read it first.

## Rules

- **HTTP / RPC inputs** (body, query, params): declare the schema inline in the
  route/procedure definition. Validate there, not deep in the service.
- **External data** (third-party API responses, JWT payloads, file contents):
  `Schema.parse(raw)` at the boundary. **Never** hand-roll `typeof` checks for
  data crossing a trust boundary.
- **Types follow schemas**: `type Foo = z.infer<typeof FooSchema>`. Never
  redeclare a type that a schema already describes.
- **Shared schemas** (used by ≥2 packages) live in the repo's shared types
  package, not duplicated.
- **String-literal value sets** pair with the type-safety discipline:
  ```ts
  export const PROTOCOLS = ["opcua", "mqtt", "modbus_tcp"] as const;
  export const ProtocolSchema = z.enum(PROTOCOLS);
  export type Protocol = (typeof PROTOCOLS)[number];
  ```

## The discipline

- Parse, don't validate-then-trust: after `Schema.parse`, the value is typed and
  safe — no casts needed downstream.
- One schema is the source of truth for both the runtime check and the static
  type. If you're writing a type and a schema for the same shape, you've drifted.
