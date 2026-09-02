---
name: verify
description: Use after editing, before commit or PR, to verify an issue-delivery packet. Uses Moon's affected graph when present and documented repository-native commands otherwise; returns the command output as evidence and loops back on failure.
effort: high
allowed-tools: Bash, Read, Write, Agent, mcp__claude_ai_Linear__get_issue
---

# verify

> Agent resolution: before any subagent dispatch, read `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` and use the active runtime's name.

## Voice

Read `../../persona.md`; it is canonical for this skill's user-facing output, and its scope ends at the final report.

## When you're invoked

A change is made and needs verifying before it ships. The moon-moth checks its
wings on exactly the affected projects — never the whole repo when a scoped set
exists — and refuses to call the flight clean on assertion alone.

## Step 0 — Preconditions

1. When invoked from issue delivery, require an `ISSUE_DELIVERY_PACKET` naming
   `PLAN_FILE`, `RELEVANT_FILES`, and the issue id. Read the plan; a missing or
   unreadable plan blocks verification. Never downgrade a missing artifact to prose.
2. Confirm a moon workspace (`.moon/` up-tree); capture `PROJECT_ROOT` = moon root.
   When Moon is absent, take the check commands from the repository's own
   `AGENTS.md`, `CLAUDE.md`, or `package.json` scripts. If none names a real command,
   block; never claim verification from narrative guidance.
3. In a Moon workspace, obtain the affected scope: read a persisted scope map under
   `${PROJECT_ROOT}/docs/moon-moth/scope/`, else run `moon-moth:scope` first.
   The set of `tasks` per affected project tells you which targets to run.
4. Record `git rev-parse HEAD` and `git status --porcelain` before running any check.
   Re-read both after the checks. If either changed, the tree moved underneath the run:
   discard the results and verify again on the new state.

## Step 1 — Run checks (evidence)

### Moon branch

Only when `.moon/` exists, dispatch the logical `moon-moth:verify-runner` agent (see
`## Subagent dispatch`). It executes the affected tasks via the commands in the
`moon-moth:moon-commands` knowledge skill
(`${CLAUDE_PLUGIN_ROOT}/skills/moon-commands/SKILL.md`) — typically:

```
moon run :typecheck :lint :test --affected --downstream deep
```

and returns a structured per-project pass/fail with the exact failing output
captured. If subagents are unavailable, run the command inline and capture
stdout/stderr yourself.

**Evidence over assertion:** never report a check as passing without the actual
command result. Quote failing output.

### Repository-native branch

When `.moon/` is absent, do not dispatch `moon-moth:verify-runner` and do not apply its
Moon-only command restrictions. Execute every exact command returned by the install-local
`resolveVerificationStrategy` in the repository root using the unrestricted Bash
capability declared by this skill. The resolver may select `bun`, `npm`, `pnpm`, `yarn`,
or another repository-owned executable; never rewrite or approximate a declared command.
Capture each exit status and concise output. Do not mix a failed native command with
successful Moon evidence or skip a declared command.

## Step 2 — Adversarial review (change-auditor)

In the Moon branch, in parallel with — or right after — Step 1, dispatch
`moon-moth:change-auditor` to review the diff against the affected scope: scope creep,
missing tests for new behaviour, and repo-convention violations. In the repository-native
branch, perform the equivalent review against the issue plan and repository instructions
without inventing a Moon scope. Both branches return findings marked real/uncertain.

## Step 3 — Loop on a torn wing

If any check fails or the auditor flags a real blocker:

1. Report the failing evidence plainly.
2. Either fix it here (small, obvious) or hand back to the implementation turn.
   The handback must carry the failing task's output **verbatim** — the
   `output` field verify-runner already captured — never a paraphrase:

   ```
   FAILING_TASK: <project>:<task>   (one block per failing task)
   FAILING_OUTPUT:
   <verbatim failing excerpt from the verify-runner result, unedited>
   AUDITOR_FINDINGS: <real findings from change-auditor, if any | _none_>
   SCOPE: <affected project ids>
   ```

3. In the Moon branch, re-run only the affected task that failed
   (`moon run <project>:<task>`). In the repository-native branch, re-run only the exact
   failed resolver command. Continue until green; do not declare a clean flight while a
   wing is torn.

On a torn wing, report the failing evidence verbatim and do not offer commit/PR until the
user fixes and re-verifies. Verification owns no Maestro state and never stops or starts
project execution.

This applies equally to repository-native verification: when verification fails, do not
offer commit/PR.

## Step 4 — Final report + hand-off

```text
moon-moth:verify report
  Affected:    <project ids checked>
  typecheck:   <pass | fail — per project>
  lint:        <pass | fail — per project>
  test:        <pass | fail — per project, counts>
  Auditor:     <N real findings | clean>
  Verdict:     clean flight 🌙 | torn wing — <what to fix>
```

A `clean flight 🌙` line is allowed **only** when every affected check passed on
real output and the auditor found no real blocker.

**NO COMPLETION CLAIM WITHOUT FRESH OUTPUT.** The evidence is the command output
itself, quoted in the report — never a claim about it. A check that was not run is a
failure, not an omission. Re-run every check after the last edit; the last edit is
precisely the unverified one.

| Excuse                                       | Reality                                                             |
| -------------------------------------------- | ------------------------------------------------------------------- |
| "The change is trivial, checks are overkill" | Trivial changes break builds. Run them.                             |
| "Checks passed before my last edit"          | The last edit is exactly what is unverified.                        |
| "The failure looks unrelated"                | An unrelated failure still blocks the hand-off. Report it and stop. |
| "I'll note it and move on"                   | A noted failure is a failure. The verdict is a torn wing.           |

When several tasks run under one plan, append the verdict to the plan's ledger at
`.nuthouse/<plan-basename>/progress.md` — first line `# ledger — plan: <plan path>`, one
`Task <N>: verified` line per cleared task. The ledger exists so a compacted session
resumes at the first unverified task instead of re-running the cleared ones. It is
git-ignored and disposable.

On a clean flight, present the hand-off menu:

```
<voice intro line — moon-moth>
(c) commit → git-gremlin:commit
(p) pr     → git-gremlin:pr
(s) stop   → wings checked, fly off
```

On a torn wing, hand back to the implementation turn with the Step 3 handback
block instead — failing output verbatim, never summarised. Instruct the
implementing agent to fix against the failing evidence, honor the repo's
`AGENTS.md`/`CLAUDE.md`, let the `subroutine` discipline skills activate on
matching files, and return here (`moon-moth:verify`) to close the loop.

## Subagent dispatch

```
Agent({
  subagent_type: 'moon-moth:verify-runner',
  description: 'run affected moon checks',
  prompt: `MOON_ROOT: <abs path>
TASKS: typecheck, lint, test
SCOPE: <affected project ids, or "--affected --downstream deep">
Run via moon and return structured per-project pass/fail with failing output captured.`,
})

Agent({
  subagent_type: 'moon-moth:change-auditor',
  description: 'adversarial diff review vs scope',
  prompt: `MOON_ROOT: <abs path>
AFFECTED: <project ids in scope>
Review the working-tree diff for scope creep, missing tests, and repo-convention
violations. Return findings marked real | uncertain.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Declare a check passing without real command output (evidence over assertion).
- Run repo-wide `:test` when a scoped affected set exists.
- In the Moon branch, run raw `tsc`/`eslint`/`vitest`/`bun test` directly — use
  `moon run`. Raw `bun test` and other package-manager commands are forbidden only in
  the Moon branch; the repository-native branch must run the resolver's exact commands.
- Mutate external services without explicit user confirmation.
