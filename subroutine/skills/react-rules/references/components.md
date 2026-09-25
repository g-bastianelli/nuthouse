# Component ownership and composition

Read this before creating, splitting, moving, or composing React components,
rendering a collection, or branching on a union.

## Contents

- Make the file tree express the render tree
- Pass identity, not snapshots
- Branch on a union in one place

## Make the file tree express the render tree

- Keep a leaf component in one file.
- When it gains private children or support code, turn it into a folder whose
  `index.tsx` exports the parent and composes layout, even for a single child.
- Move a component or hook shared by children up to their parent's folder, the
  lowest common ancestor. When distant branches share it (different features or
  apps), move it into the existing library that fits its domain instead of
  hoisting it to a far ancestor. If none fits, propose a new library and create
  it only after the user agrees.
- Colocate private hooks and types with their owner.
- Treat siblings that play the same role the same way: if one submenu of a menu
  has its own file, every submenu does. Same shape means each has its own file;
  a sibling without private children stays a file, not a one-file folder.
- Never create a folder that holds a single file.

```text
MembersTable/
├── index.tsx
└── MemberRow/
    ├── index.tsx
    ├── RoleBadge.tsx
    ├── RowActions.tsx
    └── useMember.ts
```

A hierarchy rendered level by level nests one owner folder per level; the last
level stays a file:

```text
LocationSubmenu/
├── index.tsx              # maps areas → <AreaItem areaId />
└── AreaItem/
    ├── index.tsx          # maps its work centers → <WorkCenterItem workCenterId />
    └── WorkCenterItem/
        ├── index.tsx      # maps its units → <UnitItem unitId />
        └── UnitItem.tsx
```

A component shared by two children sits in their parent's folder; one shared
by distant features moves into a library:

```text
apps/admin/src/MembersTable/
├── index.tsx
├── StatusBadge.tsx        # rendered by MemberRow and InviteRow
├── MemberRow/
│   ├── index.tsx
│   └── RowActions.tsx
└── InviteRow/
    ├── index.tsx
    └── ResendButton.tsx

apps/admin/src/MembersTable/MemberRow/index.tsx  # renders <Avatar />
apps/portal/src/ProfileCard/index.tsx            # renders <Avatar />
libs/ui/src/Avatar.tsx                           # moved to the existing lib
```

After structural edits, follow `subroutine:code-organisation` and its folder
shape checkpoint.

## Pass identity, not snapshots

Prefer IDs and display primitives over domain objects across component
boundaries. The component that owns a collection maps it and renders one child
per item. Rendered JSX never contains a `.map` inside another `.map`: each
repeated level becomes a child component. Transforming data with nested `.map`
outside JSX is fine. A domain component does not receive an array only to
iterate over it.

Pass the child an ID when it can find its item cheaply: a per-ID query, a cache
keyed by ID, or a small loaded list. Otherwise pass the item itself, never the
list. A large unkeyed list is not cheap, whether it comes from a plain query or
from the pages of an infinite query: 5,000 children each looking up their row
would run 5,000 linear searches.

Exceptions that legitimately take an array: generic design-system components
(`Select`, `Combobox`, `Table`), virtualized lists that need the array to compute
what they display, and constant lists such as enum options.

The child owns its loading and empty behavior, and returns `null` when it has
nothing to render.

When siblings need the same entity, share a colocated selector hook over the
same query/cache rather than threading an object through the tree. Keep
selectors subscribed to cache updates; a one-time cache read is not a reactive
replacement for a query hook.

Keep UI encodings in the leaf that needs them. A radio group that needs string
values for "none" and "mixed" defines them locally; its parent passes typed
domain values, where `null` and `undefined` already say "none" and "mixed".

## Branch on a union in one place

When a component renders a discriminated union (a load status, a derived view
state, a lifecycle), the component that owns it matches it once, exhaustively,
as `subroutine:type-safety` requires. Do not scatter `view.kind === "x" &&`
checks through the JSX, and do not re-test the same discriminant in children.

- An arm, match or ternary, that renders more than a few elements becomes its
  own component and receives the narrowed variant's fields. The dispatch then
  reads as a table of contents.
- When the UI branches on a derived state, the function that derives the state
  returns it as a variant. Do not compute a flag beside the JSX
  (`const isLocked = view.kind === "ready" && !canEdit`) to branch on; add a
  `locked` variant to the derivation, where it is tested with the others.
- A guard inside an arm that can never fail (`if (!view.url) return null`
  where every `ready` view has a URL) signals data missing from the variant:
  make the field required on that variant and delete the guard. When the
  absence is a real state, it is its own variant.

```tsx
type ExportView =
  | { kind: "empty" }
  | { kind: "running"; progress: number }
  | { kind: "ready"; downloadUrl: string; rowCount: number }
  | { kind: "failed"; reason: string };

export function ExportPanel({ exportId }: Props) {
  const view = deriveExportView(useExport(exportId));

  return match(view)
    .with({ kind: "empty" }, () => <EmptyExport />)
    .with({ kind: "running" }, ({ progress }) => <Progress value={progress} />)
    .with({ kind: "ready" }, ({ downloadUrl, rowCount }) => (
      <ReadyExport downloadUrl={downloadUrl} rowCount={rowCount} />
    ))
    .with({ kind: "failed" }, ({ reason }) => <ExportError reason={reason} />)
    .exhaustive();
}
```
