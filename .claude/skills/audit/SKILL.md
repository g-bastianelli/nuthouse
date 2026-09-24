---
name: audit
description: Audit nuthouse skills, agents, personas, banners, manifests, and progressive-disclosure structure. Use after convention changes or before delivery; reports drift without modifying files.
effort: high
---

# audit

Read `../persona.md`; it is canonical for this skill's user-facing output, and its scope ends
with the final report. Match the user's language and keep technical identifiers unchanged.

This is a read-only audit. It separates mechanically proven failures from semantic findings.

## Workflow

1. Verify the repository root contains `_templates/`, `.claude-plugin/marketplace.json`, and
   `.agents/plugins/marketplace.json`. Stop if the repository contract cannot be found.
2. Run these mechanical gates and retain their exact output:

   ```bash
   bun run check:skills
   bun run check:workflow
   bun run test:meta
   ```

   A missing dependency is `UNVERIFIED`, not a passing check. Do not install dependencies or
   fix files during an audit.

3. Read the `template-meta` blocks in `_templates/skill/`, `_templates/agent/AGENT.md`,
   `_templates/persona/persona.md`, and `_templates/plugin/BANNER_PROMPT.md`.
4. Discover current plugin artifacts from the two marketplace registries; do not infer the
   inventory from remembered plugin names.
5. Read [references/review-criteria.md](references/review-criteria.md), then apply only the
   sections relevant to each discovered artifact. For skills, classify the artifact as a
   workflow or a background contract before reviewing its shape.
6. Report every failure with its exact path and evidence. Do not report stylistic preference as
   a defect and do not require optional sections merely because a template demonstrates them.

## Report

```text
audit — nuthouse

Mechanical gates
  check:skills:   PASS | FAIL | UNVERIFIED — <evidence>
  check:workflow: PASS | FAIL | UNVERIFIED — <evidence>
  test:meta:      PASS | FAIL | UNVERIFIED — <evidence>

<plugin>
  CRITICAL <path> — <broken invariant and evidence>
  WARNING  <path> — <quality risk and evidence>
  OK       <artifact group>

Totals: <critical> critical · <warning> warnings · <ok> ok
```

If no critical or warning remains, say the repository is conformant. Never edit, commit, push,
rebase, invent missing evidence, or turn a failed command into a semantic guess.
