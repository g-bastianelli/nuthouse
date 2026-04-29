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

- `AGENTS.md` files that apply to the target path.
- `CLAUDE.md` when present.
- README or package scripts near the target package.

Use these files to learn project-specific commands, design-system conventions, entity patterns, routing, and data fetching rules. If local instructions conflict with this skill, local user/repository instructions win.

Clarify the target component, page, hook, or folder if the request does not identify one.

### Step 2 - Explore in parallel

If Codex subagents are available, spawn an `explorer` subagent before writing code. The subagent must do read-only discovery and return the structured report below.

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
2. Map the render tree to files and folders.
3. Decide which components are leaves and which need folders with `index.tsx`.
4. Start edits from deepest leaves and work upward.

Do not create files until the tree-to-folder mapping is clear.

### Step 4 - Implement

Use `apply_patch` for manual edits. Follow existing project patterns for imports, formatting, styling, tests, and command runners.

Before writing a helper function, search shared project code (`libs/`, `packages/`, `src/`, or local shared folders) for an existing equivalent. Do not reimplement shared utilities.

### Step 5 - Verify

Run lint, typecheck, and focused tests using the project's documented task runner. Do not run raw tools such as `eslint`, `tsc`, or `vitest` directly when local instructions provide wrapper commands.

If commands are not documented, infer the safest package script from `package.json` and state the assumption.

## React Architecture Rules

### Rule 1: One component per file

Each file defines exactly one React component. No private helper components in the same file. Non-component constants, types, and small pure helpers are allowed.

### Rule 2: Folder structure mirrors JSX tree

If component `A` renders components `B`, `C`, and `D`, then `B`, `C`, and `D` live inside `A`'s folder or next to `A` when `A` is itself a leaf under its parent.

Use:

- `ComponentName.tsx` for leaf components with no colocated files.
- `ComponentName/index.tsx` when the component has children or colocated `hooks.ts`, `types.ts`, `utils.ts`, or `useXxx.ts`.

Private components live in the parent folder. Components shared by siblings live at the lowest common ancestor. Only move components to global shared locations when reused across unrelated features.

Keep depth under control. If the tree exceeds 2-3 folder levels, regroup into section components.

### Rule 3: Props are IDs and primitives

Do not pass domain objects as props. Pass IDs and primitive view parameters, then let each child fetch or select what it needs.

```tsx
// Bad
<ContactRoleSelect contact={contact} />

// Good
<ContactRoleSelect dealId={dealId} contactId={contactId} />
```

Layout and page components compose children and manage routing/search params. They do not fetch domain data just to pass derived values to widgets.

Children own their domain conditions. A child returns `null` when it has nothing to show; the parent does not check the child's business condition before rendering it.

### Rule 4: Shared data via select hooks

When siblings need the same entity, create a colocated select hook:

```tsx
export function useDealContact(dealId: number, contactId: number) {
  return useDealContactsQuery(dealId, {
    select: (data) => data.contacts.find((contact) => contact.id === contactId),
  });
}
```

Adapt this pattern to the project's data library. Prefer suspense queries when the project supports them. Use the data layer cache instead of storing fetched server data in global state.

### Rule 5: Split large components

When a component exceeds roughly 80 lines or renders several distinct blocks:

1. Create a folder named after the component.
2. Move each block into its own file in that folder.
3. Keep the parent `index.tsx` layout-only.
4. Put non-trivial business logic in colocated hooks.

## Styling and State

- Every component accepts `className?: string` and applies it to the root element with the project's merge helper (`cn`, `clsx`, or equivalent).
- Parent components own placement, spacing between children, width, position, margin, and z-index.
- Child components own internal typography, colors, borders, padding, and interaction styling.
- Prefer design-system components and tokens over raw HTML, raw form controls, and raw values.
- Keep conditional styling next to the JSX. Do not create top-level variant maps unless the project already requires that pattern.
- Prefer server state in the data library, URL state for shareable UI state, context for session-wide state, and `useState` only for local ephemeral UI.
- Avoid `useEffect` unless there is no event-handler, derived-state, or library alternative.

## TypeScript and Accessibility

- Do not use `any`.
- Avoid casts and non-null assertions.
- Prefer inference, discriminated unions, `unknown` with narrowing, and `as const` for literal types.
- Every label has `htmlFor` pointing to a matching form control `id`.
- Every interactive form control has a stable unique `id`.
- Prefer design-system form components when available.

## Final Checklist

Before finishing, verify every item:

1. One component per file.
2. Folder structure mirrors JSX tree.
3. Props are IDs/primitives only.
4. Shared entity data uses colocated select hooks when siblings need it.
5. Parent components do not own child business conditions.
6. Every component accepts and applies `className`.
7. Parent owns placement and spacing; child owns internal UI.
8. Design-system components and tokens are preferred.
9. No duplicated shared utilities.
10. No `any`, unsafe casts, or non-null assertions.
11. Accessibility labels and control IDs are correct.
12. Lint, typecheck, and focused tests pass or blockers are reported clearly.
