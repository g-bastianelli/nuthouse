---
name: react-rules
genre: contract
description: React implementation discipline for component ownership, stable props, durable state, styling boundaries, accessibility, and measured optimization.
user-invocable: false
paths: ["**/*.tsx", "**/use*.ts", "**/hooks/**/*.ts"]
---

# subroutine — React discipline

Read the scoped `AGENTS.md` first; its routing, data, form, design-system, i18n,
and test choices win.

## Rules that apply every time

1. One named component per file; folders mirror JSX ownership. Same-role
   siblings each get a file; a childless one stays a file.
2. Pass IDs and primitives, not domain objects; the child selects its data from
   the shared cache. For a collection, the owner renders one child per item;
   pass the item when an ID lookup is not cheap (large unkeyed list). Never pass
   the list, except to design-system, virtualized, or constant-list components.
3. In rendered JSX, never nest a `.map` inside a `.map`; each repeated level is
   a child component.
4. Match a discriminated union once, exhaustively. An arm rendering more than a
   few elements is a component; the derivation returns every state the UI
   branches on; a guard that cannot fail means the variant lacks that field.
5. Keep UI encodings such as radio sentinels in the leaf; parents pass typed
   domain values (`null`/`undefined` already mean none/mixed).
6. Put state at its highest durable owner: server cache, typed URL, focused
   Context, then local state.
7. Never mirror fetched data in `useState` or fetch it from `useEffect`.
8. The parent owns placement, the child its visual root; merge a caller's
   `className` onto that root. No `<br>` for layout.
9. Prefer design-system components and tokens to raw controls and magic values.
10. Preserve semantic markup, labels, keyboard behavior, and visible focus.
11. Memoize only for a measured need, never when React Compiler owns it.
12. Follow the repo's test policy; add no component tests where it tests only
    extracted pure logic.
13. After creating, moving, or deleting TypeScript files, run the structural
    checkpoint of `subroutine:code-organisation`.

## Read the matching reference before editing

- Composing, splitting, or moving components, rendering a collection, or
  branching on a union: [`references/components.md`](references/components.md).
- Selectors, fetching, mutations, URL state, Context, or local state:
  [`references/state-and-data.md`](references/state-and-data.md).
- Layout, variants, controls, or interaction behavior:
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
