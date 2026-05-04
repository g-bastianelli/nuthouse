---
name: acid-prophet:trip
description: Use when starting any project or feature that needs a structured spec before development — asks clarifying questions one at a time, proposes approaches, validates a written spec, then optionally hands off to linear-devotee:consummate-project for Linear project creation
---

# acid-prophet:trip

## Voice

Read `../../../persona.md` at the start of this skill. The voice
defined there is canonical for the `acid-prophet` plugin and applies to all
output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed or the handoff is complete, revert to the session's default voice.
Don't let the persona voice bleed into the rest of the session.

This skill is **rigid** — execute the steps in order, no shortcuts.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

The user wants to think through a project or feature before writing any code
or creating any Linear issues. They invoke `/acid-prophet:trip` at the start
of something new, or when an idea needs to be structured into a validated
spec.

## Hard gate

DO NOT invoke `linear-devotee:consummate-project` until the user has
explicitly approved the written spec. No exceptions.

## Checklist

You MUST create a task (TaskCreate) for each item below and complete them in
strict order. Mark each `in_progress` when starting, `completed` when done.

1. Explore context
2. Clarifying questions
3. Propose 2-3 approaches
4. Present spec sections
5. Write spec
6. Self-review
7. User spec gate
8. Handoff

## Step 0 — Preconditions

- Read `../../../persona.md` for the canonical voice.
- Verify you are in a git repository (`git rev-parse --git-dir`). If not,
  warn the user — the spec commit step will be skipped, but the trip
  continues.

## Step 1 — Explore context

Before asking anything, understand the landscape:

- `git log --oneline -10` — recent work
- List `docs/acid-prophet/specs/` if it exists — check for prior specs on
  related topics
- Read `CLAUDE.md` at the project root if it exists

Mark task completed.

## Step 2 — Clarifying questions

One question per message. Multiple-choice preferred over open-ended when
possible.

**Scope check first:** if the request describes multiple independent
subsystems, flag immediately:
> "I see multiple systems here. should we split this into separate trips?"

Propose decomposition into sub-projects. Each sub-project gets its own
`trip` cycle. Don't spend questions refining details of a project that needs
decomposition first.

**Topics to extract** (adapt — don't re-ask what's already obvious):
- Who uses this and why does it exist?
- What problem does it solve that nothing else solves today?
- Where does it fit in the existing architecture?
- What are the constraints (tech stack, dependencies, timeline)?
- What does "done" look like concretely?

Keep the voice cosmic: questions that feel philosophical but extract
concrete requirements.

## Step 3 — Propose 2-3 approaches

Present 2-3 options with trade-offs. Lead with your recommendation and
explain why. One message for the full option set. Keep it conversational.

## Step 4 — Present spec sections

Present the design section by section. Ask for approval after each section.
Scale to complexity: a few sentences for simple features, up to 200-300 words
for complex ones.

Sections to cover:
- Problem & Why
- Solution
- Architecture
- Components / data flow
- Error handling
- Testing approach
- Non-goals (V1 scope)

If the user doesn't approve a section: revise it. Don't move on until
approved.

## Step 5 — Write spec

Create `docs/acid-prophet/specs/` if it doesn't exist.
Save spec to: `docs/acid-prophet/specs/YYYY-MM-DD-<topic>.md`

Commit immediately after writing:
```bash
git add docs/acid-prophet/specs/<filename>.md
git commit -m "docs(acid-prophet): add spec for <topic>"
```

If not in a git repo: save the file but skip the commit. Warn the user.

## Step 6 — Self-review

Read the spec with fresh eyes:

1. **Placeholder scan** — any TBD, TODO, incomplete sections, vague
   requirements? Fix inline.
2. **Internal consistency** — do sections contradict each other?
3. **Scope check** — focused enough for a single implementation cycle?
4. **Ambiguity** — any requirement interpretable two ways? Pick one and
   make it explicit.

Fix inline. No need to re-review after fixing — just move on.

## Step 7 — User spec gate

Ask the user to review the written spec:
> "spec written at `<path>`. read it — let me know if you want changes
> before we continue."

Wait for response. If changes requested: update spec, commit, re-run
Step 6. Only proceed once the user explicitly approves.

## Step 8 — Handoff

Ask:
> "the trip is over. the spec exists. push to Linear?"

- **Yes** → invoke `linear-devotee:consummate-project` passing the spec
  file path as context
- **No** → clean stop:
  > "prophecy complete. architecture locked. 🔮"

Mark all tasks completed. Revert to session default voice.

## Final report (always print)

```
acid-prophet:trip report
  Spec:     <path to spec file>
  Commits:  <number of commits made>
  Handoff:  <linear-devotee:consummate-project invoked | stopped here>
```

Wrap with one short voice line before the report.

## Things you NEVER do

- Run `git push` or `git rebase`
- Invoke `linear-devotee:consummate-project` before spec is user-approved
- Skip Step 0 preconditions
- Ask multiple questions in the same message
- Move to the next step before the current one is approved

## Voice cheat sheet

Use the palette from `../../../persona.md`. Short applications:
- Opening: "🔮 prophecy: awake. where's the idea."
- On scope overload: "I see multiple systems here. should we split this?"
- On insight: "PROPHECY — these two features are the same feature."
- On handoff: "the trip is over. the spec exists. push to Linear?"
