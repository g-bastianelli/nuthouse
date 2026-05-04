# acid-prophet:frequency-drift — Spec

**Date**: 2026-05-04
**Plugin**: `acid-prophet`
**Skill**: `frequency-drift`
**Status**: approved

---

## Problem & Why

When a developer implements a feature, code reality silently diverges from the initial SDD spec. Today nothing detects this drift: Linear issues keep their original `Acceptance` criteria, the spec file in the repo is never updated, and feature documentation becomes stale from the first commit.

The real cost: Linear issues no longer reflect what was built, specs become documented lies, and future developers read specs that no longer match the code.

What's missing: an agent that, when a PR is opened, automatically compares the diff against the acceptance criteria of the linked SDD issues and alerts the developer before the drift is silently merged.

---

## Solution

A new skill `acid-prophet:frequency-drift`, invoked manually in Claude Code on a feature branch before or during PR creation:

```
/acid-prophet:frequency-drift
```

Flow:
1. Reads the spec file in the repo (resolves via `linear-project` frontmatter or branch name convention `feat/NUT-42-xxx`)
2. Calls `linear-devotee:seer` to fetch the `Acceptance` criteria of SDD issues linked to the Linear project
3. Compares against `git diff main...HEAD`
4. Generates a structured drift report — per issue, per `Acceptance` criterion
5. Posts the report as a PR comment via `gh pr comment` (with user confirmation)

The developer reads the report and decides: fix the code, or manually update the spec and Linear issues. The skill never mutates anything without confirmation.

---

## Architecture

```
acid-prophet:frequency-drift (skill)
    ↓
[1] Context resolution
    — branch name → linear-project ID (via spec file frontmatter OR feat/NUT-42-xxx convention)
    — git diff main...HEAD → modified files + content
    ↓
[2] Subagent: spec-reader
    — reads local spec .md (Goal, Acceptance, Constraints sections)
    ↓
[3] Subagent: linear-devotee:seer (existing)
    — fetches SDD issues linked to the Linear project
    — extracts Acceptance section from each issue
    ↓
[4] Drift analysis (inline, no subagent)
    — compares diff vs Acceptance criteria
    — produces drift list: issue ID + criterion + drift nature
    ↓
[5] Report
    — displayed inline in Claude Code
    — posted to PR via `gh pr comment` (with user confirmation)
```

No Linear mutation. No spec modification. The skill is **read-only + report** — all actions remain human.

---

## Components / Data flow

**Spec file frontmatter** (standardized format produced by `acid-prophet:trip`):

```yaml
---
id: FEAT-042
status: draft | ready | implemented | stale
linear-project: NUT-xxx
verified-by: tests/feature.spec.ts
last-reviewed: 2026-05-04
---
```

The `linear-project` field is the pivot link. Without it, the skill attempts resolution via branch name: `feat/NUT-42-xxx` → issue `NUT-42` → Linear project parent of that issue → fetch all project issues. The branch name encodes an issue ID, not a project ID; the project is derived by querying Linear for the issue's parent project.

**Drift report format**:

```
drift detected — NUT-42 auth feature

  issue NUT-42-03 (Login flow)
    Acceptance: "WHEN user submits invalid credentials THE SYSTEM SHALL return 401"
    → drift: handler returns 400, not 401

  issue NUT-42-07 (Session expiry)
    Acceptance: "WHEN token expires THE SYSTEM SHALL redirect to /login"
    → no redirect found in diff — implementation missing or in another PR?

  1 confirmed drift · 1 ambiguous · 0 clean
```

**Retro-engineering (when no spec file exists)**:

When no local spec file is found but a Linear project is identified, the skill reconstructs a virtual spec from:

```
Linear project
  ├── project description (global vision)
  ├── attachments (design docs, Figma, external specs...)
  ├── milestones (high-level breakdown)
  └── SDD issues
        ├── Goal
        ├── Acceptance  ← key for drift
        └── Constraints
```

The project provides the "why", milestones the "what", issues the "how to verify".

---

## Error handling

| Situation | Behavior |
|---|---|
| No spec file + Linear project found | Retro-engineer from project (description + attachments) + milestones + SDD issues → virtual spec. Warning: "no spec file — reconstructed from Linear" |
| No spec file + no Linear project | Stop: "no spec found — run `acid-prophet:trip` first" |
| Spec file AND Linear — both exist | Merge: spec file as structure, issue Acceptance + attachments as drift reference |
| Linear project with no SDD issues | Warning + drift check against description + attachments only |
| `linear-devotee:seer` project not found | Stop: "Linear project NUT-xxx not found — check the ID in spec frontmatter" |
| No Linear ID in frontmatter AND branch has no ID | Ask for Linear ID manually before continuing |
| `gh pr comment` fails (no open PR) | Display report inline only, no fatal error |
| Empty diff (`main...HEAD` identical) | Stop: "no diff detected — nothing to check" |

Principle: **fail loud, never silent**. If context is ambiguous, the skill asks rather than continuing with assumptions.

---

## V1 Constraints

**Hard dependency**: `linear-devotee:consummate-project` must patch the spec file frontmatter with `linear-project: NUT-xxx` immediately after Linear project creation. Without this, `acid-prophet:frequency-drift` cannot resolve context automatically and always falls back to branch name convention.

This is an explicit V1 implementation requirement — all three pieces must ship together for the full flow to work:

1. **`acid-prophet:trip`** updated to generate standardized frontmatter (`id`, `status`, `linear-project`, `verified-by`, `last-reviewed`) in every spec file it produces
2. **`linear-devotee:consummate-project`** patching the spec file frontmatter with `linear-project: NUT-xxx` after project creation
3. **`acid-prophet:frequency-drift`** new skill (this spec)

---

## Testing approach

No Node helpers in V1 → no `bun test` suite at scaffold time. Manual scenarios only:

**Scenario 1 — happy path**
Repo with spec file + Linear project + SDD issues + real diff → verify the drift report correctly identifies Acceptance criteria that drift.

**Scenario 2 — retro-engineering**
Repo without spec file, well-formed Linear project (description + attachments + SDD issues) → verify the reconstructed virtual spec is coherent and drift check works against it.

**Scenario 3 — fallbacks**
- Branch without Linear ID + no frontmatter → verify skill asks for ID manually
- Empty diff → verify clean stop
- `gh pr comment` without open PR → verify report displays inline without crash

**Scenario 4 — end-to-end integration**
`acid-prophet:trip` → `linear-devotee:consummate-project` (patches frontmatter) → code → `acid-prophet:frequency-drift` → report on PR.

If Node helpers are added later (frontmatter parsing, diff normalization): tests go in `acid-prophet/claudecode/tests/`.

---

## Non-goals (V1)

- No automatic mutation — the skill does not modify the spec, Linear issues, or code
- No GitHub Actions / webhook — manual invocation via Claude Code only
- No multi-PR support — one PR at a time, no cross-branch comparison
- No drift severity scoring or ranking
- No automatic fix suggestions — the skill detects, it does not repair
- No Codex / Copilot support in V1 — Claude Code only

---

## Open questions

None — all fields resolved during brainstorming session.
