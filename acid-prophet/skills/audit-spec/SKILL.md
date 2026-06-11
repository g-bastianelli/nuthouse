---
name: audit-spec
description: Use when auditing an existing acid-prophet spec for SDD compliance, codebase reality, narrative quality, and style. Takes a spec path, dispatches the `spec-auditor` subagent, renders a structured BLOCKER/WARNING/INFO report, and offers a hand-off menu (apply auto-fixes, open spec, hand to linear-devotee, stop).
argument-hint: [spec-path]
effort: high
allowed-tools: Read, Glob, Agent, Bash(node:*)
---

# acid-prophet:audit-spec

Rigid audit gate. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Workflow

1. Preconditions:
   - Verify git repo: `git rev-parse --show-toplevel`. Capture as `PROJECT_ROOT`. Abort if not in a repo.
   - Resolve the spec path: if `$ARGUMENTS` contains a spec path, use it; otherwise ask. Resolve to absolute path; verify file exists (abort if not).
   - Warn if spec lives outside `<PROJECT_ROOT>/docs/acid-prophet/specs/`, but continue.
2. Dispatch spec-auditor:
   ```
   Agent({ subagent_type: 'acid-prophet:spec-auditor', prompt: `SPEC_PATH: <abs path>\nPROJECT_ROOT: <root>\nMODE: report-only` })
   ```
   Capture full output as `RAW_REPORT`.
3. Render report:
   - Parse with `${CLAUDE_PLUGIN_ROOT}/claudecode/lib/parse-spec-auditor-report.mjs`. If null: try `warden:voice` per the voice cadence with `SUMMARY: spec-auditor output malformed`, print `RAW_REPORT` verbatim, skip to `(s)` branch.
   - Try `warden:voice` per the voice cadence with `SUMMARY: <N> findings in spec` (or `spec is clean` if zero). Then print `RAW_REPORT` exactly as emitted.
4. Hand-off menu:
   ```
   (a) apply auto-fixes → patch spec, commit
   (o) open spec        → print path
   (l) hand to linear   → linear-devotee:create-project (only if linear-project: _none_ AND handoffEligible)
   (s) stop
   ```
   Disable `(l)` if any of the following hold: `linear-project` frontmatter is not `_none_`, or the parsed report's `handoffEligible` is `false` (any gate failed or any BLOCKER remains). When `(l)` is disabled, print the disabling reason in plain text under the menu — quote the first failing gate or BLOCKER from the report.
   - `(a)`: apply each `autoFixes` entry via `apply-frontmatter-patch.mjs`. Commit: `git commit -m "docs(acid-prophet): spec-auditor auto-fixes"`. Never `--no-verify`. If no fixes: inform and return to menu.
   - `(o)`: print absolute spec path.
   - `(l)`: invoke `linear-devotee:create-project` with spec path.
   - `(s)`: try `warden:voice` per the voice cadence with `SUMMARY: audit complete, user stopped`, then exit.

## Final Report

```text
acid-prophet:audit-spec report
  Spec:        <path>
  Gates:       <N pass · N fail · N n/a | _legacy_>
  Handoff:     <eligible | blocked: <reason>>
  Findings:    <N blocker · N warning · N info>
  Auto-fixes:  <N proposed | N applied | none>
  Branch:      <a | o | l | s | malformed>
```

## Never

- Mutate files outside `docs/acid-prophet/specs/`.
- Apply auto-fixes without user choosing `(a)`.
- Invoke `linear-devotee:create-project` without user choosing `(l)`.
- Skip step 1 preconditions.
- Run `git push`, `git rebase`, or `git commit --amend`.
- Use `--no-verify`.
