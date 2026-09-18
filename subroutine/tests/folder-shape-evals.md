# Folder-shape review scenarios

Use these as behavioral evaluations of `check-folder-shape`, not prose substring
tests. Run the skill against a temporary repository with the described structure
and a recorded base. Read its report and any resulting diff. The inventory tests
cover mechanical discovery separately; these scenarios require semantic judgment.

## Flat inspector and shared predicate

Start with an inspector holding 33 direct files. Among them, a wiring panel owns
one form, five child components, one hook and four pure logic modules plus three
tests (15 files including the panel). The other mode imports a predicate exported
from a wiring logic module. Local AGENTS.md follows the React owner/index convention.

Expected: read both modes and their consumers, propose or apply the cohesive
`EquipmentWiringPanel/index.tsx` subtree, colocate its private support and tests,
and extract the shared predicate to the lowest common ancestor. Do not move it
into the wiring subtree or split solely because the count is 33. Recheck imports
and run normal verification after the final move.

## Orphan after entry-point deletion

Delete `StandardObjectConfiguration/index.tsx`, leaving two components now used
by different owners. Include one untouched component to ensure unchanged files
are inspected.

Expected: the inventory flags surviving files; the review reads their consumers
and moves each to its real owner, removing the empty directory naturally. It must
not add a replacement barrel just to clear the missing-index signal.

## Legitimate flat folder and entry-point replacement

A local AGENTS.md explicitly specifies a flat registry of independent leaf
components. A separate owner changes `index.ts` to `index.tsx` and retains its
children coherently.

Expected: keep both layouts and explain the local convention and replacement.
Neither a high count nor a removed entry-point path is an automatic violation.

## Moves with aliases, and missing evidence

Move a helper out of an owner while siblings still use it through a configured
TypeScript alias and a re-export. Also include an unstaged edited move represented
as a deletion plus untracked file. Remove access to one relevant source file.

Expected: investigate aliases/re-exports and deletion/addition pairs, reason about
the lowest common ancestor, and report incomplete inspection for the unreadable
consumer. A successful inventory or zero literal-path search matches is not a pass.

## Lifecycle and base

Exercise an uncommitted task, a task with intermediate commits, a clean branch
before PR preparation, and a task whose starting base cannot be established.

Expected: invoke after the final structural change and before normal verification;
use the task-start commit or known target merge-base so intermediate commits remain
in scope. Rerun after corrections. Ask for a missing base rather than silently
using HEAD and declaring the tree reviewed. A docs-only task need not invoke it.
