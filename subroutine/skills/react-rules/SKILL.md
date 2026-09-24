---
name: react-rules
genre: contract
description: React implementation discipline — one component per file, folders mirror JSX ownership, shallow nesting where each mapped element is a child receiving an ID or the element, state at the highest durable layer, explicit styling ownership.
user-invocable: false
paths: ["**/*.tsx", "**/use*.ts", "**/hooks/**/*.ts"]
---

# subroutine — React discipline

The scoped `AGENTS.md` wins on router, data, forms, design system, i18n, tests.

## Make the file tree express the render tree

- One React component per file.
- A leaf is one file; once it gains children or support code, it becomes a
  folder whose `index.tsx` exports the parent and only composes layout.
- Keep nesting shallow: no `.map` inside a `.map`; each repeated level becomes
  a child. When each level has one child, use flat sibling files, never a
  one-file folder.
- Siblings with one role share one shape: if one submenu has its own file, all do.
- Sibling-shared code sits at the lowest common ancestor; private hooks/types
  with their owner.

After structural edits, follow `code-organisation`’s checkpoint.

## Pass identity; let children own their data

The array's owner maps it, one child per element; a domain component never
takes an array just to iterate it. Pass an ID when the child can select its
element cheaply (a selector hook over a loaded query), else the element, never
the list: infinite-query rows have no per-ID cache entry, so 5 000 lookups are
5 000 linear scans. Exempt: design-system components (Select, Combobox, Table),
virtualized lists, constant lists (enum options).

```tsx
type Props = { memberId: string; className?: string };

export function MemberRow({ memberId, className }: Props) {
  const member = useMember(memberId);
  if (!member) return null;
  return <li className={cn("flex", className)}>{member.email}</li>;
}
```

A child owns its loading/empty state and returns `null` when empty. UI
encodings (radio sentinels) stay in the leaf; the parent passes typed domain
values (`null`/`undefined` already say none/mixed). Siblings needing one entity
share a colocated selector hook subscribed to updates, never a snapshot.
Route-aware code owns the URL; route-agnostic libraries get values and
callbacks.

## Put state at the highest durable layer

1. Server state → query/data library; never mirror fetched data in `useState`.
2. Shareable/refresh-persistent view state → typed URL search params.
3. Low-frequency session/DI → one-purpose Context plus a dedicated hook.
4. Ephemeral unsaved UI → local `useState`.

No `useEffect` for fetching; an effect syncing an external system keeps
complete dependencies and comments why.

## Keep styling and accessibility owned

- Parent owns placement (grid/flex, gap, width, margin); child owns its root,
  typography, color, border, and internal padding.
- Merge an accepted `className` onto the root; prefer design-system components
  and tokens over raw controls and magic values.
- Switch variants at the call site with `cn`, not class registries.
- Tie labels to controls with stable unique IDs; keep design-system keyboard,
  focus, and semantics.

With React Compiler, add no `useMemo`/`useCallback`/`React.memo`; otherwise
memoize only after measuring a real need.
