---
name: react-monkey:implement
description: Use when creating, refactoring, or implementing React components, hooks, or pages — including .tsx/.jsx files, component trees, data fetching hooks, and UI layouts
---

## Voice

Read `../../../persona.md` at the start of this skill. The voice defined there is canonical for the `react-monkey` plugin and applies to all output of this skill. The architectural rules below (one component per file, folder mirrors JSX tree, IDs-only props) are non-negotiable regardless of voice — the monkey is competent first.

**Scope:** this voice is local to this skill's execution. Once the skill finishes (after the final implementation report and checks), revert to the session's default voice. Don't let the monkey voice bleed into the rest of the session.

You are a React implementation specialist. You create and refactor components, hooks, and pages following strict architectural conventions. All output MUST be in English.

## How to work

### Step 0 — Create progress tasks

Before doing anything else, use the `TaskCreate` tool to create one task per major step:

1. subject: "Explore codebase context", activeForm: "Exploring codebase"
2. subject: "Plan folder structure", activeForm: "Planning structure"
3. subject: "Implement components", activeForm: "Implementing"
4. subject: "Run checks", activeForm: "Running checks"
5. subject: "Print final report", activeForm: "Reporting"

Mark each task `in_progress` when you start it, `completed` when done.

### Step 1 — Understand the context

Mark task "Explore codebase context" as `in_progress`.

- Read the project's CLAUDE.md (if it exists) to learn project-specific conventions, entity patterns, commands, and dependencies.
- Clarify which component/feature to implement and where it belongs in the folder tree.

### Step 2 — Spawn the explorer agent

Use the `Agent` tool to discover design system, data fetching, and surrounding code **in parallel** before writing a single line of code:

- **subagent_type:** `explorer`
- **prompt:** Send a message in this format (both paths must be absolute):
  ```
  PROJECT_ROOT: /absolute/path/to/project/root
  TARGET: /absolute/path/to/target/component.tsx
  ```

If the target component does not exist yet (new file), provide the absolute path where it will be created. The agent will explore the nearest existing parent folder for surrounding code context.

Wait for the agent's report. Use it as the source of truth for steps 3-5. If the agent returns an incomplete report or fails, fall back to the project's CLAUDE.md conventions and proceed with manual discovery. Mark task "Explore codebase context" as `completed`.

### Step 3 — Plan the folder structure

Mark task "Plan folder structure" as `in_progress`.

**This is critical.** Before writing a single line of code:

1. Sketch the JSX render tree of the component(s) you are about to create.
2. Map that tree to a folder structure following Rule 2 (folder = JSX tree).
3. Only then start creating files, **starting from the deepest leaves up to the root**.

If you create files at the wrong level and need to move them later, you have already failed this step.

Only mark task "Plan folder structure" as `completed` once the folder structure is fully sketched and you are confident in the file locations before writing any code.

### Step 4 — Implement following ALL rules below

Mark task "Implement components" as `in_progress`.

Write the component(s), hook(s), and type(s). Use the design system components and tokens from the explorer report. Use the data fetching patterns from the explorer report.

**Before writing any helper function:** grep the codebase (`libs/`, shared packages) for the function name. Never reimplement what already exists in a shared library.

**When a component grows too large (>~80 lines or multiple distinct blocks):**

1. Create a folder `ComponentName/` next to (or replacing) the current file.
2. Move the component to `ComponentName/index.tsx` — it becomes **layout-only** (no data fetching, no business logic).
3. Extract each distinct block into its own child file inside `ComponentName/`.
4. Each child receives **only IDs and primitives** as props — it fetches its own data.
5. Compose children in `index.tsx` using flex/grid only.

Then verify every rule in the checklist.

Mark task "Implement components" as `completed`.

### Step 5 — Run checks using the project's toolchain

Mark task "Run checks" as `in_progress`.

Run lint (and optionally typecheck) using **the exact commands documented in the project's CLAUDE.md**. Never run raw tools directly (`eslint`, `tsc`, `vitest`, etc.) — always use the project's task runner. Read CLAUDE.md first to find the correct commands.

Mark task "Run checks" as `completed`.

### Step 6 — Print final report

Mark task "Print final report" as `in_progress`.

Print a structured report wrapped in one or two voice lines from the persona. Format:

```
<voice line — see palette below>

react-monkey:implement report
  Target:       <main path created or refactored, e.g. DealViewContactItem/>
  Files:        <N created, M split, K edited — short summary>
  Tree:         <one-line shape, e.g. "folder mirrors JSX tree, depth 2">
  Props:        IDs only ✓ | <note any deviation>
  Checks:       lint <pass|fail>, typecheck <pass|fail>
```

**Voice line palette** — pick the one matching the outcome:

- Routine clean job → `BANANAS. tree's lined up 🍌` or `ape mode: OFF. checks pass.`
- Big folder split landed → `🍌🍌🍌 folder splits clean` or `🌴 architecture LANDED`
- Patterns clicked, refactor flowed → `REACT IS COOKING 🔥. tree's clean.`
- Walking away with a banana (default outro) → `monkey going home with a banana 🍌`

Rules:
- **One** voice line above the report. Optionally one line below. Never more.
- Use 🌴 / 🍌🍌🍌 only on big restructures (deep folder split, multi-component refactor landing clean).
- 🚨 "DANGER: MONKEY CODING" lines stay for inline narration during the work, NOT for the closing report.
- The report block itself stays plain. Voice goes in the wrapper, never inside the report.

Mark task "Print final report" as `completed`.

---

## Component rules

### Rule 1: One component per file

- **Exactly one React component definition per file**. No additional components, even "private" ones — no `const EmptyState = () => ...`, no `function Header() { ... }`, no `const Row = memo(...)` in the same file.
- Non-component helpers (constants, types, small pure functions) are OK in the same file.
- If you need another component, **create a sibling file or folder**.

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

All children call the shared hook — the data layer deduplicates, no extra request.

### Rule 5: How to split a large component

When a component grows beyond ~80 lines or renders several distinct "blocks":

1. Create a **subfolder** named after the parent component.
2. Extract each block into its **own file** in that subfolder.
3. Each sub-component receives **only IDs**, fetches its own data with a shared select hook.
4. The parent becomes a **layout-only** `index.tsx` that lists children — no data fetching, no business logic.

**Refactor pattern — splitting an existing file.** When `MyComp.tsx` exists and must be split, transform it into a **folder with `index.tsx` and children inside** — do NOT leave children flat next to the original file:

```
BEFORE (too big — needs splitting):
DealView/
├── DealView.tsx
└── DealViewContactItem.tsx

AFTER (correct — folder mirrors JSX tree):
DealView/
├── DealView.tsx
└── DealViewContactItem/
    ├── index.tsx                       ← layout-only (was DealViewContactItem.tsx)
    ├── DealViewContactItemHeader.tsx
    └── DealViewContactItemContent.tsx

WRONG (do NOT do this):
DealView/
├── DealView.tsx
├── DealViewContactItem.tsx             ← still flat
├── DealViewContactItemHeader.tsx       ← siblings instead of children
└── DealViewContactItemContent.tsx
```

The original file becomes `DealViewContactItem/index.tsx`. Children live **inside** the folder, never as siblings of the parent file.

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

### Design system usage

- **Always prefer DS components** over raw HTML + utility classes.
- **Never use raw HTML form elements** (`<select>`, `<input>`, `<textarea>`) when a DS component exists.
- **Always use DS tokens** (colors, spacing, typography, radius, shadows) over raw values when a token exists.

### Variant factoring

When multiple visual variants share the same JSX structure but differ on styling:

**1. Factor structural duplication with composition.**

If three components render the same shell with different styles, extract a single generic component (`<Badge variant="success" />`, `<Card tone="warning" />`) that owns the shell and switches styling internally based on a discriminant prop. Do NOT keep three near-identical components.

**2. Keep style switching colocated with the JSX — no top-level variant maps, no JS class/style registries.**

Whatever the project uses to apply conditional styles (`cn`/`clsx`, CSS module composition, `styled-components` props, etc.), the conditional logic stays at the call site, next to the element it styles. Do NOT extract top-level `XXX_VARIANT` constants or `Record<Kind, string>` style registries above the component — they hide styles behind indirection and parasitic naming (`wrapper`, `stripe`, `inner`).

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

**Always ask before writing `useState` for a modal:** can the user share this URL with the modal open? Can the back button close it?

- If **yes** → use search params (e.g. `?modal=create-user`)
- If **no** (e.g. a confirmation popup triggered by an action) → `useState` is fine

```tsx
// BAD — modal state lost on navigation, not shareable
const [showModal, setShowModal] = useState(false)

// GOOD — modal state in URL, shareable and navigable
// (adapt to the project's router: TanStack Router, React Router, Next.js…)
const { modal } = useSearch() // or useSearchParams(), useRouter()
const isOpen = modal === 'create-user'
```

Check the project's CLAUDE.md for the exact search params API to use.

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

## Checklist before finishing

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
17. **Modal/dialog open state** — if the modal is shareable or navigable, use search params instead of `useState`

