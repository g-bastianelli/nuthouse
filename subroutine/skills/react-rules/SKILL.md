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
   Siblings in the same role get the same shape: if one has its file, all do.
2. Never nest a `.map` inside a `.map`: the owner of a collection maps it and
   renders one child per item. Pass an ID the child can select cheaply from
   loaded cache, else the item, never the list (design-system, virtualized,
   and constant lists excepted).
3. Keep UI encodings such as radio sentinels in the leaf; parents pass typed
   domain values (`null`/`undefined` already mean none/mixed).
4. Put state at its highest durable owner: server cache, typed URL, focused
   Context, then local state.
5. Never mirror fetched data in `useState` or fetch it from `useEffect`.
6. Let the parent own placement and the child own its visual root; merge a
   caller-provided `className` onto that root.
7. Prefer repository design-system components and tokens to raw controls and
   magic values.
8. Preserve semantic markup, labels, keyboard behavior, and visible focus.
9. Add memoization only for a measured need, and never when React Compiler owns
   it.
10. Follow the repository's test policy; do not invent component tests where
    it deliberately tests extracted pure logic only.
11. After creating, moving, or deleting TypeScript files, run the structural
    checkpoint required by `subroutine:code-organisation`.

## Read the relevant reference before changing code

- Creating, splitting, moving, or composing components, or rendering a
  collection: read [`references/components.md`](references/components.md).
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
