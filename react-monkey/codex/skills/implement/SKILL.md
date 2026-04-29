---
name: implement
description: Use when creating, refactoring, or implementing React components, hooks, or pages in Codex, including .tsx/.jsx files, component trees, data fetching hooks, and UI layouts. Enforces project-agnostic React architecture rules while discovering app-specific conventions from local repo instructions.
---

# React Monkey for Codex

Use this skill to implement React components, hooks, and pages in Codex. Keep the skill project-agnostic: app-specific conventions, APIs, routes, design-system details, and folder quirks must come from the target repository's local instructions (`AGENTS.md`, `CLAUDE.md`, README files, or nearby code), not from this skill.

All code, comments, identifiers, and final implementation notes must be in English unless the target repository already uses another language for code-facing text.

## Workflow

### Step 0 - Track progress

Before exploring or editing, create an `update_plan` checklist with:

1. Explore codebase context.
2. Plan folder structure.
3. Implement components.
4. Run checks.

Mark each step `in_progress` when starting and `completed` when done.

### Step 1 - Read project instructions

Read local instructions before inspecting implementation details:

- `AGENTS.md` files that apply to the target path (highest priority).
- `CLAUDE.md` when present.
- README or package scripts near the target package.

Use these files to learn project-specific commands, design-system conventions, entity patterns, routing, and data fetching rules. If local instructions conflict with this skill, local user/repository instructions win.

Clarify the target component, page, hook, or folder if the request does not identify one.

### Step 2 - Explore in parallel

Spawn an `explorer` subagent before writing code. The subagent must do read-only discovery and return a structured report (design system, data fetching library, surrounding code patterns, check commands).

Use this message shape:

```text
PROJECT_ROOT: /absolute/path/to/project/root
TARGET: /absolute/path/to/target/component.tsx

Read-only task. Discover React implementation context for TARGET.

Return ONLY this report:

## Design System
- Folder: <path or "none">
- Components: <comma-separated list or "n/a">
- Spacing tokens: <examples or "n/a">
- Color tokens: <examples or "n/a">

## Data Fetching
- Library: <name + version, or "none detected">
- Suspense: <yes | no | unknown>
- Select pattern: <yes with example path | no>
- Global state: <library name + purpose, or "none">

## Surrounding Code
- Siblings: <file names>
- Shared hooks: <file names or "none">
- Prop pattern: <"IDs only" | "objects passed" | "mixed" with example path>
- Check commands: <commands from local instructions or package scripts>
```

While the explorer runs, inspect non-overlapping local context yourself: package scripts, instruction files, and the nearest existing parent folder.

If subagents are unavailable or fail, perform the same discovery locally before editing.

### Step 3 - Plan the JSX tree and folders

Before writing code:

1. Sketch the JSX render tree.
2. Map the render tree to files and folders following Rule 2 (folder = JSX tree).
3. Decide which components are leaves (`ComponentName.tsx`) and which need a folder with `index.tsx`.
4. Start edits from deepest leaves and work upward to the root.

Do not create files until the tree-to-folder mapping is clear.

### Step 4 - Implement

Use `apply_patch` for manual edits. Follow existing project patterns for imports, formatting, styling, tests, and command runners.

Before writing a helper function, search shared project code (`libs/`, `packages/`, `src/`, or local shared folders) for an existing equivalent. Do not reimplement shared utilities.

**When a component grows too large (>~80 lines or multiple distinct blocks):**

1. Create a folder `ComponentName/` next to (or replacing) the current file.
2. Move the component to `ComponentName/index.tsx` — it becomes **layout-only** (no data fetching, no business logic).
3. Extract each distinct block into its own child file inside `ComponentName/`.
4. Each child receives **only IDs and primitives** as props — it fetches its own data.
5. Compose children in `index.tsx` using flex/grid only.

### Step 5 - Verify

Run lint, typecheck, and focused tests using the project's documented task runner. Do not run raw tools such as `eslint`, `tsc`, or `vitest` directly when local instructions provide wrapper commands.

If commands are not documented, infer the safest package script from `package.json` and state the assumption.

---

## Component rules

### Rule 1: One component per file

- **Exactly one React component definition per file**. No additional components, even "private" ones — no `const EmptyState = () => ...`, no `function Header() { ... }`, no `const Row = memo(...)` in the same file.
- Non-component helpers (constants, types, small pure functions) are OK in the same file.
- If you need another component, **create a sibling file or folder**.

```tsx
// BAD — two components in one file
function UserCard({ userId }: { userId: number }) { ... }
const UserCardSkeleton = () => <div>...</div>;  // WRONG: second component

// GOOD — separate files
// UserCard.tsx
function UserCard({ userId }: { userId: number }) { ... }
// UserCardSkeleton.tsx
function UserCardSkeleton() { ... }
```

### Rule 2: Folder structure mirrors JSX tree

The file tree must reflect the component render tree. If `A` renders `B`, `C`, `D`, then `A/` contains `B`, `C`, `D` as files or subfolders.

**When to use a single file vs a folder:**

- **Single file** (default): when the component has no sub-components and no colocated files. Place it as `Parent/ComponentName.tsx`.
- **Folder with `index.tsx`**: when the component has sub-components (children in the JSX tree) or colocated files (`hooks.ts`, `types.ts`, `utils.ts`). `FolderName/index.tsx` exports exactly one main component named `FolderName`.

**Colocate support code** next to the component: `hooks.ts` or `useXxx.ts`, `types.ts`, `utils.ts`. No extra nesting.
Hooks used by **multiple files** (e.g. both parent and child) MUST live in their own `useXxx.ts` file — never export a hook from `index.tsx`.

**Where to place shared components:**

- **Private** (used by one parent only): inside the parent folder.
- **Shared by siblings** (used by multiple children of the same parent): at the **lowest common ancestor** folder, NOT in a global `components/` or `shared/` folder.
- Only move to a global shared location when genuinely reused across unrelated features.

**Keep depth under control**: max 2-3 folder levels. If deeper, regroup into "section" components.

**Concrete example** — a contact item in a deal view:

```
DealViewContactItem/
├── index.tsx                        # layout only: renders Header + Content
├── useDealContact.ts                # shared select hook (all children use it)
├── DealViewContactItemContent.tsx   # fetches own data, displays stats
└── DealViewContactItemHeader/
    ├── index.tsx                    # layout only: flex row of children
    ├── ContactName.tsx              # fetches contact, shows avatar + name
    ├── ContactRoleSelect.tsx        # fetches contact + roles, handles mutation
    ├── ContactWarningBadge.tsx      # fetches contact + warnings, shows icon
    └── ContactNextMeetingBadge.tsx  # fetches contact + meeting, shows link
```

Notice:
- `index.tsx` files are **layout only** — they compose children with flex/grid, they do NOT fetch data.
- Each leaf component fetches its own data via the shared `useDealContact` hook.
- The folder tree matches the JSX tree exactly.

### Rule 3: Small autonomous components (IDs in, no objects in props)

**Props rule — this is non-negotiable:**

```tsx
// BAD — passing a domain object
<ContactRoleSelect contact={contact} />

// GOOD — passing only IDs and primitives
<ContactRoleSelect dealId={dealId} contactId={contactId} />
```

**Why:** each child fetches what it needs via the data layer (same cache, no extra network call). This makes components independently testable, reusable, and decoupled from parent data shape.

**Component autonomy:**
- Keep components **~30-80 lines**. If larger, split into sub-components.
- Each component **owns its logic**: queries, derived state, handlers, conditional rendering.
- A component **returns `null`** when it has nothing to show — the **parent never checks** on the child's behalf.
- If business logic is non-trivial (query orchestration, formatting, derived labels), extract it into a **colocated hook**: `useComponentName.ts` in the same folder.

**Layout/container components — including page components:**
- Focus on **composition and spacing only**.
- May use hooks for routing concerns (reading URL params, managing tabs/search params) to extract IDs.
- Do **NOT** fetch domain data and do **NOT** contain business logic.
- Pass IDs down to autonomous children.
- **Page components follow the same rule.** If a page renders a stat card, counter, or any widget that needs server data, extract it into a self-contained child that fetches its own data. The page itself only manages URL state and composes children.

```tsx
// BAD — page fetches data just to show a count in a stat card
function TenantsPage() {
  const { data: tenants, isLoading } = useTenants()  // ← page does data fetching
  return (
    <div>
      <StatCard count={isLoading ? null : tenants?.length ?? 0} />  // ← passes derived value
      <TenantsTable />
    </div>
  )
}

// GOOD — page is layout only, TenantCountCard fetches its own data
function TenantsPage() {
  return (
    <div>
      <TenantCountCard />   {/* fetches useTenants() internally */}
      <TenantsTable />      {/* fetches useTenants() internally — same cache, no extra request */}
    </div>
  )
}
```

```tsx
// BAD — parent checks child condition and fetches data
function DealContacts({ dealId }: { dealId: number }) {
  const { data } = useDealContacts(dealId);
  return (
    <div>
      {data.contacts.map((contact) =>
        contact.isActive ? (  // WRONG: parent checks child's condition
          <ContactCard contact={contact} />  // WRONG: passes object
        ) : null
      )}
    </div>
  );
}

// GOOD — parent is layout only, child owns its logic
function DealContacts({ dealId }: { dealId: number }) {
  const { data } = useDealContacts(dealId);
  return (
    <div className="flex flex-col gap-md">
      {data.contacts.map((contact) => (
        <ContactCard key={contact.id} dealId={dealId} contactId={contact.id} />
        // Child decides internally whether to render or return null
      ))}
    </div>
  );
}
```

### Rule 4: Shared data via select hook

When multiple siblings need the same entity, create a colocated `use<Entity>.ts` hook that selects from an already-loaded query (adapt to the project's data fetching library):

```tsx
// useDealContact.ts — colocated with the components that use it
export function useDealContact(dealId: number, contactId: number) {
  // Use the project's data fetching pattern (React Query select, SWR mutate, etc.)
  return useDealContactsQuery(dealId, {
    select: (data) => data.contacts.find((c) => c.id === contactId),
  });
}
```

All children call the shared hook — the data layer deduplicates the request, no extra network call.

### Rule 5: How to split a large component

When a component grows beyond ~80 lines or renders several distinct "blocks":

1. Create a **subfolder** named after the parent component.
2. Extract each block into its **own file** in that subfolder.
3. Each sub-component receives **only IDs**, fetches its own data with a shared select hook.
4. The parent becomes a **layout-only** `index.tsx` that lists children — no data fetching, no business logic.

---

## Styling & layout responsibility

### Parent owns placement, child owns internal UI

| Concern | Who owns it | Examples |
|---------|-------------|---------|
| Placement in parent layout | **Parent** | `margin-*`, `position`, `top/right/bottom/left`, `z-index`, `w-*`, `min-w-*`, `max-w-*` |
| Spacing between children | **Parent** | `gap-*`, `space-*`, flex/grid layout, padding on wrapper |
| Internal styling | **Child** | Typography, colors, borders, internal padding, border-radius |

```tsx
// BAD — child positions itself
function ContactCard({ className }: { className?: string }) {
  return <div className={cn("mt-4 ml-2 w-1/2", className)}>...</div>;
}

// GOOD — parent controls placement, child only does internal styling
function ContactCard({ className }: { className?: string }) {
  return <div className={cn("rounded-md border p-md", className)}>...</div>;
}

// Parent applies placement
<ContactCard className="w-1/2" />
```

### className prop is mandatory

- **Every component** MUST accept `className` and apply it to its root element (use `cn()` or `clsx()` to merge).
- When the parent needs to control a child's placement, **pass `className`** — do NOT wrap in an extra `<div>` just to add margin/width.

```tsx
// BAD — unnecessary wrapper div
<div className="mt-4">
  <ContactCard />
</div>

// GOOD — pass className directly
<ContactCard className="mt-4" />
```

### Design system usage

- **Always prefer DS components** over raw HTML + utility classes.
- **Never use raw HTML form elements** (`<select>`, `<input>`, `<textarea>`) when a DS component exists.
- **Always use DS tokens** (colors, spacing, typography, radius, shadows) over raw values when a token exists.

### Variant factoring

When multiple visual variants share the same JSX structure but differ on styling:

**1. Factor structural duplication with composition.**

If three components render the same shell with different styles, extract a single generic component (`<Badge variant="success" />`, `<Card tone="warning" />`) that owns the shell and switches styling internally based on a discriminant prop. Do NOT keep three near-identical components.

**2. Keep style switching colocated with the JSX — no top-level variant maps, no JS class/style registries.**

```tsx
// ✗ Top-level variant map — indirection, parasitic naming ("wrapper", "stripe")
const HEADER_VARIANT: Record<Variant, { wrapper: string; inner: string }> = {
  primary: { wrapper: "...", inner: "..." },
  ...
};

// ✗ Module-level class registry — hides styles behind indirection
export const KIND_CLASS: Record<Kind, string> = { success: "...", warning: "..." };
import { KIND_CLASS } from './palette'
className={apply(KIND_CLASS[kind])}
```

**Why:** colocation beats abstraction for styling. The visual decision + its condition stay in the JSX; a `grep` for the actual class/style lands on the component, not on an opaque `wrapper` key. Adding a new conditional = one line at the call site, not an extension to an external Record.

**The exact syntax for switching styles depends on the project's CSS toolchain** (Tailwind + `cn`/`clsx`, vanilla-extract, CSS modules, etc.). Check the project's CLAUDE.md for the local convention.

---

## Data fetching

- Prefer suspense-based queries when the project's data layer supports it.
- Use `select` to transform responses — don't memoize selectors.
- Prefer optimistic updates or cache writes over query invalidation after mutations (avoids race conditions).
- **Never store fetched data in global state** — let the data layer own it.
- **Global state** (Zustand, Jotai, etc.) is for UI state only — never for server/API data.

---

## State management

**`useState` is the last resort.** Before reaching for it, ask: could this state survive navigation or be shared via URL?

| Level | Tool | Use for |
|-------|------|---------|
| Server state | data fetching library (React Query, SWR…) | anything from the API |
| URL state | router search params | selected item, active tab, filters, open modal, selected entity ID |
| Global session | React Context | auth, current user, theme |
| Local UI | `useState` | unsaved input value, hover, animation |

### URL state rule

**Before using `useState` for any value that determines what is displayed** (selected ID, active tab, open panel, detail view), ask: *can the user share this URL and land on the same view?*

- If **yes** → use search params. Benefits: shareable URL, back button works, no state to synchronize.
- If **no** (e.g. a confirmation popup triggered by an in-page action) → `useState` is fine.

```tsx
// BAD — selected entity lost on navigation, not shareable
const [selectedContactId, setSelectedContactId] = useState<number | null>(null)

// GOOD — selected entity in URL, shareable and navigable
// (adapt to the project's router: TanStack Router, React Router, Next.js…)
const { contactId } = useSearch() // or useSearchParams(), useRouter()
```

Check the project's CLAUDE.md for the exact search params API to use.

### Modal / dialog open state

Same rule: if the modal is shareable or navigable → search params. If it's a transient confirmation → `useState`.

```tsx
// BAD — modal state lost on navigation, not shareable
const [showModal, setShowModal] = useState(false)

// GOOD — modal state in URL, shareable and navigable
const { modal } = useSearch()
const isOpen = modal === 'create-user'
```

---

## TypeScript

- Avoid casting — use safe typing and inference.
- No `any` — use `unknown` and narrow.
- No non-null assertions (`!`) — use optional chaining, null checks, or local variables.
- Prefer `as const` for literal types.
- For discriminated unions: use the pattern documented in the project's CLAUDE.md.

## Hooks

- `useMemo`/`useCallback` only when performance requires it.
- Avoid `useEffect` — consider alternatives (event handlers, derived state, library utilities). If used, explain why in a comment.

## Accessibility

- Every `<label>` must have `htmlFor` pointing to a matching `id` on the associated control.
- Every interactive form element (input, select, textarea) must have a unique `id`.
- Prefer DS form components — they often handle labeling automatically.

---

## Final Checklist

Go through EVERY item. If any fails, fix it before delivering.

1. **One component per file** — no second component definition in any file
2. **Folder mirrors JSX tree** — parent folder contains its JSX children as files/subfolders
3. **Props = IDs/primitives only** — no domain objects passed as props
4. **Each component fetches its own data** — via shared select hooks when siblings need the same entity
5. **`null` return logic lives in the child** — parent never conditionally renders a child based on the child's domain logic
6. **`className` accepted on every component** — applied to root element with `cn()`/`clsx()`
7. **Parent owns layout/spacing** — no placement classes (`margin`, `position`, `width`) on children
8. **Child owns internal styling** — typography, colors, borders, internal padding only
9. **Design system used** — DS components and tokens preferred over raw markup/values
10. **No `any`, no `!`, no unsafe casting**
11. **Suspense queries preferred** — if the project's data layer supports it
12. **All English** — code, comments, types, everything
13. **Lint and typecheck pass** — using the exact commands from CLAUDE.md
14. **No duplicate utilities** — grepped shared libs before writing any helper function
15. **Accessibility** — every label has `htmlFor`, every form control has a matching `id`
16. **No raw HTML form elements** — uses DS components (Select, Input, etc.) instead
17. **Modal/dialog open state** — if the modal or any selected-entity view is shareable, use search params instead of `useState`
