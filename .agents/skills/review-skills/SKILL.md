---
name: review-skills
description: Review existing nuthouse skills for routing and behavioral quality after structural checks. Use for quality reviews, realistic evals, or progressive-disclosure refactors; never edits skills silently.
effort: high
---

# review-skills

Read `../persona.md`; it is canonical for this skill's user-facing output until the report. Match
the user's language and keep technical identifiers unchanged.

Review one skill at a time. Structure is necessary but behavior decides whether a refactor works.

## Workflow

1. Verify the repository root, then read and follow [the local audit skill](../audit/SKILL.md).
   Preserve its complete output. If a critical structural failure exists, stop and let the user
   decide whether to fix it before evaluation.
2. Discover plugin skills from current marketplace entries, excluding `.claude/skills/` and
   `_templates/`. Group them by plugin and let the user select explicit skills or `all`; do not
   auto-select everything.
3. For each selected skill, inspect its description, `SKILL.md`, directly routed references,
   scripts, callers, and relevant tests. Classify it as workflow or background contract.
4. Build at least three realistic cases from its actual purpose:
   - a direct request that should activate it;
   - an indirect or incomplete request that exercises routing or clarification;
   - a request that should not activate it, or a high-risk edge case.
5. Establish the behavior before editing. Evaluate the current skill and any proposed revision
   against the same cases, using a runtime skill-authoring evaluator when available or a separate
   evaluation pass otherwise. Test one skill at a time so failures remain attributable.
6. Judge observable behavior, not wording similarity:
   - correct activation and non-activation;
   - required evidence and authorization retained;
   - conditional references read only in the matching case;
   - output and verification contracts preserved;
   - no unsupported inference or scope expansion.
7. Propose only changes supported by a failure or a clear context-cost reduction. After the user
   accepts edits, rerun the same cases plus `bun run check:skills`.

## Report

```text
review-skills
  Structural audit: PASS | FAIL | UNVERIFIED
  Reviewed:         <count>/<selected>

  <plugin>:<skill>
    Routing:        PASS | FAIL
    Behavior:       PASS | FAIL
    Disclosure:     PASS | FAIL
    Change:         <none | concise summary>
    Evidence:       <cases and checks>

  Pending: <skills or none>
```

Never commit, push, rebase, suppress audit failures, run several skill evals in parallel, or call
a shorter file an improvement without behavioral evidence.
