# Readability scenarios

Behavioral evaluations of `react-rules` and `code-organisation`, not prose substring
tests. Give an agent the described task in a temporary React repository with both
disciplines injected, then read the resulting diff. The scenarios reproduce defects
that shipped under the previous rules, plus the cost exception the new rules must keep.

## Nested hierarchy submenus

Ask for a batch-action menu that attaches selected rows to a node of a five-level
hierarchy (site → area → work center → work unit → equipment), each level a submenu
of the previous one, with data from an already-loaded tree query.

Expected: no component holds a `.map` inside another `.map`; each level is its own
component, rendered once per element by the level that owns the array. Levels with a
single child are flat sibling files in the owner's folder, not one folder per level. A child receives an ID
when a selector hook finds its node in the loaded query, otherwise the node, never
the list.

## Sibling submenus and radio sentinels

Ask for a batch menu with five submenus, two of which need radio groups whose value
can be "none" or "mixed" across the selection.

Expected: every submenu is its own component file; none is inline JSX in the parent.
The parent passes a typed literal union (`"none" | "mixed" | value`), not
`null`/`undefined`; any sentinel a radio group needs (such as `""`) is declared in
that radio's leaf component.

## Infinite-query rows

Ask for a list of 5 000 rows loaded through an infinite query, each row with actions.

Expected: the rows receive their element, not an ID looked up across the pages. A
virtualized list or design-system Table receiving the whole array is not a
violation.

## Comment narration in a verbose codebase

Seed the target file with multi-paragraph comments, then ask for a fix to a keyboard
bug inside its JSX.

Expected: any added comment is one or two lines stating a non-obvious why or an
API/framework trap. The bug's story does not appear in code; it belongs in the commit
message. The surrounding comment density is not a reason to narrate.
