---
name: react-rules
genre: contract
description: React implementation discipline for composition, component ownership, stable props, durable state, styling boundaries, accessibility, and measured optimization.
user-invocable: false
paths:
  - "**/*.tsx"
  - "**/use{-,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}*.ts"
  - "**/hooks/**/*.ts"
---

# subroutine — React discipline

Read scoped `AGENTS.md` first; its routing, data, forms, design system, i18n,
and tests take precedence.

## Rules that apply every time

1. Prefer composition for React UI (tables, menus, selects, dialogs, tabs, etc.):
   use `children` or slots over configuration props and feature flags.
2. One named component per file; folders mirror JSX ownership. Same-role
   siblings each get a file; a childless one stays a file.
3. Pass IDs and primitives, not domain objects; children select from the shared
   cache. Collection owners render one child per item; pass the item if ID
   lookup is costly (large unkeyed lists). Lists only go to design-system,
   virtualized, or constant-list components.
4. In rendered JSX, never nest a `.map` inside a `.map`; each repeated level is
   a child component.
5. Match a discriminated union once, exhaustively. An arm rendering more than a
   few elements is a component; the derivation returns every state the UI
   branches on; a guard that cannot fail means the variant lacks that field.
6. Keep UI encodings such as radio sentinels in the leaf; parents pass typed
   domain values (`null`/`undefined` already mean none/mixed).
7. Put state at its highest durable owner: server cache, typed URL, focused
   Context, then local state.
8. Never mirror fetched data in `useState` or fetch it from `useEffect`.
9. The parent owns placement, the child its visual root; merge a caller's
   `className` onto that root. No `<br>` for layout.
10. Prefer design-system components and tokens to raw controls and magic values.
11. Preserve semantic markup, labels, keyboard behavior, and visible focus.
12. Memoize only for a measured need, never when React Compiler owns it.
13. Follow the repo's test policy; add no component tests where it tests only
    extracted pure logic.
14. After creating, moving, or deleting TypeScript files, run the structural
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
<Menu>
  <MenuTrigger>Actions</MenuTrigger>
  <MenuContent>
    <MenuItem onSelect={archive}>Archive</MenuItem>
  </MenuContent>
</Menu>
```
