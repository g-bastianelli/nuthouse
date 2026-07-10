---
name: verify
description: Use after editing code in a moon monorepo, before commit or PR, to verify the change — runs affected :typecheck/:lint/:test via the verify-runner subagent, dispatches change-auditor for an adversarial review of the diff against scope, reports evidence (not assertion), and loops back on a torn wing (failing check). Prefer this over a blind repo-wide test run.
effort: high
allowed-tools: Bash(moon run:*), Bash(moon query:*), Bash(git diff:*), Bash(git branch --show-current), Bash(git rev-parse:*), Bash(cat:*), Read, Agent, mcp__claude_ai_Linear__get_issue
---

# verify

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.
> Autopilot scope: resolve the current branch's Linear issue and project before Steps 3–4. Take the **autopilot branch** only when that project's `<git-common-dir>/nuthouse/relays/<project-id>/autopilot.json` is active, unexpired, and embeds the same project id; otherwise behave interactively. A flag from another Linear project in this repo never applies.

## Voice

Read `../../persona.md` at the start of this skill. The moon-moth voice is
canonical for wrapper lines; the report stays plain. A clean flight (🌙) is
declared only on real passing output.

**Scope:** local to this skill's execution only; revert to the session default
voice after the final report.

This skill is **rigid** — execute steps in order.

## Language

Adapt chat output to the user's language. Project ids, task names, file paths,
and CLI flags stay in their original form.

## When you're invoked

A change is made and needs verifying before it ships. The moon-moth checks its
wings on exactly the affected projects — never the whole repo when a scoped set
exists — and refuses to call the flight clean on assertion alone.

## Step 0 — Preconditions

1. Confirm a moon workspace (`.moon/` up-tree); capture `PROJECT_ROOT` = moon
   root. If not a moon repo, abort and suggest running the repo's own checks.
2. Resolve the current issue id from the branch and its project id from
   `docs/linear-devotee/plan/<ISSUE_ID>.md`'s `linear-project` field. If the artifact is
   absent or lacks the field, fetch the issue from Linear. Read only that project's relay
   flag to decide whether autopilot is on.
3. Obtain the affected scope: read a persisted scope map under
   `${PROJECT_ROOT}/docs/moon-moth/scope/`, else run `moon-moth:scope` first.
   The set of `tasks` per affected project tells you which targets to run.

## Step 1 — Run the affected checks (evidence)

Dispatch `moon-moth:verify-runner` (see `## Subagent dispatch`). It executes the
affected tasks via the commands in the `moon-moth:moon-commands` knowledge
skill (`${CLAUDE_PLUGIN_ROOT}/skills/moon-commands/SKILL.md`) — typically:

```
moon run :typecheck :lint :test --affected --downstream deep
```

and returns a structured per-project pass/fail with the exact failing output
captured. If subagents are unavailable, run the command inline and capture
stdout/stderr yourself.

**Evidence over assertion:** never report a check as passing without the actual
command result. Quote failing output.

## Step 2 — Adversarial review (change-auditor)

In parallel with — or right after — Step 1, dispatch `moon-moth:change-auditor`
to review the diff against the affected scope: scope creep (edits outside the
affected set), missing tests for new behaviour, repo-convention violations the
linter can't catch (e.g. boundary leaks between layers). It returns findings,
each marked real/uncertain.

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

3. Re-run only the affected task that failed (`moon run <project>:<task>`) until
   green. Do not declare a clean flight while a wing is torn.

In autopilot: a torn wing stops the forward chain — report the failing evidence verbatim
and do NOT auto-chain to commit/pr. The relay pauses here; verify owns no queue state, so
it writes no `phase` — stopping the forward chain IS the halt (per the stop-ladder in
`monkey-maestro`'s pipeline-contract). The patron fixes and re-verifies (re-running this
skill), or runs `monkey-maestro:halt` to disarm. Autopilot never papers over a wrong note.

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

On a clean flight in autopilot: skip the menu and auto-chain — invoke `git-gremlin:commit`
(the relay commits the whole movement), then on its return `git-gremlin:pr`. The pr step
then hands to `monkey-maestro:advance` for the acceptance gate. Otherwise, present the
hand-off menu:

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
- Run raw `tsc`/`eslint`/`vitest`/`bun test` directly — always via `moon run`.
- Mutate external services without explicit user confirmation.
