---
name: react-rules
genre: contract
description: React implementation discipline for component ownership, stable props, durable state, styling boundaries, accessibility, and measured optimization.
user-invocable: false
paths: ["**/*.tsx", "**/use*.ts", "**/hooks/**/*.ts"]
---

# subroutine — React discipline

Apply these rules to React components and hooks. Read the scoped `AGENTS.md`
first: repository choices for routing, data, forms, design systems, i18n, and
tests take precedence.

## Rules that apply every time

1. Define one named React component per file; let folders mirror JSX ownership.
2. Pass stable IDs and primitives across component boundaries, not whole domain
   objects. The child selects the data it renders from the shared cache.
3. Put state at its highest durable owner: server cache, typed URL, focused
   Context, then local state.
4. Never mirror fetched data in `useState` or fetch it from `useEffect`.
5. Let the parent own placement and the child own its visual root; merge a
   caller-provided `className` onto that root.
6. Prefer repository design-system components and tokens to raw controls and
   magic values.
7. Preserve semantic markup, labels, keyboard behavior, and visible focus.
8. Add memoization only for a measured need, and never when React Compiler owns
   it.
9. Follow the repository's test policy; do not invent component tests where it
   deliberately tests extracted pure logic only.
10. After creating, moving, or deleting TypeScript files, run the structural
    checkpoint required by `subroutine:code-organisation`.

## Read the relevant reference before changing code

- Creating, splitting, moving, or composing components: read
  [`references/components.md`](references/components.md).
- Adding selectors, fetching, URL state, Context, or local state: read
  [`references/state-and-data.md`](references/state-and-data.md).
- Changing layout, variants, controls, or interaction behavior: read
  [`references/styling-and-accessibility.md`](references/styling-and-accessibility.md).

## Compliant example

```tsx
type Props = { memberId: string; className?: string };

export function MemberRow({ memberId, className }: Props) {
  const member = useMember(memberId);
  if (!member) return null;

  return <li className={cn("flex items-center", className)}>{member.email}</li>;
}
```

The prop carries identity, the child owns its selection and empty state, and
the caller can place the component without taking over its internals.
