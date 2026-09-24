# Styling and accessibility ownership

Read this before changing layout, variants, controls, or interaction behavior.

## Keep ownership explicit

- The parent owns placement: grid/flex participation, gap, width, and margin.
- The child owns its root, typography, color, border, and internal padding.
- Accept `className` where callers need placement control and merge it onto the
  root with the repository helper.
- Express variants with local `clsx`/`cn` conditionals at the call site; avoid
  top-level class lookup registries.
- Prefer design-system components and semantic tokens to raw controls and magic
  values.

## Preserve interaction contracts

- Associate every label and control with a stable unique ID.
- Keep the keyboard behavior, visible focus, roles, and semantics supplied by
  the design system.
- Do not trade native or design-system behavior for a visually convenient
  `div` with click handlers.

```tsx
const inputId = useId();

return (
  <Field>
    <Label htmlFor={inputId}>Email</Label>
    <Input id={inputId} name="email" />
  </Field>
);
```
