---
name: result-pattern
genre: contract
description: Result/error discipline for backend domain and service code — expected outcomes return Result variants, infrastructure failures stay exceptional, and one exhaustive unwrap translates at the transport edge.
user-invocable: false
paths: ["**/*.ts"]
---

# subroutine — Result / error discipline

Backend domain/services and transport handlers only. Reuse the repository's
`Result` helpers and error taxonomy; the nearest `AGENTS.md` wins.

## Separate expected outcomes from exceptions

- Return `Result<T, ResourceError>` for expected business outcomes (not found,
  forbidden, validation, conflict); never throw or catch those as exceptions.
- Let unexpected infrastructure/programmer failures throw to the global error
  handler; map only a recognized driver failure to a declared variant and
  rethrow anything else.

## Keep errors local and propagation explicit

- One discriminated error union per resource/slice: `code` plus only the fields
  needed to explain or translate the variant; each field keeps one meaning
  (`field` names a form input; a named entity gets its own carrier,
  `dataSource: { id, name }`).
- A refusal's `reason` is a union of literals, never `string`, so a new reason
  breaks the build until its copy exists. The literals live in a leaf module of
  the contract package and reach domain code via `import type`, its only
  contract-side import. One `CONFLICT` per resource unless reason sets or client
  reactions differ.
- Propagate a failed dependency result as-is: `if (!r.ok) return r;`.

## Unwrap once at the transport boundary

When adding or changing a transport handler, read
[`references/transport-unwrapping.md`](references/transport-unwrapping.md). Domain-only
work does not need the framework translation details.
