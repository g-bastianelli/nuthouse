---
name: react-rules
description: React implementation discipline — one component per file, folders mirror JSX ownership, children receive stable IDs/primitives, state lives at the highest durable layer, and styling ownership stays explicit.
user-invocable: false
paths: ["**/*.tsx", "**/use*.ts", "**/hooks/**/*.ts"]
---

# subroutine — React discipline

Apply this to React components and hooks. Read the scoped `AGENTS.md` first for
the router, data layer, form library, design system, i18n, and testing policy.

## Make the file tree express the render tree

- Define exactly one React component per file using a named `function`.
- A leaf is one file. When it gains children/support code, turn it into a folder
  whose `index.tsx` exports the parent and only composes layout.
- Put shared-by-siblings code at their lowest common ancestor. Keep nesting
  shallow and colocate private hooks/types with their owner.

```text
MembersTable/
├── index.tsx          # renders MemberRow; layout only
├── MemberRow.tsx      # renders RoleBadge and RowActions
├── RoleBadge.tsx
├── RowActions.tsx
└── useMember.ts
```

## Pass identity; let children own their data

Prefer IDs and primitives over domain objects. A child selects what it needs
from the repository's cached data layer, owns its loading/empty behavior, and
returns `null` when it has nothing to render.

```tsx
type Props = { memberId: string; className?: string };

export function MemberRow({ memberId, className }: Props) {
  const member = useMember(memberId);
  if (!member) return null;
  return <li className={cn("flex items-center", className)}>{member.email}</li>;
}
```

When siblings need the same entity, share a colocated selector hook over the
same query/cache rather than threading the object through the tree. Route-aware
code owns URL reads/writes and passes values plus callbacks into route-agnostic
libraries. Keep selectors subscribed to cache updates; do not replace a query
hook with a one-time cache snapshot.

## Put state at the highest durable layer

1. Server state → query/data library; never mirror fetched data in `useState`.
2. Shareable/refresh-persistent view state → typed URL search params.
3. Low-frequency session/DI → one-purpose Context plus a dedicated hook.
4. Ephemeral unsaved UI → local `useState`.

Avoid `useEffect` for data fetching. If an effect is truly synchronizing with
an external system, keep dependencies complete and comment the reason.

## Keep styling and accessibility owned

- Parent owns placement (grid/flex, gap, width, margin); child owns its root,
  typography, color, border, and internal padding.
- Accept `className` and merge it onto the root. Prefer design-system components
  and tokens over raw controls and magic values.
- Switch variants at the call site with `clsx`/`cn` conditionals; do not create
  top-level class lookup registries.
- Associate labels and controls with stable unique IDs and preserve keyboard,
  focus, and semantic behavior supplied by the design system.

If React Compiler is enabled, do not add `useMemo`, `useCallback`, or
`React.memo`; otherwise add memoization only after measuring a real need. Follow
the repository's test policy—do not invent component tests in a codebase that
deliberately tests only extracted pure logic.
