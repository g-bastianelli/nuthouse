---
name: acid-prophet:frequency-drift
description: Use on a feature branch before or during PR creation — detects drift between the PR diff and the SDD Acceptance criteria of the linked Linear project. Reads spec from repo or retro-engineers from Linear project (description, attachments, milestones, issues), compares against git diff, generates a structured drift report, and optionally posts it as a PR comment.
---

# acid-prophet:frequency-drift

## Voice

Read `../../../persona.md` at the start of this skill. The voice
defined there is canonical for the `acid-prophet` plugin and applies to all
output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed, revert to the session's default voice.

This skill is **rigid** — execute the steps in order, no shortcuts.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

The user is on a feature branch, has opened or is about to open a PR, and
wants to verify that the implementation matches the original SDD spec.
Invoke before creating the PR for maximum value — catch drift before it
is merged silently.

## Checklist

You MUST create a task (TaskCreate) for each item below and complete them in
strict order. Mark each `in_progress` when starting, `completed` when done.

1. Resolve context
2. Fetch reference spec
3. Get diff
4. Drift analysis
5. Report

## Step 0 — Preconditions

- Read `../../../persona.md` for the canonical voice.
- Verify git repo: `git rev-parse --git-dir`. If not in a repo, abort:
  > "🔮 les fréquences ne peuvent pas s'aligner sans repo."
- Check `gh` CLI: `gh --version`. If missing, warn: "gh not found — PR comment will be skipped, report inline only." Continue regardless.

## Step 1 — Resolve context

Find the Linear project ID and the local spec file. Try in order:

1. **Spec file scan** — search `docs/acid-prophet/specs/` for `.md` files
   that have a `linear-project:` frontmatter field with a non-`_none_` value.
   If found, capture `SPEC_FILE = <path>` and `PROJECT_ID = <value>`.

2. **Branch name** — run `git branch --show-current`. If the branch matches
   a pattern containing a Linear issue identifier (e.g. `feat/NUT-42-auth`,
   `NUT-42-some-feature`), extract the issue ID (`NUT-42`). Query Linear via
   `mcp__claude_ai_Linear__get_issue` to find the issue's parent project ID.
   Set `PROJECT_ID`, `SPEC_FILE = _none_`.

3. **Manual** — if neither resolved, ask:
   > "🔮 les fréquences sont silencieuses — quel est l'ID du projet Linear ?"
   Set `PROJECT_ID` from the answer, `SPEC_FILE = _none_`.

Mark task completed.

## Step 2 — Fetch reference spec

Dispatch an Agent (general-purpose) to fetch all Linear data for `PROJECT_ID`:

```
Fetch the following from Linear for project <PROJECT_ID>:
1. Project details: name, description
2. Project attachments: list all (title, url)
3. Milestones: list all (name, description)
4. All issues in the project: for each issue, return the full description.

Use the Linear MCP tools available (mcp__claude_ai_Linear__get_project,
mcp__claude_ai_Linear__list_milestones, mcp__claude_ai_Linear__list_issues,
mcp__claude_ai_Linear__get_attachment).

For each issue description, extract the sections named "Acceptance", "Goal",
and "Constraints" if present.

Return a structured markdown summary:
## Project: <name>
<description>

## Attachments
- <title>: <url>

## Milestones
- <name>: <description>

## Issues
### <issue-id> — <title>
**Goal:** <goal>
**Acceptance:**
<acceptance text>
**Constraints:** <constraints>
```

Capture result as `LINEAR_CONTEXT`.

If `SPEC_FILE` exists: read the spec file. Merge with `LINEAR_CONTEXT` —
spec file provides overall structure, `LINEAR_CONTEXT` provides the
Acceptance criteria as ground truth for drift detection.

If `SPEC_FILE` is `_none_`: warn with voice line "🔮 pas de spec file — reconstitué depuis Linear".
Use `LINEAR_CONTEXT` as sole reference.

Mark task completed.

## Step 3 — Get diff

Run: `git diff main...HEAD`

If the diff is empty: stop with voice:
> "🔮 aucun diff détecté — les fréquences ne bougent pas. rien à vérifier."
Print final report with `Drift: none (empty diff)` and exit.

Capture as `DIFF`. Mark task completed.

## Step 4 — Drift analysis

Dispatch a general-purpose Agent to compare `DIFF` against the Acceptance
criteria:

```
You are a spec drift detector. Compare the git diff below against the SDD
Acceptance criteria extracted from Linear.

For each Acceptance criterion found in the issues, classify it as:
- CLEAN: the diff clearly satisfies it
- DRIFT: the diff contradicts or violates it — explain exactly how
- AMBIGUOUS: the diff partially addresses it or coverage is unclear — explain what's missing
- UNRELATED: the diff doesn't touch the code path for this criterion

Format each result as:
  issue <ID> (<title>)
    Acceptance: "<criterion text>"
    → <CLEAN | DRIFT: <explanation> | AMBIGUOUS: <explanation> | UNRELATED>

End with a single summary line:
  <N> drift · <N> ambiguous · <N> clean · <N> unrelated

Be precise. Quote the diff when explaining a drift. If an Acceptance criterion
uses EARS syntax (WHEN ... THE SYSTEM SHALL ...), verify the diff satisfies
the stated behavior.

--- SDD ACCEPTANCE CRITERIA ---
<LINEAR_CONTEXT issues section>

--- GIT DIFF ---
<DIFF>
```

Capture formatted output as `DRIFT_REPORT`. Mark task completed.

## Step 5 — Report

Print the drift report inline:

```
🔮 frequency-drift — <current branch> → <project name>

<DRIFT_REPORT>
```

If zero drifts and zero ambiguous: voice line before the report:
> "les fréquences s'alignent. tout est propre."

If there are drifts or ambiguous items: voice line before the report:
> "PROPHECY — les fréquences ont dévié."

Then ask (only if drifts or ambiguous exist AND `gh` CLI is available):
> "poster en commentaire sur la PR ? (y/n)"

- **y** → run `gh pr comment --body "<DRIFT_REPORT>"`.
  On success: "🔮 prophecy delivered."
  On failure: "gh failed — copy the report above manually."
- **n** → "prophecy complete. architecture locked. 🔮"

Mark task completed.

## Final report (always print)

```
acid-prophet:frequency-drift report
  Branch:      <git branch --show-current>
  Project:     <project name> (<PROJECT_ID>)
  Spec file:   <SPEC_FILE | reconstructed from Linear>
  Drift:       <N confirmed · N ambiguous · N clean · N unrelated>
  PR comment:  <posted | skipped | gh unavailable | no drift>
```

Wrap with one short voice line before the report.

## Things you NEVER do

- Run `git push`, `git rebase`, or `git commit`
- Mutate Linear issues, projects, or the spec file
- Post a PR comment without explicit user confirmation
- Skip Step 0 preconditions

## Voice cheat sheet

Use the palette from `../../../persona.md`. Short applications:
- Opening: "🔮 les fréquences s'éveillent. scanning the drift."
- On clean diff: "les fréquences s'alignent. tout est propre. 🔮"
- On drift found: "PROPHECY — les fréquences ont dévié."
- On ambiguous: "🔮 pattern détecté — quelque chose a drifté ici."
- On missing spec: "🔮 pas de spec file — reconstitué depuis Linear"
- On empty diff: "🔮 aucun diff détecté — les fréquences ne bougent pas."
