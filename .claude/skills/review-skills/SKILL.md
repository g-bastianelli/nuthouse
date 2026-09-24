---
name: review-skills
description: Reviews nuthouse plugin skills against Anthropic's Agent Skills best practices, Codex's skill rules and cross-runtime pitfalls, and the repo's house rules (persona voice, English files, chaining, named laws). Runs a deterministic check, then parallel read-only reviewers, and reports verified findings with rule ids and sources. Use when the user asks whether skills are good, to review, audit, or check skills, or before releasing skill changes.
argument-hint: "[all | <plugin> | <plugin>:<skill>]"
effort: high
---

# review-skills

## Voice

Read `../persona.md` at the start of this skill. The mad-scientist voice is canonical for
every user-facing string; its scope ends with the final report or the hand-off menu.

## Language

Adapt all output to the user's language. Technical identifiers (file paths, skill names,
rule ids, CLI flags) stay in their original form.

## What this skill decides

`references/rules.md` is the rule catalogue: `A` rules from Anthropic and Claude Code, `C`
rules from Codex and cross-runtime behavior, `N` rules from this repo's `CLAUDE.md`, ADR
0007, and each plugin's `persona.md`. Every rule has an id, a type (`mech` or `judgment`),
a severity, and a source. Read it before step 3.

`scripts/check-skills.mjs` decides every `mech` rule. Reviewers decide `judgment` rules.
Banners, agents, and personas belong to `/audit`, not here.

## Workflow

1. **Preconditions.** Confirm `.claude-plugin/marketplace.json` exists; otherwise stop with
   _"ce labo n'est pas le bon."_ Read the `Verified` date in `references/rules.md`. When it is
   more than 90 days old, say so and offer to re-verify the sources (dispatch
   `claude-code-guide` for Anthropic, a web-research agent for Codex) before trusting any
   finding that depends on runtime behavior.

2. **Scope.** Use the user's request (`$ARGUMENTS` on Claude Code): `all`, a plugin, or
   `<plugin>:<skill>`. With no scope given, list the plugins with their skill counts and ask.
   Never assume `all` without showing that list.

3. **Mechanical pass.** Run both, and keep their output out of the reviewers' job:

   ```bash
   node .claude/skills/review-skills/scripts/check-skills.mjs --json
   bun run check:duplication
   ```

   Keep the findings for the skills in scope, plus the repo-wide `global` findings (C12).
   A duplication failure is an `N11` finding on each file it names.

4. **Judgment pass.** Dispatch one read-only reviewer per plugin in scope, in parallel, in a
   single message: at most 8 agents. Use `general-purpose`. Brief each one in SDD form:
   - **Goal:** review these skills against the `judgment` rules of `references/rules.md`
     (absolute path). Do not edit, create, or delete any file.
   - **Inputs:** the absolute SKILL.md paths, the plugin's `persona.md`, and the
     mechanical findings already recorded for those skills. Do not repeat a mech finding.
   - **Skip:** a `genre: contract` skill is exempt from voice, workflow, and user-facing
     rules (the catalogue says which).
   - **Output:** one line per finding: `rule id | severity | skill | file:line | quoted
evidence | one-sentence fix`. Severity comes from the catalogue, never invented. No
     quoted line, no finding. Cap at 12 findings per skill, most severe first.

5. **Verify.** For every judgment finding rated CRITIQUE or WARNING, open the cited line
   yourself and confirm the quote and the rule. Drop what does not survive, and count the
   drops. A finding the reviewer could not quote is dropped, not softened.

6. **Report**, then the hand-off menu.

## Final Report

Plain structure, one or two voice lines around it:

```text
review-skills — <scope>

<plugin>:<skill>
  ❌ <id> <message> (<file>:<line>) — <fix>
  ⚠️  <id> <message> (<file>:<line>) — <fix>
  · <id> <message>

repo-wide
  ⚠️  C12 <message>

<N> critiques · <N> warnings · <N> info · <N> skills · <N> reviewer findings dropped
sources verified <date> — references/rules.md
```

Order skills by their worst finding. Collapse every `C05` into one line per skill.

```text
la dissection est finie. que fait-on des organes ?
  (f) fix    → apply the fixes the user picks, in this session
  (e) evals  → run skill-creator on chosen skills, one at a time
  (s) stop   → leave the report as it is
```

- **(f)** Apply only the fixes the user named. Re-run step 3 afterwards and show the
  delta. A fix that changes a plugin's content needs its version bumped before release:
  **REQUIRED SUB-SKILL:** Use `release` when the user is ready to release.
- **(e)** For each chosen skill, in order, chain to `skill-creator:skill-creator` with:
  _"Audit the existing skill at `<absolute path>`, named `<plugin>:<skill>`. Skip the
  intent interview. Write 2–3 test cases that cover the findings above, run with-skill vs
  baseline evals, open the viewer, and after the user's review run the description
  optimization loop."_ Ask `(c) continuer / (s) stop` between skills.
- **(s)** Exit with _"les créatures ont été disséquées. bonne nuit au labo."_

## Never

- Edit a skill before the user picks `(f)`, or run `git commit`, `git push`, `git rebase`.
- Report a judgment finding without a quoted line, or overrule a `mech` result.
- Run `skill-creator` on several skills in parallel: each needs the user's review.
- Invent a rule, threshold, or source that `references/rules.md` does not carry. A gap in
  the catalogue is reported as a gap, then fixed in the catalogue with its source.
