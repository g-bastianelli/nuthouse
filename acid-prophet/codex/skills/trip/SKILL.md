---
name: trip
description: Use when starting a project or feature in Codex that needs a structured spec before development or Linear creation. Asks clarifying questions one at a time, proposes approaches, validates a written spec, then optionally hands off to linear-devotee:consummate-project.
---

# Acid Prophet for Codex

## Voice

Read `../../../persona.md` at the start of this skill. The voice defined there is canonical for the `acid-prophet` plugin and applies to all output of this skill.

**Scope:** local to this skill's execution. Once the final report is printed or the handoff is complete, revert to the session default voice.

This skill is **rigid** - execute the steps in order.

## Language

Adapt all output to match the user's language. If the user writes in French, respond in French; if English, in English; if mixed, follow their lead. Technical identifiers, file paths, code symbols, CLI flags, and tool names stay in their original form.

## When you're invoked

The user wants to turn a raw project or feature idea into a reviewed spec before writing code or creating Linear work.

## Hard gate

Do not invoke or suggest `linear-devotee:consummate-project` until the written spec has been explicitly approved by the user.

## Workflow

### Step 0 - Track progress

Create an `update_plan` checklist with:

1. Explore context.
2. Ask clarifying questions.
3. Propose approaches.
4. Present spec sections.
5. Write and review spec.
6. Gate Linear handoff.
7. Print final report.

Mark each item `in_progress` when starting and `completed` when done.

### Step 1 - Explore context

Before asking questions:

- Read applicable local instructions: `AGENTS.md`, `CLAUDE.md`, and nearby README files.
- Run read-only context commands through the local command wrapper when one is documented, for example `rtk git log --oneline -10` in this repository.
- List `docs/acid-prophet/specs/` if it exists.
- Note whether the current directory is inside a git repository with `git rev-parse --is-inside-work-tree`.

### Step 2 - Clarifying questions

Ask one question per message. Multiple choice is preferred when it reduces friction.

Scope check first. If the request describes multiple independent systems, stop and propose a split into separate trips before refining details.

Extract only missing information:

- Who uses this and why it exists.
- The current pain or gap.
- Where it fits in the existing architecture.
- Constraints: stack, dependencies, timeline, compliance, capacity.
- Concrete success criteria.
- Explicit non-goals.

### Step 3 - Propose 2-3 approaches

Present 2-3 approaches with tradeoffs. Lead with the recommended approach and explain why it fits the context. Ask the user to choose or approve the recommendation.

### Step 4 - Present spec sections

Present the spec section by section and ask for approval after each section. Do not move to the next section until the current one is approved or revised.

Cover:

- Problem & why.
- Solution.
- Architecture.
- Components and data flow.
- Error handling.
- Testing approach.
- Non-goals.

### Step 5 - Write the spec

Create `docs/acid-prophet/specs/` if missing. Save the spec to:

```text
docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md
```

The spec file MUST begin with this YAML frontmatter block before any markdown content:

```yaml
---
id: <topic-slug>
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: YYYY-MM-DD
---
```

- `id`: slugified topic name, e.g. `auth-refresh-flow`
- `status`: always `draft` at creation time
- `linear-project`: always `_none_` — patched by `linear-devotee:consummate-project` after project creation
- `verified-by`: always `_none_` — to be filled when tests are written
- `last-reviewed`: today's date in ISO format

Use the current date from the session context. Do not run `git push` or `git rebase`. Do not commit unless the user explicitly asks for commits in the current session.

### Step 6 - Self-review

Read the written spec and fix issues inline:

- Placeholder scan: no `TBD`, `TODO`, `FIXME`, `???`, or vague requirements.
- Internal consistency: sections must not contradict each other.
- Scope check: focused enough for one implementation cycle.
- Ambiguity check: if a requirement could mean two things, choose one and state it.

### Step 7 - User spec gate

Ask the user to review the written spec:

```text
spec written at `<path>`. read it - let me know if you want changes before we continue.
```

If changes are requested, patch the spec and repeat Step 6. Only proceed after explicit approval.

### Step 8 - Handoff

Ask:

```text
the trip is over. the spec exists. push to Linear?
```

- Yes: tell the user to invoke `linear-devotee:consummate-project <spec-path>` or invoke that skill if the runtime supports skill chaining.
- No: stop cleanly.

## Final report

Print one short voice line from `persona.md`, then:

```text
acid-prophet:trip report
  Spec:     <path to spec file>
  Commits:  skipped | <commit hash if explicitly requested>
  Handoff:  linear-devotee:consummate-project suggested | stopped here
```

## Things you never do

- Ask multiple clarifying questions in the same message.
- Move past an approval gate without approval.
- Mutate Linear from this skill.
- Run `git push`, `git rebase`, or silent commits.
- Let the persona voice bleed after the final report.
