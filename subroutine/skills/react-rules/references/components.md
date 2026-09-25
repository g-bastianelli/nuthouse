# Component ownership and composition

Read this before creating, splitting, moving, or composing React components, or
rendering a collection.

## Make the file tree express the render tree

- Keep a leaf component in one file.
- When it gains private children or support code, turn it into a folder whose
  `index.tsx` exports the parent and composes layout.
- Put code shared by siblings at their lowest common ancestor.
- Colocate private hooks and types with their owner.
- Treat siblings that play the same role the same way: if one submenu of a menu
  has its own file, every submenu does.
- Keep nesting shallow; deep nesting makes code painful to read. When each level
  has a single child component, use flat sibling files instead of a folder per
  level. Never create a folder that holds a single file.

```text
MembersTable/
├── index.tsx
└── MemberRow/
    ├── index.tsx
    ├── RoleBadge.tsx
    ├── RowActions.tsx
    └── useMember.ts
```

A hierarchy rendered level by level stays flat:

```text
LocationSubmenu/
├── index.tsx          # maps areas → <AreaItem areaId />
├── AreaItem.tsx       # maps its work centers → <WorkCenterItem workCenterId />
├── WorkCenterItem.tsx # maps its units → <UnitItem unitId />
└── UnitItem.tsx
```

After structural edits, follow `subroutine:code-organisation` and its folder
shape checkpoint.

## Pass identity, not snapshots

The component that owns a collection maps it and renders one child per item. A
component never contains a `.map` inside another `.map`: each repeated level
becomes a child component. A domain component does not receive an array only to
iterate over it.

Pass the child an ID when it can find its item cheaply in the cache, through a
selector hook over an already loaded query. Otherwise pass the item itself,
never the list. Rows assembled from the pages of an infinite query have no
per-ID cache entry: 5,000 children each looking up their row would run 5,000
linear searches.

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
