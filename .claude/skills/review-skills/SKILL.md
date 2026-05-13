---
name: review-skills
description: Use when the user wants to review the quality of existing nuthouse skills — runs a structural audit then queues selected skills for testing and description optimization via skill-creator. Use when the user says "are my skills good?", "review all skills", "check my skills", "audit quality".
effort: high
---

# review-skills

## Voice

Read `../persona.md` at the start of this skill. The mad-scientist voice is canonical for all output.

**Scope:** local to this skill's execution only. Revert to session default voice once the final report is printed.

## Language

Adapt all output to the user's language. Technical identifiers (file paths, skill names, CLI flags) stay in their original form.

## What this skill does

Two-phase quality pass over all nuthouse plugin skills:

1. **Structure** — runs `/audit` to check conventions (frontmatter, sections, persona pointer, plugin.json). Reports critiques and warnings.
2. **Quality** — lets the user pick which skills to test with `skill-creator:skill-creator` (evals, benchmarks, description optimization). Processes them one by one.

The two phases are independent. If the user only wants structure: point them to `/audit`. If they only want quality: start at Step 3.

## Step 1 — Preconditions

Verify we're in the nuthouse repo:

```bash
test -f .claude-plugin/marketplace.json && echo "ok" || echo "not nuthouse"
```

If not nuthouse: abort with *"ce labo n'est pas le bon."*

## Step 2 — Structural audit

Tell the user: *"phase 1 — j'inspecte la structure. on vérifie les formules."*

Dispatch `/audit` by invoking the `audit` skill directly. Let it run and print its report. Do not suppress its output.

After the report, ask:

```
des critiques ou warnings ? veux-tu corriger ça avant de tester la qualité ?
  (y) oui — stop ici, corrige d'abord les critiques
  (n) non — continue vers la phase qualité
```

If `(y)`: exit. Print *"reviens quand le labo est propre. 🧪"*

## Step 3 — Discover plugin skills

Discover all plugin skills (exclude local `.claude/skills/`):

```bash
find . -path "*/skills/*/SKILL.md" \
  ! -path "./.claude/*" \
  ! -path "./_templates/*" \
  | sort
```

Group by plugin. Present the list:

```
skills disponibles pour review qualité :

  acid-prophet
    [1] audit-spec    acid-prophet/skills/audit-spec/SKILL.md
    [2] check-drift   acid-prophet/skills/check-drift/SKILL.md
    [3] write-spec    acid-prophet/skills/write-spec/SKILL.md

  git-gremlin
    [4] commit        git-gremlin/skills/commit/SKILL.md
    [5] pr            git-gremlin/skills/pr/SKILL.md

  ... (full list)

lesquels veux-tu tester ? (numéros séparés par virgule, ou "all")
```

Wait for the user's selection. Parse the response into a queue of `(plugin, skill, path)` tuples.

## Step 4 — Quality review loop

For each skill in the queue, in order:

1. Print: *"skill-creator sur `<plugin>:<skill>` — lancement."*
2. Chain to `skill-creator:skill-creator` with this context:

   > "Audit this existing skill at `<absolute path to SKILL.md>`. The skill is named `<plugin>:<skill>`. Skip the intent-capture interview — the skill draft already exists. Go straight to writing 2-3 test cases, running evals (with-skill vs baseline), and launching the eval viewer. After the user reviews outputs and you've iterated to a good state, run the description optimization loop."

3. Wait for `skill-creator` to finish its loop with this skill.
4. After it returns, print:

   ```
   `<plugin>:<skill>` — done.
   queue restante : <N-1> skill(s)

     (c) continuer — prochain skill : `<plugin>:<next-skill>`
     (s) stop      — assez pour aujourd'hui
   ```

5. If `(c)`: continue with next skill in queue.
6. If `(s)`: exit with final report.

## Step 5 — Final report

```
review-skills — terminé

  Structural audit:  /audit (voir rapport ci-dessus)
  Skills reviewed:   <N> / <total selected>
    <plugin>:<skill> — done
    <plugin>:<skill> — done
    ...
  Skills pending:    <list if stopped early, else "none">
```

Exit with voice line: *"les créatures ont été testées. bonne nuit au labo."*

## Never

- Run `git commit`, `git push`, or `git rebase`.
- Suppress the `/audit` output — let it print in full.
- Run `skill-creator` on multiple skills in parallel — they each need human review.
- Skip the structural audit phase if there are unresolved critiques — quality testing on structurally broken skills is a waste.
- Auto-select "all" without showing the user the list first.
