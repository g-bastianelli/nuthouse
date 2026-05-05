---
name: acid-prophet:audit-spec
description: Use when auditing an existing acid-prophet spec for SDD compliance, codebase reality, narrative quality, and style. Takes a spec path, dispatches the `spec-auditor` subagent, renders a structured BLOCKER/WARNING/INFO report, and offers a hand-off menu (apply auto-fixes, open spec, hand to linear-devotee, stop).
effort: high
allowed-tools: Read, Glob, Grep, Bash
---

# acid-prophet:audit-spec

Rigid audit gate. Match the user's language; keep technical identifiers unchanged.

> At visible transitions, dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` before normal output. Skip on failure.

## Workflow

1. Preconditions:
   - Verify git repo: `git rev-parse --show-toplevel`. Capture as `PROJECT_ROOT`. Abort if not in a repo.
   - Verify spec-path argument. If missing, ask. Resolve to absolute path; verify file exists (abort if not).
   - Warn if spec lives outside `<PROJECT_ROOT>/docs/acid-prophet/specs/`, but continue.
2. Dispatch spec-auditor:
   ```
   Agent({ subagent_type: 'acid-prophet:spec-auditor', prompt: `SPEC_PATH: <abs path>\nPROJECT_ROOT: <root>\nMODE: report-only` })
   ```
   Capture full output as `RAW_REPORT`.
3. Render report:
   - Parse with `<PROJECT_ROOT>/acid-prophet/claudecode/lib/parse-scryer-report.mjs`. If null: dispatch `warden:voice` with `SUMMARY: spec-auditor output malformed`, print the returned line, print `RAW_REPORT` verbatim, skip to `(s)` branch.
   - Dispatch prophet with `SUMMARY: <N> findings in spec` (or `spec is clean` if zero); print the returned line. Then print `RAW_REPORT` exactly as emitted.
4. Hand-off menu:
   ```
   (a) apply auto-fixes → patch spec, commit
   (o) open spec        → print path
   (l) hand to linear   → linear-devotee:consummate-project (only if linear-project: _none_ and 0 BLOCKER)
   (s) stop
   ```
   Disable `(l)` if `linear-project` is not `_none_` or any BLOCKER finding exists.
   - `(a)`: apply each `autoFixes` entry via `apply-frontmatter-patch.mjs`. Commit: `git commit -m "docs(acid-prophet): spec-auditor auto-fixes"`. Never `--no-verify`. If no fixes: inform and return to menu.
   - `(o)`: print absolute spec path.
   - `(l)`: invoke `linear-devotee:consummate-project` with spec path.
   - `(s)`: dispatch `warden:voice` with `SUMMARY: audit complete, user stopped`, print the returned line, exit.

## Final Report

```text
acid-prophet:audit-spec report
  Spec:        <path>
  Findings:    <N blocker · N warning · N info>
  Auto-fixes:  <N proposed | N applied | none>
  Branch:      <a | o | l | s | malformed>
```

## Never

- Mutate files outside `docs/acid-prophet/specs/`.
- Apply auto-fixes without user choosing `(a)`.
- Invoke `linear-devotee:consummate-project` without user choosing `(l)`.
- Skip step 1 preconditions.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
