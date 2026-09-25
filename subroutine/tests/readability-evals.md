# Readability scenarios

Use these as behavioral evaluations of `react-rules` and `code-organisation`, not
prose substring tests. Give an agent the hook-injected disciplines and a temporary
React repository with the described code. Read the resulting diff. Each scenario
comes from agent-written code that compiled and worked but was hard to read.

## Nested hierarchy submenu

Ask for a batch-action submenu that attaches rows to a location picked through
five levels: site, area, work center, work unit, equipment. Each level is loaded
by an existing query hook.

Expected: one component per repeated level, each rendering one child per item; no
component holds a `.map` inside another `.map`. Children receive IDs they resolve
through selector hooks over the loaded queries. Each level that owns a child is a
folder whose `index.tsx` renders it, even with a single child; the last level is
a file.

## Uneven sibling submenus

Start from a menu with five submenus: two live in their own files, three are
written inline in the parent, and the parent defines radio sentinels such as
`MIXED = ""` and `NO_DATA_TYPE = "none"`. Ask for a sixth submenu.

Expected: every submenu, including the new one, gets its own file. The parent
passes typed domain values (`null` for none, `undefined` for mixed); the sentinel
strings move into the radio leaf that needs them.

## Infinite-query rows

Ask for an action cell on each row of a table fed by an infinite query holding
about 5,000 rows, with no per-ID cache entry.

Expected: the row component receives its row item, not an ID it would look up by
scanning the loaded pages, and not the whole list.

## Legitimate arrays

Ask for a status filter built from a `Select` over enum options, and a virtualized
table over the same rows.

Expected: the `Select` receives its option array and the virtualized list receives
its row array. The agent neither splits the options into per-item components nor
flags these arrays as violations.

## Comments beside a chatty file

Ask for a bug fix in a component whose existing comments are 4-to-10-line blocks
inside JSX that recount past bugs. The fix relies on a framework quirk.

Expected: at most one or two lines stating the quirk, with the bug story in the
commit message. No new narrative or paraphrase comment, even though the
surrounding density invites one. Narrative or paraphrase comments in the edited
file may be removed, but a framework pitfall they contain survives as one short
line.

## Scattered status branches

Start from a panel whose JSX tests `view.kind === "ready" &&` in three places and
renders a twelve-element block inline in one ternary arm. A local
`const isLocked = view.kind === "ready" && !canEdit` drives another branch, and
the `ready` arm guards `if (!view.url) return null` although the derivation
always sets a URL for `ready`. Ask for a new `expired` state.

Expected: one exhaustive match on the view, including `expired`. The large arm
becomes its own component receiving the narrowed fields. `locked` becomes a
variant returned by the derivation instead of a flag beside the JSX. `url` is
required on the `ready` variant and the impossible guard is gone.

## Line breaks as spacing

Ask for a confirmation dialog body with a heading, two paragraphs, and an address
block, in a component that already separates paragraphs with `<br /><br />`.

Expected: separate blocks spaced by their parent (`gap` or the design-system
stack). `<br>` survives only inside the address, where the line breaks are part
of the text.

## Slow success handler

Ask for an archive button whose mutation must refresh the order it archives and
also the dashboard statistics, which refetch slowly. The dialog closes when the
order is fresh.

Expected: `onSuccess` returns only the order refresh; the statistics
invalidation starts without being returned or awaited, so the button leaves its
pending state as soon as the order is fresh.

## Copied module across features

Ask for a second feature that needs the date-range parser already private to a
first feature in the same app, and separately for a package that cannot import
from the app.

Expected: within the app, the parser moves to the two features' lowest common
ancestor and both import it; no copy carries a "keep in sync" comment. Across
the package boundary, the agent keeps the copy only with a link to the ticket
that removes it, or proposes the shared library first.
