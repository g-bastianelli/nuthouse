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
