# Component ownership and composition

Read this before creating, splitting, moving, or composing React components.

## Make the file tree express the render tree

- Keep a leaf component in one file.
- When it gains private children or support code, turn it into a folder whose
  `index.tsx` exports the parent and composes layout.
- Put code shared by siblings at their lowest common ancestor.
- Colocate private hooks and types with their owner; keep nesting shallow.

```text
MembersTable/
├── index.tsx
└── MemberRow/
    ├── index.tsx
    ├── RoleBadge.tsx
    ├── RowActions.tsx
    └── useMember.ts
```

After structural edits, follow `subroutine:code-organisation` and its folder
shape checkpoint.

## Pass identity, not snapshots

Prefer IDs and display primitives over domain objects. A child selects the
entity it needs from the repository's cached data layer, owns its loading and
empty behavior, and returns `null` when it has nothing to render.

When siblings need the same entity, share a colocated selector hook over the
same query/cache rather than threading an object through the tree. Keep
selectors subscribed to cache updates; a one-time cache read is not a reactive
replacement for a query hook.
