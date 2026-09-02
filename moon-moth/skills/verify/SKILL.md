---
name: verify
description: Use after editing, before commit or PR, to verify an issue-delivery packet. Uses Moon's affected graph when present and documented repository-native commands otherwise; returns hash-bound evidence and loops back on failure.
effort: high
allowed-tools: Bash, Read, Write, Agent, mcp__claude_ai_Linear__get_issue
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# verify

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

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

## Direct-task verification contract

When the caller supplies `DIRECT_TASK_VERIFICATION`, require this closed input instead of an
issue-delivery packet:

```text
DIRECT_TASK_VERIFICATION: {
  "schemaVersion": 1,
  "preparation": <exact ready prepareDirectTask result>,
  "changedPaths": ["<normalized repository-relative path>"],
  "returnTarget": { "kind": "current-turn", "name": "direct-task" }
}
```

Import `discoverGitContext`, `consumeManifestHandoff`, and
`evaluateDirectTaskCompletion` only from this plugin's install-local `lib/workflow/index.mjs`; use
the adjacent `bundle.json` source hash as `policyHash`. Consume
`preparation.decisionHandoff` against the current Git context without reclassification or recovery,
and require the same `run_id` and `content_hash`, a persisted `direct-task` decision, and enabled
immutable `verification`. Require a non-empty `changedPaths` set inside the preparation's
segment-aware approved boundaries and outside every protected boundary. Require the complete ready
preparation contract, a canonical affected or planned Moon map, `verifier: "moon-moth:verify"`,
and exact target equality with the affected ids plus downstream ids. Any malformed or stale input
blocks before commands run.

Run every exact command in `preparation.verification.commands` against those targets. Capture the
Step 0 pre-check and post-check Git snapshots exactly as below and rerun if they differ. On success,
write and re-read `${CLAUDE_PLUGIN_DATA}/direct-task-verification-<run_id>.json` with this canonical
evidence object:

```text
DIRECT_TASK_EVIDENCE: {
  "run_id": "<preparation.decisionHandoff.run_id>",
  "decision_content_hash": "<preparation.decisionHandoff.content_hash>",
  "head_oid": "<lowercase Git object id>",
  "worktree_snapshot_hash": "sha256:<64 lowercase hex>",
  "changed_paths": ["<every path in the verified worktree snapshot>"],
  "verified_files": [{ "path": "<path>", "type": "regular-file | symlink | deleted", "mode": "0644 | 0755 | 120000 | null", "before_hash": "sha256:<hex> | null", "verified_content_hash": "sha256:<hex> | null" }],
  "results": [{ "command": "<exact selected command>", "targets": ["<exact selected target>"], "exitStatus": 0, "summary": "<bounded real-output summary>" }]
}
CURRENT_SNAPSHOT: {
  "head_oid": "<same post-check oid>",
  "worktree_snapshot_hash": "<same post-check hash>",
  "changed_paths": ["<same exact worktree snapshot paths>"],
  "verified_files": [<same exact verified-file records>]
}
RETURN_TARGET: { "kind": "current-turn", "name": "direct-task" }
```

`verified_files` must contain every snapshot path exactly once. Every implementation `changedPaths`
entry must be present; any additional dirty path must sit inside a declared protected boundary so
unrelated user work remains represented without becoming implementation scope. Use the HEAD content
hash as `before_hash` when available and null for a path absent at HEAD. Deleted files use type
`deleted`, null mode, and null `verified_content_hash`. Before returning, call
`evaluateDirectTaskCompletion({ preparation, changedPaths, evidence, currentSnapshot })` and return
only when it reports `completed`. Do not expose a clean handoff on any block or failure.

## Workflow

### Step 0 — Preconditions

1. When invoked from issue delivery, require `ISSUE_DELIVERY_PACKET` with the named
   `PLAN_FILE`, `SPEC_FILE`, `RELEVANT_FILES`, and `WORKFLOW_DECISION`.
   - Treat the plan, spec, workflow decision, project plan, drift evidence, and checklist
     evidence as **immutable inputs**. Validate the decision through this plugin's
     install-local consumer and recompute each immutable `content_hash`; any mismatch
     blocks verification.
   - Treat `RELEVANT_FILES` as **mutable targets**. Preserve each supplied
     `before_hash` as provenance, require its canonical absolute path, and require the
     `RELEVANT_FILES` path set to remain distinct and unchanged. Do not compare current
     bytes to `before_hash` after implementation. Instead rebind every existing target
     to `verified_content_hash: sha256:<hex>` and record a deletion marker for a removed
     target. A path outside the repository or a mutated packet path set blocks.
     A `DIRECT_TASK_VERIFICATION` input is mutually exclusive with issue delivery. Validate its
     complete contract above and preserve its exact decision identity, path boundaries, command set,
     target set, and changed-path set throughout verification.
2. Confirm a moon workspace (`.moon/` up-tree); capture `PROJECT_ROOT` = moon root.
   When Moon is absent, use `resolveVerificationStrategy` from the install-local bundle
   to select non-empty repository-native commands sourced only from repository
   instructions or build metadata. If no reliable native command exists, block; never
   claim verification from narrative guidance.
3. In a Moon workspace, obtain the affected scope: read a persisted scope map under
   `${PROJECT_ROOT}/docs/moon-moth/scope/`, else run `moon-moth:scope` first.
   The set of `tasks` per affected project tells you which targets to run.
4. Immediately before Step 1, capture the **pre-check Git snapshot** as
   `PRECHECK_HEAD_OID = git rev-parse HEAD` plus an index-independent canonical
   `PRECHECK_WORKTREE_SNAPSHOT`. Build it from the bytewise-sorted
   repository-relative path union of tracked paths changed from `HEAD` and non-ignored
   untracked paths. For each changed path record its file type/mode plus
   `verified_content_hash`, or an explicit deletion marker, then hash the canonical
   JSON as `PRECHECK_WORKTREE_SNAPSHOT_HASH`. Do not run any verification command
   before this pre-check snapshot is complete.
   For direct tasks, require every `DIRECT_TASK_VERIFICATION.changedPaths` entry in the snapshot;
   every additional snapshot path must be protected context. Build `verified_files` from the entire
   snapshot so unrelated user work remains hash-bound without entering implementation scope.

### Step 1 — Run checks (evidence)

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

### Step 2 — Adversarial review (change-auditor)

In the Moon branch, in parallel with — or right after — Step 1, dispatch
`moon-moth:change-auditor` to review the diff against the affected scope: scope creep,
missing tests for new behaviour, and repo-convention violations. In the repository-native
branch, perform the equivalent review against the issue plan and repository instructions
without inventing a Moon scope. Both branches return findings marked real/uncertain.

### Step 3 — Loop on a torn wing

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

### Step 4 — Final report + hand-off

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

Before the hand-off menu, write canonical version-one evidence to
`${CLAUDE_PLUGIN_DATA}/issue-delivery-verification-<run_id>.json` when an
`ISSUE_DELIVERY_PACKET` exists. Bind the exact workflow decision hash, input artifact
hashes, rebound mutable targets, Moon scope or repository-native command list, exit
results, auditor verdict, and the exact verified Git state:

1. Use the pre-check Git snapshot captured in Step 0; never create the first snapshot
   here. `verified_files` is the union of its changed paths and every mutable target,
   preserving each target's `before_hash`. Treat `PRECHECK_HEAD_OID` and
   `PRECHECK_WORKTREE_SNAPSHOT_HASH` as the exact state the checks evaluated.
2. After all checks and review, recompute the same `HEAD_OID`, changed path set,
   per-path file type/mode/content hashes, and canonical snapshot hash. Compare the
   pre-check Git snapshot with this post-check snapshot. If either snapshot differs,
   discard the results and rerun verification on the new state.
3. Persist lowercase wire fields `head_oid`, `worktree_snapshot_hash`, and
   `verified_files` alongside the evidence. Staging alone does not affect this snapshot;
   editing, adding, deleting, changing mode, or committing does.

Re-read the artifact and emit:

```text
VERIFICATION_EVIDENCE: { path: <absolute path>, content_hash: sha256:<hex>, status: clean }
```

Never include complete logs, source contents, prompts, Linear bodies, or secrets in the
evidence artifact. A write/read/hash failure changes the verdict to a torn wing.

When `DIRECT_TASK_VERIFICATION` exists, write and validate `DIRECT_TASK_EVIDENCE` plus
`CURRENT_SNAPSHOT` using the direct-task contract above, then return immediately to its exact
current-turn target. Skip the commit/PR menu; the caller owns completion and any later handoff.

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
