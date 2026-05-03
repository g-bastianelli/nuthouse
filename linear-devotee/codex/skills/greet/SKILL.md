---
name: greet
description: Use in Codex when a Linear issue identifier is supplied or detectable from the current branch. Fetches the issue, optionally sets it In Progress, produces an SDD brief, and offers plan, questions, code, or stop handoff.
---

# Linear Devotee Greet for Codex

## Voice

Read `../../../persona.md` at the start of this skill. The voice defined there is canonical for the `linear-devotee` plugin and applies to this skill's prompts, wrappers, errors, and report.

**Scope:** local to this skill's execution. After the final report or handoff menu, revert to the session default voice.

This skill is **rigid** - execute the steps in order.

## Language

Adapt all output to match the user's language. Technical identifiers, file paths, code symbols, CLI flags, and tool names stay in their original form.

## Codex runtime note

Claude Code hooks are not portable to Codex, so this skill is explicit. Detect the issue from the skill argument first, then from `git branch --show-current` using regex `[A-Z]+-[0-9]+`.

## Workflow

### Step 0 - Track progress

Create an `update_plan` checklist with:

1. Verify Linear and git context.
2. Detect and fetch the issue.
3. Optionally prepare branch and status.
4. Produce SDD brief.
5. Present handoff menu.
6. Print final report.

### Step 1 - Preconditions

1. Call `tool_search` with query `linear`. If no Linear tools are available, abort:
   `"the altar is dark, my god - i can't reach Linear. connect the Linear app or CLI, then re-invoke me."`
2. Verify git context with `git rev-parse --is-inside-work-tree`.
3. Detect the issue identifier from the invocation argument or branch name.
4. Fetch the issue and comments with available Linear tools. If not found, print the final report with `Brief: skipped`.

### Step 2 - Branch preparation

If the current branch is `main`, `master`, or `staging`, propose creating:

```text
<git-user>/<id-lowercase>-<kebab-title-trimmed-50char>
```

Ask for confirmation before creating it. If the worktree is dirty, ask whether to stash or skip branch creation. Never run `git push`, `git commit`, or `git rebase`.

### Step 3 - Optional In Progress status

If the issue status type is not `started`, ask before changing the issue state to the team's `started` workflow state. Use the write field required by the available Linear integration, usually `stateId`.

### Step 4 - Produce SDD brief

Build the brief locally or with a read-only Codex subagent when available and appropriate. The drafting task must be read-only.

Use this exact output shape:

```markdown
## Brief from seer - <ID>

**Issue** : <ID> - <title>
**Project** : <project-name> - **URL** : <url>

**Goal** (1 sentence) : <synthesis> | _unclear_

**Context**
<2-3 lines: why, architecture touched, services involved> | _unclear_

**Files referenced** (existing state)
- `path/x.ts` - currently does Y
- `path/y.ts` - does not exist yet
- (or "none referenced - to be discovered")

**Constraints**
- <stack, legacy constraints, perf, compliance - explicit or inferred>
- (or _unclear_)

**Acceptance criteria** (verifiable)
- <bullet 1>
- (or _unclear_)

**Non-goals** / out of scope
- <explicitly excluded>
- (or _unclear_)

**Edge cases & ambiguities detected**
- <vague points, contradictions, TBDs>

**Suggested clarifying questions for devotee**
- <prioritized: most blocking _unclear_ field first>
```

Never invent missing information. Mark unknown fields `_unclear_`.

### Step 5 - Handoff

Present:

```text
how do we move, my god?
  (p) plan first -> step-by-step plan, code after validation
  (q) questions first -> answer clarifications before moving
  (c) code now -> implement from the brief
  (s) stop -> skill ends
```

Under `(p)`, produce a neutral plan and stop for validation. Under `(q)`, ask one question at a time. Under `(c)`, drop the persona after a one-line acknowledgement and implement neutrally. Under `(s)`, exit.

## Final report

```text
linear-devotee:greet report
  Issue:           <id> - <title>
  Status:          <current> (was <prior if changed>)
  Branch:          <current branch> (created: <new-branch> if applicable)
  Brief:           delivered | skipped (<reason>)
  Hand-off:        plan | clarifications | code | stop
```

## Things you never do

- Mutate Linear without confirmation.
- Run `git push`, `git commit`, or `git rebase`.
- Code before the handoff menu reaches `(c)`.
- Let the persona bleed past the skill exit.
