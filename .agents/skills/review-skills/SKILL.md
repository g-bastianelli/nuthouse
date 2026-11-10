---
name: review-skills
description: Review existing nuthouse skills for routing and behavioral quality after structural checks. Use for quality reviews, realistic evals, or progressive-disclosure refactors; never edits skills silently.
effort: high
---

# review-skills

Read `../persona.md`; it is canonical for this skill's user-facing output until the report. Match
the user's language and keep technical identifiers unchanged.

Keep each skill's cases and results attributable. Structure is necessary but behavior decides
whether a refactor works.

## Workflow

1. Verify the repository root, then read and follow [the local audit skill](../audit/SKILL.md).
   Preserve its complete output. If a critical structural failure exists, stop and let the user
   decide whether to fix it before evaluation.
2. Discover plugin skills from current marketplace entries and repository workflows from
   `.agents/skills/*/SKILL.md`. Exclude `.claude/skills/` symlink duplicates and `_templates/`
   from the skill inventory; inspect templates through their callers. Honor the requested scope:
   named skills, plugin-only, repository-only, or `all`. Ask for selection only if the scope is
   ambiguous. Report both groups when `all` is requested.
3. For each selected skill, inspect its description, `SKILL.md`, directly routed references,
   scripts, callers, and relevant tests. Classify it as workflow or background contract.
4. Build at least three realistic cases from its actual purpose:
   - a direct request that should activate it;
   - an indirect or incomplete request that exercises routing or clarification;
   - a request that should not activate it, or a high-risk edge case.
     For orchestration, runtime, or authoring changes, select the relevant cases from
     [references/regression-cases.md](references/regression-cases.md).
5. Establish the behavior before editing. Evaluate the current skill and any proposed revision
   against the same cases, using a runtime skill-authoring evaluator when available or a separate
   evaluation pass otherwise. Label source-based predictions separately from executed runtime
   cases. Independent skills may use isolated evaluators within available capacity; keep a
   skill's baseline and revision on the same cases and never share a mutable test workspace.
6. Judge observable behavior, not wording similarity:
   - correct activation and non-activation;
   - required evidence and authorization retained;
   - conditional references read only in the matching case;
   - output and verification contracts preserved;
   - no unsupported inference or scope expansion.
7. Propose only changes supported by a failure or a clear context-cost reduction. When edits are
   authorized, apply them and rerun the same cases plus `bun run check:skills`. Reuse authorization
   already given for the requested scope.

## Report

```text
review-skills
  Structural audit: PASS | FAIL | UNVERIFIED
  Reviewed:         <count>/<selected>
  Evidence:         runtime execution | source-based review | mixed

  <plugin>:<skill>
    Routing:        PASS | FAIL
    Behavior:       PASS | FAIL
    Disclosure:     PASS | FAIL
    Change:         <none | concise summary>
    Evidence:       <cases and checks>

  Pending: <skills or none>
```

Never commit, push, rebase, suppress audit failures, present a source-based prediction as a
runtime result, or call a shorter file an improvement without behavioral evidence.
