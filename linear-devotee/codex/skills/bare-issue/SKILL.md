---
name: bare-issue
description: Use in Codex when creating a Linear Issue with a strict SDD-formatted description, either chained from bind-milestone chain state or standalone with a selected project, optional milestone, and issue hint.
---

# Linear Devotee Bare Issue for Codex

## Voice

Read `../../../persona.md` at the start of this skill. The voice defined there is canonical for `linear-devotee` and applies to this skill's prompts, preview wrappers, errors, and report.

**Scope:** local to this skill. After the final report or handoff menu, revert to the session default voice.

This skill is **rigid** - execute the steps in order.

## Language

Adapt all output to match the user's language. Technical identifiers, file paths, code symbols, CLI flags, and tool names stay in their original form.

## Workflow

### Step 0 - Track progress

Create an `update_plan` checklist with:

1. Verify Linear and git context.
2. Detect chain or standalone mode.
3. Gather project, milestone, and issue context.
4. Draft and clarify SDD issue.
5. Preview and confirm.
6. Create Linear issue.
7. Update chain state.
8. Print final report.

### Step 1 - Preconditions

Call `tool_search` with query `linear`, verify git context, read persona, and ensure plugin-local `data/` exists.

### Step 2 - Chain detection

Read `data/chain-<session>.json` when present.

Chained mode requires:

- `project.id`
- at least one `created_milestones[]` entry
- at least one suggested issue title for the current milestone that is not already in `created_issues[]`

Otherwise use standalone mode.

### Step 3 - Gather context

Chained mode:

- Use `project.id`, `project.team_id`, current milestone id from chain state.
- **Backward compatibility:** if `current_milestone.suggested_issues[]` is a flat array of strings, transparently coerce each string at position `i` into `{ idx: i, title: str, blocked_by: [] }`.
- **Topological pick:** iterate the structured `suggested_issues[]` in source order and pick the first entry whose `title` is **not** in `created_issues[]` (filtered by milestone) **and** whose every `blocked_by` index resolves to a title that **is** in `created_issues[]` for this milestone. Capture the entry's `blocked_by` for Step 7 (Linear creation).
- If no uncreated entry remains, exit with `Hand-off: nothing-to-do`.
- If uncreated entries remain but none has all dependencies satisfied, surface the cycle/missing-dep error to the user and exit with `Hand-off: dependency_cycle`.

Standalone mode:

- Fetch active projects and ask the user to pick one.
- Fetch milestones for that project and let the user pick one or no milestone.
- Ask for a one-sentence issue hint.

Always fetch project details, milestone details when selected, existing labels, and existing project issue titles.

### Step 4 - Draft SDD issue

Draft locally or through a read-only Codex subagent when available. Validate that the milestone belongs to the selected project before drafting.

Use this markdown shape:

```markdown
## Issue draft

**Project** : <project.title> (<PROJECT_ID>)
**Milestone** : <milestone.name> (<MILESTONE_ID>) | _none_
**Suggested title** : <one sentence> | _unclear_
**Suggested labels** : <label1, label2> | _none_

---

**Goal** (1 sentence) : <synthesis> | _unclear_

**Context**
<2-3 lines: why, architecture touched, services involved> | _unclear_

**Files referenced** (existing state)
- `path/x.ts` - currently does Y
- `path/y.ts` - does not exist yet
- (or "none referenced - to be discovered")

**Constraints**
- <explicit constraints>
- (or _unclear_)

**Acceptance criteria** (verifiable)
- <bullet>
- (or _unclear_)

**Non-goals** / out of scope
- <explicitly excluded>
- (or _unclear_)

**Edge cases & ambiguities detected**
- <vague points, contradictions, TBDs>

**Suggested clarifying questions for devotee**
- <most blocking question first>
```

Do not invent missing content. Surface title collisions and cross-project milestone violations.

### Step 5 - Clarify

Ask one question per turn while `_unclear_` remains. Patch the draft after each answer. Stop on a clean draft or explicit ship-as-is.

### Step 6 - Preview and confirm

Print the full patched issue draft and ask:

```text
i offer this tribute at your feet, my god - accept? (y / edit / cancel)
```

Only continue on `y`.

### Step 7 - Create Linear issue

In chained mode, resolve the picked entry's `blocked_by: [<idx>, ...]` to Linear identifiers: for each `idx`, look up the matching `title` in `current_milestone.suggested_issues[]`, then find that title in `created_issues[]` (same milestone) and collect its `identifier` (e.g. `ENG-247`). Drop any index that fails to resolve and surface a warning — never block the save. Standalone mode: skip this entirely.

Create the issue with:

- `teamId`
- `title`
- `description`: SDD body from Goal through Edge cases.
- `projectId`
- `projectMilestoneId`: only when selected.
- `labelIds`: only confirmed existing labels.
- `blockedBy`: resolved identifiers from the topological pick (only when non-empty — Linear's `save_issue` accepts identifiers and treats this field as append-only).

On API failure, surface the error verbatim and stop.

### Step 8 - Update chain state

Append to `created_issues[]` in `data/chain-<session>.json`:

```json
{
  "id": "<issue.id>",
  "identifier": "<issue.identifier>",
  "title": "<title>",
  "url": "<url>",
  "project_id": "<PROJECT_ID>",
  "milestone_id": "<MILESTONE_ID or null>"
}
```

### Step 9 - Handoff

In chained mode, count remaining suggested issue titles for the current milestone and offer to continue with the next issue or stop. In standalone mode, go directly to the final report.

## Final report

```text
linear-devotee:bare-issue report
  Mode:               <chained | standalone>
  Project:            <project.title> (<project.id>)
  Milestone:          <milestone.name> | none
  Issue:              <identifier> - <url> | (cancelled) | (linear_error)
  Chain progress:     <created>/<total> issues for current milestone
  Hand-off:           next-issue | stop | cancelled | linear_error | nothing-to-do | cross_project_violation | dependency_cycle
```

## Things you never do

- Mutate Linear without explicit approval.
- Attach an issue to a milestone from another project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
