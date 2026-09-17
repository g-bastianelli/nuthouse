---
name: check-drift
description: Use during issue planning, after a completed implementation block, or before a PR to detect drift against authoritative Acceptance and constraints. Includes committed, staged, unstaged, and relevant untracked changes; detection never edits the source.
argument-hint: "[--plan <path> --spec <path>] [--scope worktree|committed] [--base <ref>]"
effort: high
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git status:*), Bash(git ls-files:*), Bash(git show:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(gh:*), Read, Write, Glob, Grep, Agent
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

### Development / PR mode

Default to `worktree`; use `committed` for the actual PR payload. An automatic
checkpoint is read-only and never interrupts merely to offer a PR comment. Keep
planned-intent mode separate: it does not trigger implementation or reconciliation.

1. Preconditions:
   - Verify git repo (`git rev-parse --git-dir`). Abort if not in a repo.
   - Check `gh` CLI: `gh --version`. If missing, note "gh not found — PR comment will be skipped." Continue regardless.
2. Resolve context:
   - Prefer an explicitly supplied `SPEC_FILE` or `--spec` path; require it to be readable. Otherwise use the selection below.
   - Capture `BRANCH_ISSUE_ID` from the `Branch` line in `## Context` if the branch name contains a Linear identifier. The `Recent commits` line gives a first read of what the branch claims to deliver.
   - Scan `docs/acid-prophet/specs/` for `.md` files. Select best spec match, in priority order: (1) `linear-project:` equals resolved `PROJECT_ID`, (2) `PROJECT_ID` appears in body, (3) `BRANCH_ISSUE_ID` appears in body, (4) filename slug matches closely. If ambiguity remains, ask.
   - If no spec found and `BRANCH_ISSUE_ID` exists, query `mcp__claude_ai_Linear__get_issue` to resolve `PROJECT_ID`/`PROJECT_NAME`, then re-check spec candidates.
   - Use supplied issue Acceptance directly when no local spec exists. For an automatic checkpoint with no resolvable source, report assessment unavailable; do not start a project-discovery interview. For an explicit check, ask for the missing source when needed.
   - Set `PRIMARY_REFERENCE = spec file <path>` or `linear (no spec found)`. Spec file always wins; never overwrite with Linear context once set.
3. Fetch reference:
   - **Spec file**: read `SPEC_FILE`; extract Goal/Problem, Solution, Constraints, and Non-goals/Edges. Scope Acceptance extraction to the section headed exactly `Acceptance` (case-insensitive), stopping at the next heading of the same or higher level; exclude `Acceptance history`. Fetch only project name from Linear if needed (`mcp__claude_ai_Linear__get_project`).
   - **Linear fallback** (no spec found): dispatch a general-purpose Agent to fetch project details, attachments, milestones, and all issue descriptions (Goal, Acceptance, Constraints sections). Capture as `REFERENCE_CONTEXT`.
   - **Unresolved clarification markers**: when reference is the spec file, grep it for `[NEEDS CLARIFICATION:` occurrences. Capture each line + quoted marker text as `OPEN_MARKERS`. These represent spec debt — any DRIFT classification touching a region with an open marker MUST be re-classified `AMBIGUOUS` (the spec itself never said anything definitive).
4. Collect the changes without touching the index or worktree:
   - Resolve `BASE_REF` from `--base`, the current PR base, the repository's default branch, then an existing `main`. Require a readable ref and `git merge-base <base> HEAD`; report unavailable comparison if either fails, never an empty clean result.
   - Capture `HEAD`, `git status --short`, and `git diff <merge-base> HEAD`. For `worktree`, also inspect `git diff --cached`, `git diff`, and `git ls-files --others --exclude-standard`. Read relevant untracked source/tests individually, excluding secrets, generated output, and unrelated user files; report any relevant unreadable content as missing evidence.
   - Judge the effective tracked state with `git diff <merge-base>` plus those untracked files, rather than adding overlapping patches together. Keep staged/unstaged provenance so a local correction is not mistaken for a committed fix. Include renames, deletions, and relevant binary/submodule limitations.
   - For `committed`, use only the merge-base-to-HEAD patch and files at HEAD, including the spec version at HEAD. If a supplied spec is absent there, report that limitation; a locally revised spec cannot bless older committed behavior.
   - If the selected spec differs from accepted requirements, inspect its history and the user's recorded decisions. Report unsupported source changes as drift; do not silently compare changed code only against changed expectations.
   - An empty committed diff does not end a worktree check. If the selected scope has no changes, report `no changes in selected scope`, not full acceptance verification.
5. Drift analysis: dispatch a general-purpose Agent with the reference, collected changes, selected scope, and current implementation block/issue scope. For each active Acceptance criterion and normative constraint, classify as CLEAN / DRIFT / AMBIGUOUS / UNRELATED. Keep pending work outside the completed block UNRELATED with its reason, but assess regressions and cross-cutting constraints affected by this block; missing evidence inside the assessed block is AMBIGUOUS. In committed pre-PR mode assess the full intended PR scope. Read relevant implementation/tests; an untouched criterion is not automatically satisfied. Preserve source ids, including standalone Linear `AC-L###`; missing ids are `AC-UNKNOWN` and AMBIGUOUS. For each finding give source path/id, criterion, classification, expected versus observed behavior, and file/line evidence. Record counts, source version, base, HEAD, scope, and unresolved decisions in `DRIFT_REPORT`. A clean result describes this comparison, not passing tests. If code or source changes during review, refresh the affected comparison before reporting a verdict.
6. Report:
   - Print drift report inline.
   - Return the report to the caller for reconciliation; do not perform repairs inside this skill.
   - Only on an explicit request to publish the report, and when `gh` is available, confirm the concrete PR comment unless already authorized.
     - Authorized → write the exact report to a temporary file and use `gh pr comment --body-file <path>`. On failure: surface error, suggest manual copy.
     - No → exit.

## A verdict covers every criterion

**EVERY ACTIVE `AC-###` AND NORMATIVE CONSTRAINT GETS AN EXPLICIT CLASSIFICATION, OR THERE IS NO VERDICT.**

| Excuse                                 | Reality                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| "The diff obviously matches the spec"  | Obviously is not a classification. Name each criterion by id. |
| "That criterion is untouched, skip it" | Classify its relationship to this scope and cite evidence.    |
| "Ambiguous is close enough to clean"   | `AMBIGUOUS` blocks. Report it and stop.                       |

## Final Report

```text
acid-prophet:check-drift report
  Branch:      <current>
  Project:     <name> (<PROJECT_ID>)
  Source:      spec file <SPEC_FILE> | linear (fallback)
  Spec file:   <SPEC_FILE | _none_>
  Scope:       <worktree | committed> · base <ref> · HEAD <oid>
  Open markers: <N unresolved [NEEDS CLARIFICATION] | _none_>
  Drift:       <N confirmed · N ambiguous · N clean · N unrelated>
  PR comment:  <posted | skipped | gh unavailable | no drift>
```

## Never

- Mutate Linear issues, projects, or spec files.
- Patch the spec, plan, or repository code in any detection mode.
- Post a PR comment without explicit user confirmation.
- Skip step 1 preconditions.
- Run `git push`, `git rebase`, or `git commit`.
