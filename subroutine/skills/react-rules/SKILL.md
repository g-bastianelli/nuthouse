---
name: react-rules
description: React component discipline — one component per file, folder mirrors the JSX tree, IDs-only props, state hierarchy. Applies when working on React components and hooks.
user-invocable: false
paths: ["**/*.tsx", "**/use*.ts", "**/hooks/**/*.ts"]
---

# subroutine — React rules discipline

Applies to React component and hook files (front-of-stack), battle-tested across
React codebases. The repo's `apps/*/AGENTS.md` wins on stack specifics
(router, forms lib, design system, i18n) — read it first; this is the structural
discipline that holds regardless.

## Rule 1 — One component per file

Exactly one React component definition per file. No second "private" component
(`const Row = ...`, `function Header() {}`) in the same file. Non-component
helpers (constants, types, small pure functions) are fine. Need another
component → new sibling file or folder.

## Rule 2 — Folder structure mirrors the JSX tree

If `A` renders `B`, `C`, `D`, then `A/` contains `B`, `C`, `D` as files or
subfolders.

- **Single file** (default): a leaf with no sub-components → `Parent/Name.tsx`.
- **Folder with `index.tsx`**: has sub-components or colocated files
  (`hooks.ts`, `types.ts`) → `Name/index.tsx` exports one component named `Name`.
- `index.tsx` is **layout-only** — composition with flex/grid, no data fetching,
  no business logic.
- Colocate support code next to the component; a hook used by multiple files gets
  its own `useXxx.ts` (never exported from `index.tsx`).
- Shared-by-siblings components live at the lowest common ancestor, not a global
  `components/`. Keep depth ≤ 2–3 levels.

## Rule 3 — Props are IDs and primitives, never domain objects

```tsx
<ContactRoleSelect contact={contact} />            // ✗
<ContactRoleSelect dealId={dealId} contactId={id} /> // ✓
```

Each child fetches what it needs via the data layer (same cache, no extra
request). Components stay ~30–80 lines, own their logic, return `null` when they
have nothing to show (the parent never checks on the child's behalf). Non-trivial
logic → a colocated `useComponentName.ts`.

## Rule 4 — Shared data via a select hook

When siblings need the same entity, a colocated `use<Entity>.ts` selects from an
already-loaded query (adapt to the project's data layer). The data layer
deduplicates — no extra network call.

## Rule 5 — Splitting a large component

Beyond ~80 lines or several distinct blocks: turn the file into a **folder with
`index.tsx` (layout-only) and children inside** — never leave children flat next
to the original file. Each child takes IDs, fetches its own data.

## Styling

- **Parent owns placement** (margin, position, width, gap, layout); **child owns
  internal styling** (typography, color, border, internal padding).
- Every component accepts `className` and merges it onto its root (`cn`/`clsx`).
- Prefer design-system components and tokens over raw HTML/values. Never raw
  `<input>`/`<select>`/`<textarea>` when a DS component exists.
- Switch variant styles inline at the call site with `clsx` object syntax — no
  top-level `XXX_VARIANT` maps or `Record<Kind, string>` registries.

## State (highest applicable wins)

1. Server state → the data-fetching library (TanStack Query / SWR…). Never store
   fetched data in global state.
2. URL state → router search params (selected id, active tab, open modal — if
   shareable/navigable).
3. Global session → Context (auth, current user, theme).
4. Local UI → `useState` (last resort).

## Hooks & a11y

- If the project uses the React Compiler, **do not** hand-write `useMemo` /
  `useCallback` / `React.memo` — the compiler inserts memoization. Otherwise use
  them only when performance requires it.
- Avoid `useEffect` for async data; prefer the data layer. If used, comment why.
- Every `<label>` has `htmlFor`; every form control has a unique `id`. Prefer DS
  form components.

## Testing

Follow the repo's policy. Many frontend repos run **no component unit tests**
(only isolated pure utils) — check `AGENTS.md` before adding or keeping
`*.test.tsx`.
