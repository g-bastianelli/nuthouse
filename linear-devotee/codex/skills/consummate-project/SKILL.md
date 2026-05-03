---
name: consummate-project
description: Use in Codex when creating a Linear Project from a spec file or from vibe-mode Q&A. Drafts a Project-SDD, previews it, creates the Linear Project on approval, writes chain state, and can hand off to bind-milestone.
---

# Linear Devotee Consummate Project for Codex

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
2. Detect file or vibe input.
3. Gather Linear workspace metadata.
4. Draft and clarify Project-SDD.
5. Preview and confirm.
6. Create Linear project.
7. Write chain state.
8. Print final report.

### Step 1 - Preconditions

1. Call `tool_search` with query `linear`. Abort if no Linear tools are available.
2. Verify git context with `git rev-parse --is-inside-work-tree`.
3. Verify `../../../persona.md` is readable.
4. Create a plugin-local `data/` directory when the runtime exposes a plugin root; otherwise use `linear-devotee/codex/data/` in the current repository.

### Step 2 - Input mode

- File mode: if the argument is a readable `.md` path, read it and confirm the one-paragraph synthesis with the user.
- Vibe mode: ask five questions one at a time and persist answers to `data/vibe-<session>.txt`:
  1. What is the project north star?
  2. Why now?
  3. What outcomes prove success?
  4. What constraints bind the work?
  5. What is explicitly out of scope?

### Step 3 - Workspace metadata

Fetch from Linear:

- Teams.
- Existing projects and their status objects.

If there is one team, use it. If there are multiple, ask the user to pick. Select a default project status by `status.type`: prefer `backlog`, fallback to `planned`. Never hardcode status names.

### Step 4 - Draft Project-SDD

Draft locally or through a read-only Codex subagent when available. The draft must stay neutral, concise, and under 800 words.

Return this markdown shape:

```markdown
## Project-SDD brief

**Workspace** : <N teams detected> - **Default team** : <team.key - name> | _unclear_

**Vision** (1-2 sentences) : <synthesis> | _unclear_

**Why / Context**
<2-4 lines> | _unclear_

**Outcomes / Success criteria**
- <verifiable project-level outcome>

**Scope**
- **In** : <bullet>
- **Out** : <bullet>

**Constraints**
- <explicit constraints>

**Architecture / Components**
- `path/x.ts` - currently does Y
- `service-foo` - does not exist yet

**Open decisions**
- <pending decision>

**Suggested clarifying questions for devotee**
- <most blocking question first>

---

## Decomposition proposal

**Mode** : `flat: <N> issues` | `phased: <M> milestones x ~<N/M> issues each`
- Phase 1: <name> - <one-line scope>

---

## Suggested issues

- [Phase 1: <name>]
  - <issue title>
```

Mark missing fields `_unclear_`; do not invent content.

### Step 5 - Clarify

Scan the draft for `_unclear_` and suggested questions. Ask one question per turn. Patch the draft after each answer. Stop when no blocking `_unclear_` remains or when the user explicitly says to ship as-is.

### Step 6 - Preview and confirm

Print the full patched draft. Ask:

```text
i consummate this project before you, my god - is the offering accepted? (y / edit / cancel)
```

Only continue on `y`.

### Step 7 - Create Linear project

Create the project with:

- `name`: title extracted from the draft.
- `description`: Project-SDD sections only, excluding decomposition and suggested issues.
- `teamIds`: selected team id.
- `statusId`: chosen default status id.

On failure, surface the error verbatim. Do not retry blindly.

### Step 8 - Write chain state

Write `data/chain-<session>.json`:

```json
{
  "current": "consummate-project",
  "project": {
    "id": "<UUID>",
    "url": "<url>",
    "name": "<name>",
    "team_id": "<team.id>",
    "team_key": "<team.key>"
  },
  "drafts": {
    "decomposition": "flat | phased",
    "milestones": [
      { "name": "Phase 1: <name>", "scope": "<one line>", "target_date": null }
    ],
    "issues": [
      { "title": "<title>", "milestone_idx": 0 }
    ]
  },
  "created_at": "<ISO 8601>"
}
```

Never write outside plugin-local `data/`.

### Step 9 - Handoff

Ask whether to continue with `linear-devotee:bind-milestone`. Print the suggestion rather than invoking another skill if the runtime cannot chain skills directly.

## Final report

```text
linear-devotee:consummate-project report
  Project:         <name> - <url>
  Team:            <team.key>
  Status:          <status.name> (<status.type>)
  Decomposition:   <flat: N | phased: M phases>
  Drafted issues:  <N>
  Chain state:     <path>
  Hand-off:        bind-milestone | stop | cancelled | linear_error
```

## Things you never do

- Mutate Linear without explicit approval.
- Run `git push`, `git commit`, or `git rebase`.
- Hardcode Linear project status names.
- Let the persona bleed after exit.
