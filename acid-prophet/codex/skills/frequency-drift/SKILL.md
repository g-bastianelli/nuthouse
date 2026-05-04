---
name: frequency-drift
description: Use on a feature branch before or during PR creation to detect drift between the PR diff and the SDD Acceptance criteria of the linked Linear project. Reads spec from repo or retro-engineers from Linear, compares against git diff, generates a drift report, and optionally posts it as a PR comment.
---

# Acid Prophet: frequency-drift for Codex

## Voice

Read `../../../persona.md` at the start of this skill. The voice defined there is canonical for the `acid-prophet` plugin and applies to all output of this skill.

**Scope:** local to this skill's execution. Once the final report is printed, revert to the session default voice.

This skill is **rigid** - execute the steps in order.

## Language

Adapt all output to match the user's language. If the user writes in French, respond in French; if English, in English; if mixed, follow their lead. Technical identifiers, file paths, code symbols, CLI flags, and tool names stay in their original form.

## When you're invoked

The user is on a feature branch and wants to verify that the implementation matches the original SDD spec before or during PR creation.

## Workflow

### Step 0 - Track progress

Create an `update_plan` checklist with:

1. Resolve context.
2. Fetch reference spec.
3. Get diff.
4. Drift analysis.
5. Report.

Mark each item `in_progress` when starting and `completed` when done.

### Step 1 - Resolve context

Find the Linear project ID and local spec file. Try in order:

1. Search `docs/acid-prophet/specs/` for `.md` files with a `linear-project:` frontmatter field that is not `_none_`. If found, capture the path and project ID.
2. Read the current branch name. If it contains a Linear issue identifier (e.g. `feat/NUT-42-auth`), extract the issue ID and query Linear for its parent project.
3. If neither resolves, ask: "🔮 les fréquences sont silencieuses — quel est l'ID du projet Linear ?"

### Step 2 - Fetch reference spec

Using available Linear tools, fetch for the resolved project:
- Project name and description
- Attachments (titles and URLs)
- Milestones (names and descriptions)
- All issues: extract `Goal`, `Acceptance`, and `Constraints` sections from each issue description

If a local spec file was found in Step 1, read it and merge with the Linear data — spec file provides structure, Linear issues provide Acceptance criteria as ground truth.

If no spec file exists, warn: "🔮 pas de spec file — reconstitué depuis Linear"

### Step 3 - Get diff

Run `git diff main...HEAD`. If the diff is empty, stop with:
> "🔮 aucun diff détecté — les fréquences ne bougent pas. rien à vérifier."

### Step 4 - Drift analysis

Compare the diff against all Acceptance criteria from the issues. For each criterion, classify as:
- **CLEAN**: diff clearly satisfies it
- **DRIFT**: diff contradicts or violates it (explain how, quote the diff)
- **AMBIGUOUS**: diff partially addresses it or coverage is unclear (explain what's missing)
- **UNRELATED**: diff doesn't touch the code path for this criterion

Format:
```
  issue <ID> (<title>)
    Acceptance: "<criterion text>"
    → <classification and explanation>
```

End with: `<N> drift · <N> ambiguous · <N> clean · <N> unrelated`

### Step 5 - Report

Print the full drift report inline with a voice line header.

If zero drifts and zero ambiguous: "les fréquences s'alignent. tout est propre. 🔮"

If drifts or ambiguous items exist and `gh` CLI is available, ask:
> "poster en commentaire sur la PR ? (y/n)"

On `y`: run `gh pr comment --body "<report>"`.

## Final report

Print one short voice line from `persona.md`, then:

```text
acid-prophet:frequency-drift report
  Branch:      <current branch>
  Project:     <project name> (<project ID>)
  Spec file:   <path | reconstructed from Linear>
  Drift:       <N confirmed · N ambiguous · N clean · N unrelated>
  PR comment:  <posted | skipped | gh unavailable | no drift>
```

## Things you never do

- Run `git push`, `git rebase`, or `git commit`.
- Mutate Linear issues, projects, or the spec file.
- Post a PR comment without explicit user confirmation.
- Skip Step 0 preconditions.
- Let the persona voice bleed after the final report.
