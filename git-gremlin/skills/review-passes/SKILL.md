---
name: review-passes
description: Portable review pass contract for git-gremlin:review — shared input packet, candidate finding schema, the read-only passes (correctness, convention, tests, risk), and aggregation rules. Background knowledge preloaded into the reviewer host agent; not a user-facing workflow.
user-invocable: false
---

# git-gremlin — review passes

Reusable review pass contract for `git-gremlin:review`.

The caller owns orchestration. Review workers are read-only scouts: they return
candidate findings, not the final report. The caller must deduplicate,
substantiate, severity-rank, and validate the final findings before showing
them to the user.

## Shared input

Every pass receives the same compact packet:

```text
REVIEW_CONTEXT:
<output of scripts/review-context.mjs>

DIFF_COMMAND:
<manifest Diff command>

APPLIED_RULES:
<loaded instruction sources marked applies, summarized when large>

PR_OR_SPEC_CONTEXT:
<PR title/body/base/Linear/spec context if available, otherwise "none">

USER_SCOPE:
<explicit user focus such as staged-only, security, file path, or "full review">
```

The pass may run the `DIFF_COMMAND`, inspect changed files, and read surrounding
code needed to prove or dismiss a candidate. It must not mutate files, git
state, external services, or PR comments.

## Candidate output

Return candidate findings as JSON-like data or concise structured markdown:

```json
{
  "findings": [
    {
      "severity": "BLOCKER | HIGH | MEDIUM | LOW | NIT | INFO",
      "title": "short claim",
      "file": "path/to/file.ts",
      "line": 123,
      "evidence": "diff/source/rule evidence that proves the issue",
      "impact": "concrete failure mode or review risk",
      "rule": "optional instruction source",
      "fix": "minimal direction",
      "confidence": "real | uncertain"
    }
  ],
  "residualRisk": ["what this pass could not inspect"]
}
```

Use `confidence: "real"` only when the claim is supported by local evidence and
concrete impact. Mark plausible but unproven concerns as `uncertain`; the caller
must not promote uncertain candidates into final findings unless it verifies
them independently.

## Passes

### correctness-reviewer

Focus on behavior:

- runtime failures, broken workflows, edge cases, concurrency, data loss
- migrations, backward compatibility, API contracts, serialization
- incorrect assumptions in changed control flow
- regressions visible from tests, fixtures, or existing callers

Ignore style-only preferences unless they create a concrete behavior risk.

### convention-reviewer

Focus on local rules and architecture:

- applied `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `.github/instructions/**`,
  `.cursor/rules/**`, `.codex/**`, `.agents/**`, and equivalent repo rules
- architecture boundaries, dependency direction, ownership, module shape
- local helper reuse, generated-code boundaries, package exports
- rule drift between PR/spec intent and implementation

Never invent a convention. Cite the loaded rule or source pattern that supports
the candidate.

### tests-reviewer

Focus on verification quality:

- missing tests for new behavior or fixed bugs
- tests that cannot fail, assert the wrong layer, or only snapshot noise
- fixture drift, migration coverage, docs/release/API collection updates when
  behavior changed
- likely commands/checks the maintainer should run before merge

Do not demand broad coverage when the diff is documentation-only or mechanical.

### risk-reviewer

Run this pass only when touched files or user scope make it relevant.

Focus on:

- security, privacy, authz/authn, injection, secrets, PII/logging
- performance, N+1 behavior, unbounded work, memory pressure
- accessibility and user-impacting UX regressions for frontend changes
- operational risk: feature flags, deploy order, observability, rollback

Return an empty result when the touched surface does not justify a risk finding.

## Aggregation rules

The caller must:

- prefer the portable multi-pass flow when no callable native review backend is
  available
- keep the full raw diff out of the main context when subagents can read it
  themselves
- merge duplicate candidates by root cause, keeping the clearest evidence
- discard `uncertain` candidates unless locally verified
- validate final report formatting with `scripts/validate-findings.mjs` when
  practical
- report residual risk, including skipped generated files, unavailable PR
  context, missing base refs, or passes not run
