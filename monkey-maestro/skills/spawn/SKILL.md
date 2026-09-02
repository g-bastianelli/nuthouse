---
name: spawn
description: Use when the user explicitly wants one Linear issue in one task-linked Superset workspace. Applies the same live Linear planner, issue-scoped force rules, exact runtime idempotence, and short lock as project orchestration; active controls supply configuration instead of blocking spawn.
argument-hint: "<linear-issue-id> [--force] [--host <id>] [--superset-project <id>] [--agent <name>]"
effort: high
allowed-tools: Bash(superset tasks get:*), Bash(superset agents list:*), Bash(superset workspaces list:*), Bash(superset workspaces create:*), Bash(superset workspaces get:*), Bash(superset terminals list:*), Bash(superset terminals read:*), Bash(superset agents create:*), Bash(node:*), Bash(mktemp:*), Bash(rm:*), Read, Write, Agent, mcp__claude_ai_Linear__get_issue, mcp__claude_ai_Linear__save_comment
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# spawn

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try `warden:voice` through the shared persona-line contract. Print only a non-empty line; skip failure or disabled voice without mention.

## Voice

Read `../../persona.md`. Apply it to wrapper lines only; commands and evidence stay neutral.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. This is the one-issue
consumer of the same Linear/runtime planners and dispatch primitive as `orchestrate`.
Never redirect merely because an active control exists. Never create a branch in place or
change Linear lifecycle.

When the caller explicitly enters relay mode, require the parent `WORKFLOW_DECISION`,
validate it with this plugin's install-local manifest consumer, and project the shared
workflow baton. A missing field or mismatch launches nothing. Ordinary manual spawn may
omit the baton and must not synthesize one from control `runId` or `invocationId`.

## Step 0 — Read live Linear first

1. Require one exact Linear issue identifier and fetch it with
   `get_issue(includeRelations: true)`. Capture exact identifier, project id, normalized
   `status.type`, title, branch name, and blockers only from `relations.blockedBy`. Retry
   this exact issue read once on failure.
2. Mint one fresh UUID v4 `invocationId` for this invocation. Never accept it from the
   user, derive it from a durable run id, or reuse it. Bind force authorization, an
   invocation-only control, and every bridge effect to this same id.
3. A terminal issue returns `already-terminal` immediately, before blocker, Superset, or
   control lookup.
4. Fetch every blocker detail in parallel, retrying only failed blocker ids once. Build
   one exact targeted Linear snapshot and validate/plan it through
   `scripts/linear-frontier.mjs` with expected project/scope. For a project-less issue,
   use invocation-local synthetic scope `manual:<issueId>` for candidate and blocker rows;
   never persist that scope or pretend Linear supplied a project id.
5. A normally ready issue may proceed. A `started` issue proceeds to runtime inspection
   and uses ordinary started-without-runtime confirmation, never force. A blocked or
   relation-unknown issue requires an explicit force request; build the unconfirmed force
   overlay before runtime inspection. Preserve the forced frontier row's canonical
   `forceBypassedBlockerIssueIds` and `forceBypassedUncertainties` preview fields; never
   parse its reason string. Force remains invocation-only.

## Step 1 — Resolve transport configuration

1. For a project-bound issue, dispatch `monkey-maestro:control-loader`, validate its exact
   project/provider/schema envelope, and resolve its comments. Retry an unavailable
   control read once. A usable active control supplies host, Superset project, agent, and
   run id. It does not redirect to `orchestrate`.
2. An inactive project control is a hard refusal. A conflicting or unusable project
   control is also a hard refusal. When control is provably absent, exact explicit
   host/project/agent arguments may build an
   invocation-only control with the real Linear project id, `active: true`, concurrency
   `1`, revision `0`, and run id `manual:<invocationId>`; never guess configuration.
3. A project-less issue uses explicit transport config and lock scope
   `manual:<issueId>`. Build the same invocation-only active control shape using that
   scope, concurrency `1`, revision `0`, and run id `manual:<invocationId>`; the Superset
   task must have an absent external project id. Normalize absent and `null` Linear
   project ids equally.
4. Settle the agent against the host inventory rather than a hardcoded name, whether it
   comes from an explicit `--agent` or from the resolved control. Capture the host agents
   once, tolerating failure, then resolve:

   ```text
   superset agents list --host <targetHostId> --json > "$capture" 2>"$capture.err"
   ```

   A non-zero exit or an empty capture is an unknown inventory, not a failure. Pass the
   capture path, the explicit `--agent` value, and the control agent through
   `scripts/host-agents.mjs resolve-default`. `resolved` supplies the agent;
   `choice-required` asks the user for one `options` selector before the preview;
   `input-required` shows the captured stderr and asks the user to name one agent, because
   an unreachable Superset never refuses a launch by itself; `blocked` refuses with the
   reason and the host's real selectors. Whenever `resolution.replacedAgent` is present,
   name both agents in the preview instead of swapping the control agent silently. This is
   the agent decision for the whole invocation: the dispatch sequence below re-resolves the
   control, not the inventory, so no dispatch result ever carries an agent verdict.

## Step 2 — Candidate-only runtime and preview

1. Dispatch `monkey-maestro:runtime-inspector` for this one exact issue and validate the
   exact project/host context and scope with `scripts/runtime-actions.mjs`, passing the
   resolved control/configuration and invocation id. Retry invalid or scoped-unknown
   evidence once for this same issue.
2. Missing task identity refuses mutation. Multiple exact workspaces or active terminals
   are ambiguous and report every id. One exact active terminal is monitored without a
   launch. With no active terminal, one workspace means reuse and zero means create;
   either mutation requires the gate below. A started create/reuse and an unconfirmed
   forced create/reuse are both `confirm` actions.
3. If mutation remains, show exact Linear blockers/status, force bypass if any, task,
   host, Superset project, create/reuse action, agent, and worker prompt. Ask once:

```text
Launch this issue with the displayed normal/forced authorization? (y / cancel)
```

4. On `y`, re-run `planRuntimeActions` before entering the epoch. For a started issue pass
   `confirmedIssueIds: [issueId]`. For force pass an authorization bound to this exact
   invocation id with `bypassedBlockerIssueIds` and `bypassedUncertainties` maps copied
   exactly from the forced frontier row, including empty arrays. Require the new action to be
   `create` or `reuse`; a remaining `confirm`, changed scope, or refusal launches nothing.
5. Build `dispatchContextByIssueId[issueId]` from the exact issue read: non-empty provider
   branch name, deterministic workspace name, and the complete previewed worker prompt.
   These values must enter the bridge request and resulting effect id; never recover them
   later from ambient conversation memory. Retry a failed exact issue read once;
   persistent missing/invalid context returns
   `non-transportable: DISPATCH_CONTEXT_UNAVAILABLE` without entering the bridge or
   mutating transport.

## Step 3 — Refresh and mutate under lock

Use the one-candidate production bridge `scripts/orchestration-epoch.mjs`; it invokes the
same `lib/orchestration-epoch.mjs` state machine as orchestration. Build the exact outer
envelope `{ schemaVersion: 1, request: { ... }, transcript: [...] }`. Inside `request`, pass
`selectedIssueIds: [candidateIssueId]` exactly, even when blocker rows are present in the
frontier, plus `lockDirectory: "${CLAUDE_PLUGIN_DATA}/locks"`. Drive every returned
`needs-effects` request through the same Linear, project-lock, Superset-dispatch, and
monitoring boundaries named in the shared contract,
append exact responses to an invocation-only transcript, and continue until
`state: complete`. Never execute an effect that the bridge did not request or treat a
partial transcript as authorization; delete the temporary transcript after release or
terminal failure.

The successful CLI output is directly
`{ schemaVersion: 1, state: "needs-effects" | "complete", ... }`; it has no `ok` or
`epoch` success wrapper.

For a project-less invocation, `refreshCandidateAndBlockers` does not dispatch the
project-bound snapshot loader. Instead, use the skill's direct `get_issue` capability:
fetch the candidate first with relations, derive its exact fresh blocker ids, fetch those
blockers in parallel, and build the strict targeted snapshot using the synthetic
`manual:<issueId>` scope for every row. Validate that exact envelope through
`scripts/linear-frontier.mjs` before returning it to the bridge; failed reads stay scoped
unknown and never become remembered facts.

Pass the exact `dispatchContextByIssueId` from Step 2. The `dispatchIssue` effect must
echo its bound branch name, workspace name, and full worker prompt, and those exact values
must be used for workspace/agent creation. A missing or mismatched field is an invalid
effect and causes no mutation.

For every effect, follow the shared contract's **Adapter response envelopes** exactly.
`dispatchIssue` returns one of the four strict identity/runtime/record forms and includes
the actual live action, `create` or `reuse`. A `create` request may come back `reuse`; a
`reuse` request must come back `reuse` bound to the exact requested workspace. Reject an
invalid provider form or an unbound reuse; never infer or synthesize fields from
conversation memory.

1. Acquire the project/manual lock only after confirmation, passing
   `directory: "${CLAUDE_PLUGIN_DATA}/locks"`, the project/manual scope as `projectId`, and
   the selected host as `hostId`. Live ownership returns `busy`; never bypass it. Recover
   only helper-reported stale/empty/legacy artifacts (with the observed token for a stale
   owner), then retry acquisition exactly once.
2. Re-resolve the project control once immediately after confirmation and before
   acquiring the lock: an inactive, newly written, or conflicting control refuses the
   launch without mutation, and a configuration change refuses it too. The control
   validated there authorizes this one batch and remains fixed until the lock is released;
   do not re-page control comments under the same lock. A project-less invocation has no
   control provider and replays its exact immutable invocation control.
3. For a project-bound issue, make one project-snapshot-loader dispatch with
   `MODE: candidate-blockers`; it fetches the candidate first, derives its exact fresh
   direct blockers, and fetches that union before returning one targeted snapshot. For a
   project-less issue, perform the same phases through direct `get_issue` calls. Validate,
   re-plan with the confirmed force overlay, and reject a newly terminal candidate or a
   force whose fresh bypass scope exceeds the previewed blocker set.
4. `dispatchIssue` verifies the live lock, then performs the exact task/workspace/terminal
   duplicate check itself. Zero exact workspaces selects `create`; one selects `reuse`;
   multiplicity is ambiguous. If an active terminal appeared during confirmation, reuse
   and monitor it without launching a second agent. The returned action is the actual live
   action. Execute the shared order:

```text
live token/owner/lease verification
     -> task -> exact workspace check -> create if absent -> verify workspace
     -> terminal snapshot -> create agent -> correlate terminal -> best-effort record
```

5. The `dispatchIssue` adapter must run `scripts/project-lock.mjs verify` against its
   exact `lockReceipt` as its first sub-step, immediately before any Superset call.
   Require `verifyOutput.verified === true` and return
   `lockVerification: verifyOutput.verification` in the dispatch result. Never fabricate
   this inner verification from the acquisition receipt. Expired, changed, or missing
   ownership rejects dispatch without transport mutation.
6. Inspect one time only after ambiguous or invalid mutation evidence and never retry
   create blindly. Preserve partial workspace success. Release the token-matched lock in
   `finally`.
7. Worker prompt starts with `linear-devotee:greet <issueId>` and includes the shared
   DONE/BLOCKED envelope. In relay mode, bind the validated baton into the same immutable
   worker prompt before preview and carry it unchanged through
   `dispatchContextByIssueId`:

   ```text
   WORKFLOW_RUN_ID: <parent run_id>
   WORKFLOW_PROFILE: <parent effective profile>
   WORKFLOW_DECISION_HASH: sha256:<hex>
   ```

   A missing value or mismatch launches nothing. The baton never authorizes human
   feature acceptance, manual merge, or Linear completion. Only greet may claim the
   issue; spawn never changes Linear status or dependencies.

## Report

```text
monkey-maestro:spawn report
  Issue:      <id / live status / blockers>
  Authority:  normal | forced
  Task:       <uuid>
  Workspace:  <created | reused | partial | none>
  Terminal:   <id or none>
  Result:     launched | already-terminal | busy | ambiguous | degraded | canceled
```
