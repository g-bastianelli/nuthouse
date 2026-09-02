---
name: check-drift
description: Use during issue planning or on a feature branch before/during PR creation to detect drift against the authoritative SDD Acceptance and constraints. Planned-intent mode writes a local drift report; branch mode can optionally post it as a PR comment.
argument-hint: "[--plan <path> --spec <path>]"
effort: high
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Read, Write, Glob, Grep, Agent
paths: ["docs/acid-prophet/**"]
disallowed-tools: Edit, NotebookEdit
---

# acid-prophet:check-drift

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

Rigid drift-detection gate. Match the user's language; keep technical identifiers unchanged.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -15`

## Workflow

### Planned-intent mode

Use this mode when `linear-devotee:plan` supplies both named artifact paths before
implementation:

```text
PLAN_FILE: <absolute path>
SPEC_FILE: <absolute path>
```

1. Require `PLAN_FILE` and `SPEC_FILE` to exist and be readable; a missing artifact blocks.
   Artifacts travel by absolute path — never reconstruct one from conversation prose.
2. Read both. This analysis is read-only with respect to the plan, source spec, repository
   code, Linear, and GitHub.
3. Compare planned intent (Files, Acceptance traceability, Steps, Verify, Risks, and Out
   of scope) against the source spec's Problem/Solution, Architecture, Constraints,
   Error handling, active Acceptance, Testing approach, and Non-goals. Classify every
   active `AC-###` and normative constraint as `CLEAN | DRIFT | AMBIGUOUS | UNRELATED`.
   A project-plan conflict is `DRIFT`; missing evidence is `AMBIGUOUS`.
4. Write only the report artifact, as JSON, to
   `${CLAUDE_PLUGIN_DATA}/issue-delivery-drift-<plan-slug>.json`. Include the plan and spec
   paths, stable findings, counts, and `status: clean | blocked`; never include prompt text,
   source contents, Linear bodies, secrets, or complete logs.
5. Return:

   ```text
   DRIFT_EVIDENCE: { path: <absolute report path>, status: <clean | blocked> }
   ```

   Any `DRIFT`/`AMBIGUOUS` finding produces `status: blocked`. Never patch the spec or
   offer a PR comment in this mode. Return after the evidence report; do not continue to
   branch mode.

### Branch / PR mode

1. Preconditions:
   - Verify git repo (`git rev-parse --git-dir`). Abort if not in a repo.
   - Check `gh` CLI: `gh --version`. If missing, note "gh not found — PR comment will be skipped." Continue regardless.
2. Resolve context:
   - Capture `BRANCH_ISSUE_ID` from the `Branch` line in `## Context` if the branch name contains a Linear identifier. The `Recent commits` line gives a first read of what the branch claims to deliver.
   - Scan `docs/acid-prophet/specs/` for `.md` files. Select best spec match, in priority order: (1) `linear-project:` equals resolved `PROJECT_ID`, (2) `PROJECT_ID` appears in body, (3) `BRANCH_ISSUE_ID` appears in body, (4) filename slug matches closely. If ambiguity remains, ask.
   - If no spec found and `BRANCH_ISSUE_ID` exists, query `mcp__claude_ai_Linear__get_issue` to resolve `PROJECT_ID`/`PROJECT_NAME`, then re-check spec candidates.
   - If nothing resolves, ask for the Linear project ID. Re-check after answer.
   - Set `PRIMARY_REFERENCE = spec file <path>` or `linear (no spec found)`. Spec file always wins; never overwrite with Linear context once set.
3. Fetch reference:
   - **Spec file**: read `SPEC_FILE`; extract Goal/Problem, Solution, Constraints, and Non-goals/Edges. Scope Acceptance extraction to the section headed exactly `Acceptance` (case-insensitive), stopping at the next heading of the same or higher level; exclude `Acceptance history`. Fetch only project name from Linear if needed (`mcp__claude_ai_Linear__get_project`).
   - **Linear fallback** (no spec found): dispatch a general-purpose Agent to fetch project details, attachments, milestones, and all issue descriptions (Goal, Acceptance, Constraints sections). Capture as `REFERENCE_CONTEXT`.
   - **Unresolved clarification markers**: when reference is the spec file, grep it for `[NEEDS CLARIFICATION:` occurrences. Capture each line + quoted marker text as `OPEN_MARKERS`. These represent spec debt — any DRIFT classification touching a region with an open marker MUST be re-classified `AMBIGUOUS` (the spec itself never said anything definitive).
4. Get diff: `git diff main...HEAD`. If empty, print final report with `Drift: none (empty diff)`; exit.
5. Drift analysis: dispatch a general-purpose Agent with `REFERENCE_CONTEXT`, `DIFF`, and `REFERENCE_SOURCE`. For each Acceptance criterion or normative Constraint, classify as CLEAN / DRIFT / AMBIGUOUS / UNRELATED. Preserve the stable `AC-###` id in every Acceptance finding; when Linear fallback has no id, label it `AC-UNKNOWN` and classify it AMBIGUOUS rather than inventing one. Format per finding: `source <path|id> · <AC-###|constraint> — "<criterion>" → <classification + explanation>`. End with `<N> drift · <N> ambiguous · <N> clean · <N> unrelated`. Capture as `DRIFT_REPORT`.
6. Report:
   - Print drift report inline.
   - If drifts or ambiguous exist and `gh` is available: ask the user if they want to post the report as a PR comment.
     - Yes → `gh pr comment --body "<DRIFT_REPORT>"`. On failure: surface error, suggest manual copy.
     - No → exit.

## A verdict covers every criterion

**EVERY ACTIVE `AC-###` AND NORMATIVE CONSTRAINT GETS AN EXPLICIT CLASSIFICATION, OR THERE IS NO VERDICT.**

| Excuse                                 | Reality                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| "The diff obviously matches the spec"  | Obviously is not a classification. Name each criterion by id.  |
| "That criterion is untouched, skip it" | Untouched is `CLEAN` — a verdict you still have to write down. |
| "Ambiguous is close enough to clean"   | `AMBIGUOUS` blocks. Report it and stop.                        |

## Final Report

```text
acid-prophet:check-drift report
  Branch:      <current>
  Project:     <name> (<PROJECT_ID>)
  Source:      spec file <SPEC_FILE> | linear (fallback)
  Spec file:   <SPEC_FILE | _none_>
  Open markers: <N unresolved [NEEDS CLARIFICATION] | _none_>
  Drift:       <N confirmed · N ambiguous · N clean · N unrelated>
  PR comment:  <posted | skipped | gh unavailable | no drift>
```

## Never

- Mutate Linear issues, projects, or spec files.
- Patch the spec, plan, or repository code while producing `DRIFT_EVIDENCE`.
- Post a PR comment without explicit user confirmation.
- Skip step 1 preconditions.
- Run `git push`, `git rebase`, or `git commit`.
