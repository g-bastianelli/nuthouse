---
name: check-drift
description: Use during strict issue planning or on a feature branch before/during PR creation to detect drift against the authoritative SDD Acceptance and constraints. Planned-intent mode emits hash-bound local evidence; branch mode can optionally post the report as a PR comment.
argument-hint: "[--plan <path> --spec <path> --workflow-decision <handoff>]"
effort: high
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(node:*), Read, Write, Glob, Grep, Agent
paths: ["docs/acid-prophet/**"]
disallowed-tools: Edit, NotebookEdit
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# acid-prophet:check-drift

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid drift-detection gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Context

> Auto-injected on Claude Code at skill load. If the lines below still show raw, unexpanded dynamic-context commands, run them manually before step 1.

- Branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -15`

## Workflow

### Strict issue-delivery mode

Use this mode when Linear Devotee supplies all three named inputs before implementation:

```text
PLAN_FILE: { path: <absolute path>, content_hash: sha256:<hex> }
SPEC_FILE: { path: <absolute path>, content_hash: sha256:<hex> }
WORKFLOW_DECISION: { run_id: <id>, path: <absolute manifest path>, content_hash: sha256:<hex> }
EFFECTIVE_PROFILE: strict
```

1. Validate `WORKFLOW_DECISION` through Acid Prophet's install-local
   `lib/workflow/index.mjs` consumer. Require `issue-delivery`, effective `strict`, an
   in-scope manifest, and exact content/policy hashes. Warden is not required.
2. Read `PLAN_FILE` and `SPEC_FILE`, recompute their exact `sha256:` hashes, and refuse
   stale, missing, or mismatched inputs. This analysis is read-only with respect to the
   plan, source spec, repository code, Linear, and GitHub.
3. Compare planned intent (Files, Acceptance traceability, Steps, Verify, Risks, and Out
   of scope) against the source spec's Problem/Solution, Architecture, Constraints,
   Error handling, active Acceptance, Testing approach, and Non-goals. Classify every
   active `AC-###` and normative constraint as `CLEAN | DRIFT | AMBIGUOUS | UNRELATED`.
   A project-plan conflict is `DRIFT`; missing evidence is `AMBIGUOUS`.
4. Canonicalize the result as version-one JSON and write only the report artifact to
   `${CLAUDE_PLUGIN_DATA}/issue-delivery-drift-<run_id>.json`. Include plan/spec/decision
   paths and hashes, stable findings, counts, and `status: clean | blocked`; never include
   prompt text, source contents, Linear bodies, secrets, or complete logs.
5. Re-read the bytes and return:

   ```text
   DRIFT_EVIDENCE: { path: <absolute report path>, content_hash: sha256:<hex>, status: <clean | blocked> }
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
   - **Linear fallback** (no spec found): try `warden:voice` per the voice cadence with `SUMMARY: no spec file, falling back to Linear`. Then dispatch a general-purpose Agent to fetch project details, attachments, milestones, and all issue descriptions (Goal, Acceptance, Constraints sections). Capture as `REFERENCE_CONTEXT`.
   - **Unresolved clarification markers**: when reference is the spec file, grep it for `[NEEDS CLARIFICATION:` occurrences. Capture each line + quoted marker text as `OPEN_MARKERS`. These represent spec debt — any DRIFT classification touching a region with an open marker MUST be re-classified `AMBIGUOUS` (the spec itself never said anything definitive).
4. Get diff: `git diff main...HEAD`. If empty, try `warden:voice` per the voice cadence with `SUMMARY: empty diff, nothing to check`; print final report with `Drift: none (empty diff)`; exit.
5. Drift analysis: dispatch a general-purpose Agent with `REFERENCE_CONTEXT`, `DIFF`, and `REFERENCE_SOURCE`. For each Acceptance criterion or normative Constraint, classify as CLEAN / DRIFT / AMBIGUOUS / UNRELATED. Preserve the stable `AC-###` id in every Acceptance finding; when Linear fallback has no id, label it `AC-UNKNOWN` and classify it AMBIGUOUS rather than inventing one. Format per finding: `source <path|id> · <AC-###|constraint> — "<criterion>" → <classification + explanation>`. End with `<N> drift · <N> ambiguous · <N> clean · <N> unrelated`. Capture as `DRIFT_REPORT`.
6. Report:
   - Try `warden:voice` per the voice cadence with `SUMMARY: <N> drift <N> ambiguous found` (or `no drift found` if clean).
   - Print drift report inline.
   - If drifts or ambiguous exist and `gh` is available: ask the user if they want to post the report as a PR comment.
     - Yes → `gh pr comment --body "<DRIFT_REPORT>"`. On failure: surface error, suggest manual copy.
     - No → try `warden:voice` per the voice cadence with `SUMMARY: drift report done, user stopped`; exit.

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
