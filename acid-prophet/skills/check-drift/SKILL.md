---
name: check-drift
description: Use on a feature branch before or during PR creation to detect drift between the PR diff and the SDD Acceptance/Constraints of the linked project. Prefers the repo spec markdown as primary truth, falls back to Linear only when no spec markdown is found, generates a drift report, and optionally posts it as a PR comment.
---

# Acid Prophet: frequency-drift for Codex

## Voice

Read `../../persona.md` at the start of this skill. The voice defined there is canonical for the `acid-prophet` plugin and applies to all output of this skill.

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

Find the Linear project ID and primary reference. Capture:
- `PROJECT_ID`
- `PROJECT_NAME` if known
- `SPEC_FILE`
- `PRIMARY_REFERENCE = spec file <path> | linear (no spec found)`

Use working tree contents. Try in order:

1. Read the current branch name. If it contains a Linear issue identifier (e.g. `feat/NUT-42-auth`), capture it as `BRANCH_ISSUE_ID`. Query Linear for that issue only when needed to map it to a parent project ID/name.
2. Search `docs/acid-prophet/specs/` for `.md` files. Select one project spec using the strongest unambiguous match: exact `linear-project:` frontmatter for `PROJECT_ID`, non-`_none_` `linear-project:` when no project is known yet, exact `PROJECT_ID` in markdown body, exact `BRANCH_ISSUE_ID` in markdown body, then filename/project slug convention. If found, set `SPEC_FILE` and `PRIMARY_REFERENCE = spec file <path>`.
3. If no spec file was selected and `BRANCH_ISSUE_ID` exists, query Linear for the issue's parent project, then re-check the spec candidates for exact `PROJECT_ID`, exact `BRANCH_ISSUE_ID`, or project slug/name matches. If one candidate now matches, set `SPEC_FILE` and `PRIMARY_REFERENCE = spec file <path>`; otherwise set `PRIMARY_REFERENCE = linear (no spec found)`.
4. If neither resolves, ask: "🔮 les fréquences sont silencieuses — quel est l'ID du projet Linear ?", then re-check the spec candidates for that exact `PROJECT_ID` or slug. If one candidate matches, set `SPEC_FILE` and `PRIMARY_REFERENCE = spec file <path>`; otherwise set `PRIMARY_REFERENCE = linear (no spec found)`.

If `PRIMARY_REFERENCE` is a spec file, never replace it with Linear issue descriptions later.

### Step 2 - Fetch reference spec

Branch on `PRIMARY_REFERENCE`.

If `PRIMARY_REFERENCE = spec file <path>`:
- Read the spec markdown from the working tree.
- Parse textual markdown sections into `REFERENCE_CONTEXT`; include `Goal` / `Problem & Why` / `Solution`, `Acceptance` or `Acceptance criteria`, `Constraints`, `Non-goals`, and `Edges` when present.
- Preserve prose, bullets, and tables. Do not limit extraction to code blocks or Zod snippets.
- Call Linear only for minimal project metadata needed in the report title (`get_project` for name, if `PROJECT_ID` is known).
- Do not list project issues or fetch issue descriptions.
- Set `REFERENCE_SOURCE = spec file <SPEC_FILE>`.

If `PRIMARY_REFERENCE = linear (no spec found)`:
- Warn: "🔮 pas de spec file — reconstitué depuis Linear".
- Using available Linear tools, fetch project name/description, attachments, milestones, and all issues; extract `Goal`, `Acceptance`, and `Constraints` sections from each issue description.
- Set `REFERENCE_CONTEXT` to the reconstructed Linear context and `REFERENCE_SOURCE = linear (fallback)`.

### Step 3 - Get diff

Run `git diff main...HEAD`. If the diff is empty, stop with:
> "🔮 aucun diff détecté — les fréquences ne bougent pas. rien à vérifier."

### Step 4 - Drift analysis

Compare the diff against `REFERENCE_CONTEXT`.

If `REFERENCE_SOURCE` starts with `spec file`, the repo markdown is primary truth. Compare against textual Acceptance and Constraints from that markdown, and do not infer drift from stale Linear issue descriptions.

If `REFERENCE_SOURCE = linear (fallback)`, compare against the reconstructed Linear context because no spec markdown was found.

For each Acceptance criterion or normative Constraint found in the reference, classify as:
- **CLEAN**: diff clearly satisfies it
- **DRIFT**: diff contradicts or violates it (explain how, quote the diff)
- **AMBIGUOUS**: diff partially addresses it or coverage is unclear (explain what's missing)
- **UNRELATED**: diff doesn't touch the code path for this criterion

Format:
```
  source <spec path | issue ID/title>
    Acceptance/Constraint: "<criterion text>"
    → <classification and explanation>
```

End with: `<N> drift · <N> ambiguous · <N> clean · <N> unrelated`

### Step 5 - Report

Print the full drift report inline with a voice line header and source line:

```text
Source: <REFERENCE_SOURCE>
```

If zero drifts and zero ambiguous: "les fréquences s'alignent. tout est propre. 🔮"

If drifts or ambiguous items exist and `gh` CLI is available, ask:
> "poster en commentaire sur la PR ? (y/n)"

On `y`: run `gh pr comment --body "<report>"`.

## Final report

Print one short voice line from `persona.md`, then:

```text
acid-prophet:check-drift report
  Branch:      <current branch>
  Project:     <project name> (<project ID>)
  Source:      spec file <path> | linear (fallback)
  Spec file:   <path | _none_>
  Drift:       <N confirmed · N ambiguous · N clean · N unrelated>
  PR comment:  <posted | skipped | gh unavailable | no drift>
```

## Things you never do

- Run `git push`, `git rebase`, or `git commit`.
- Mutate Linear issues, projects, or the spec file.
- Post a PR comment without explicit user confirmation.
- Skip Step 0 preconditions.
- Let the persona voice bleed after the final report.
