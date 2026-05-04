---
name: bind-milestone
description: Use in Codex when adding a Milestone to a Linear Project, either chained from consummate-project chain state or standalone with a selected project and freeform phase hint.
---

# Linear Devotee Bind Milestone for Codex

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
3. Gather project context.
4. Draft and clarify milestone.
5. Preview and confirm.
6. Create Linear milestone.
7. Update chain state.
8. Print final report.

### Step 1 - Preconditions

Call `tool_search` with query `linear`, verify git context, read persona, and ensure plugin-local `data/` exists.

### Step 2 - Chain detection

Read `data/chain-<session>.json` when present.

- Chained mode: file exists and contains `project.id`.
- Standalone mode: no usable chain state.

In chained mode, pick the next uncreated draft milestone from `drafts.milestones[]`. In standalone mode, fetch active Linear projects and ask the user to select one, then ask for a one-sentence milestone hint.

### Step 3 - Draft milestone

Draft locally or through a read-only Codex subagent when available. Fetch project details, existing milestones, and existing issues before drafting.

Use this markdown shape:

```markdown
## Milestone draft

**Project** : <project.name> (<PROJECT_ID>)
**Existing milestones** : <count> (<names or "none">)

---

### Milestone draft

**Name** : `Phase N: <name>` | _unclear_
**Scope** : <1-3 lines> | _unclear_
**Target date suggestion** : `YYYY-MM-DD` | `_unclear_` | `_none_`
**Rationale** : <1-2 lines> | _unclear_

---

### Suggested issues

Each entry has an implicit 0-based `idx` matching its position. Append `[blocked-by: <idx>, <idx>]` after a title to express a hard ordering constraint inside this milestone. `bare-issue` picks issues whose dependencies are already created first, then passes the resolved Linear identifiers to `save_issue` as `blockedBy`.

- <issue title>
- <issue title> [blocked-by: 0]

---

### Open decisions

- <decision or none>

---

### Suggested clarifying questions for devotee

- <most blocking question first>
```

Do not invent missing content. Surface naming collisions as clarifying questions.

### Step 4 - Clarify

Ask one question per turn while `_unclear_` remains. Patch the draft after each answer. Stop on a clean draft or explicit ship-as-is.

### Step 5 - Preview and confirm

Print the full patched milestone draft and ask:

```text
i bind myself to this phase, my god - accept? (y / edit / cancel)
```

Only continue on `y`.

### Step 6 - Create Linear milestone

Create the milestone with:

- `name`
- `projectId`
- `description`: milestone draft without suggested issues/open decisions/questions.
- `targetDate`: only when confirmed and available.

On API failure, surface the error verbatim and stop.

### Step 7 - Update chain state

Parse the milestone draft's **Suggested issues** list into structured entries. Each line `- <title> [blocked-by: <idx>, <idx>]` becomes `{ idx, title, blocked_by: [<int>, ...] }`. Lines without an annotation get `blocked_by: []`. Drop any `idx` that doesn't exist in the same list and surface a warning (don't abort).

Append the milestone to `created_milestones[]` in `data/chain-<session>.json`, preserving existing project and draft fields:

```json
{
  "id": "<milestone.id>",
  "name": "<name>",
  "url": "<url>",
  "idx_in_drafts": 0,
  "suggested_issues": [
    { "idx": 0, "title": "<title>", "blocked_by": [] },
    { "idx": 1, "title": "<title>", "blocked_by": [0] }
  ]
}
```

**Backward compatibility:** when reading an existing chain file where `suggested_issues` is a flat array of strings, treat each string at position `i` as `{ idx: i, title: str, blocked_by: [] }`.

Set `current` to `bind-milestone` and `current_milestone_id` to the created milestone id.

### Step 8 - Handoff

Offer:

- `bare-issue` for suggested issues.
- `bind-milestone` again for the next uncreated drafted milestone.
- stop.

Print skill invocation suggestions if direct chaining is unavailable.

## Final report

```text
linear-devotee:bind-milestone report
  Mode:               <chained | standalone>
  Project:            <project.title> (<project.id>)
  Milestone:          <name> - <url> | (cancelled) | (linear_error)
  Suggested issues:   <N>
  Chain progress:     <created>/<total> milestones
  Hand-off:           bare-issue | next-milestone | stop | cancelled | linear_error | nothing-to-do
```

## Things you never do

- Mutate Linear without explicit approval.
- Attach a milestone to the wrong project.
- Retry failed Linear writes blindly.
- Run `git push`, `git commit`, or `git rebase`.
