---
name: create-project
description: Use when creating a Linear Project end-to-end from an Acid Prophet artifact set, a spec file, or vibe-mode Q&A. Drafts the project plus complete traceable issue packets and their dependency graph before one approval gate, then batch-creates everything on Linear and recommends the first startable issue. Supports idempotent resume after partial failure.
argument-hint: "[spec-file] [--fresh]"
model: opus
effort: max
allowed-tools: Read, Glob, Grep, Bash, Write, Agent, mcp__claude_ai_Linear__list_teams, mcp__claude_ai_Linear__list_projects, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__save_project, mcp__claude_ai_Linear__save_milestone, mcp__claude_ai_Linear__save_issue, mcp__claude_ai_Linear__save_comment
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# linear-devotee:create-project

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

Rigid runbook. Match the user's language; keep technical identifiers unchanged.

> Voice cadence: at every user-visible workflow transition, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Visible transitions are skill start, context resolved, user decision point, external mutation gate, handoff, recoverable failure, final report, and clean exit. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice dispatch a precondition, never retry it, and never mention missing `warden` to the user.
> Voice flag: !`cat "$HOME/.claude/nuthouse/voice.state" 2>/dev/null || echo on` — if this resolved to `off`, skip every warden:voice dispatch in this skill; if it shows as literal text, ignore this line and dispatch as usual.

## Mode

**Full-cascade mode by default.** This skill drafts the project, its milestones, and complete issue bodies up front, validates Acceptance coverage plus the dependency graph, canonicalizes a complete mutation envelope containing every field later sent to Linear, presents its SHA-256 hash at one global preview, asks **a single approval gate bound to that hash**, then batch-creates exactly those approved bodies and relations on Linear in topological order. It reloads Linear and publishes a separately hash-bound verified graph receipt before any Maestro activation is allowed. On success it recommends the first unblocked created issue to start, but does not invoke `linear-devotee:greet` automatically.

`linear-devotee:create-milestone` and `linear-devotee:create-issue` remain invocable standalone and
may resume legacy cascades. An adaptive cascade containing `workflow_handoff` resumes only by
reinvoking `linear-devotee:create-project`, which revalidates the workflow, source artifacts,
Acceptance register, envelope, and approved hashes before any retry.

## Adaptive project-creation contract

This skill owns one authoritative workflow run from intent through the verified Linear cascade. A
caller may provide the kernel descriptor exactly as:

```text
WORKFLOW_HANDOFF:
  run_id: <uuid>
  path: <absolute manifest path>
  content_hash: sha256:<64 lowercase hex>
WORKFLOW_EXPIRES_AT: <canonical ISO timestamp>
ARTIFACT_INVENTORY: <canonical JSON array or absolute JSON path>
ARTIFACT_INVENTORY_HASH: sha256:<64 lowercase hex>
RETURN_TARGET: linear-devotee:create-project
```

A direct `acid-prophet:write-plan` `(l)` handoff has no earlier project-creation run. It instead
supplies all named artifact paths plus this bootstrap owner receipt pair:

```text
ARTIFACT_SET_RECEIPT: <absolute canonical JSON receipt path>
ARTIFACT_SET_RECEIPT_HASH: sha256:<64 lowercase hex>
```

The receipt is a closed, no-whitespace JSON object with fields in this order:
`schemaVersion: 1`, `owner: "acid-prophet:write-plan"`, `specAudit` containing the exact spec
`path`, raw-byte `contentHash`, `handoffEligible: true`, and `acceptanceTraceable: "pass"`, then
`artifacts` sorted by id with closed `{ id, owner, status, path, contentHash, gate }` entries, and
the ordered `acceptanceIds`. `status` is `complete` or, only for `constitution-gates`,
`not-applicable`; the latter requires null path/hash and the exact absent-constitution gate. Each
entry's owner must match the closed ownership table below even though `write-plan` emits the
aggregate receipt. Its raw bytes must equal its canonical serialization and
`ARTIFACT_SET_RECEIPT_HASH` hashes those exact bytes. Allowed artifact ids are `audited-spec`,
`project-plan`, `typed-contracts`, `quickstart-evidence`, `codebase-map`, and
`constitution-gates`; every entry's gate identifies the owner gate that actually passed. The
receipt is only bootstrap proof before a run exists—it never substitutes for a same-run manifest
after `resolveWorkflowDecision` persists those exact references.

`RETURN_TARGET` is present on an upstream return as well as on the request that caused it. The
inventory is sorted by `artifact_type`; every entry contains `artifact_type`, `owner`,
`status: "missing" | "complete" | "not-applicable"`, `path`, and `content_hash`. A complete
file hashes its raw bytes. A directory hash recursively enumerates entries, rejects symlinks and
non-regular files, sorts each normalized POSIX relative path bytewise, and feeds SHA-256 repeated
records made from the UTF-8 path bytes, one NUL byte, the ASCII base-10 byte length without leading
zeros, one NUL byte, and the raw file bytes. Missing/not-applicable entries have
`path: null` and `content_hash: null`; complete entries require a normalized absolute path and
`sha256:` hash. Serialize the closed fields in the order shown, sort entries by `artifact_type`,
then encode one no-whitespace JSON array and SHA-256 only those canonical UTF-8 bytes as
`ARTIFACT_INVENTORY_HASH`. When the inventory is passed by path, parse its JSON, reject unknown or
missing fields, validate the same closed schema, canonicalize it by this rule, and hash that one
serialization; never create a second hash from container whitespace or a trailing newline.
Only `constitution-gates` may be `not-applicable`. It is applicable exactly when the regular file
`${PROJECT_ROOT}/docs/acid-prophet/constitution.md` exists; `acid-prophet:write-plan` is its single
consumer/recorder and this workflow never creates a constitution implicitly. `completed_capabilities` is the sorted set of complete or valid
not-applicable artifact types. A completed capability must not dispatch its owner again.

The profile-to-artifact mapping is domain policy; do not add it to the shared kernel:

| Effective profile | Required before the cascade preview                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quick`           | `project-brief`, `acceptance-register`                                                                                                                                       |
| `standard`        | `project-brief`, `acceptance-register`, `audited-spec`, `project-plan`                                                                                                       |
| `strict`          | `project-brief`, `acceptance-register`, `audited-spec`, `project-plan`, `guided-spec-review`, `constitution-gates`, `typed-contracts`, `quickstart-evidence`, `codebase-map` |

Artifact ownership is closed and deterministic:

| Artifact types                                                                                 | Owner                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------- |
| `project-brief`, `acceptance-register`                                                         | `linear-devotee:create-project` |
| `audited-spec`, `guided-spec-review`                                                           | `acid-prophet:write-spec`       |
| `project-plan`, `constitution-gates`, `typed-contracts`, `quickstart-evidence`, `codebase-map` | `acid-prophet:write-plan`       |

Every profile additionally requires the immutable kernel gates and one complete cascade preview of
the project, milestones, issues, dependencies, Acceptance allocation, and exact mutation fields.
Quick collects its concise `project-brief` and `acceptance-register` locally. Never renumber,
replace, or silently synthesize an accepted `AC-###` id. Standard and strict request spec-owned
artifacts from `acid-prophet:write-spec`; plan, contract, quickstart, codebase-map, and applicable
constitution evidence from `acid-prophet:write-plan`. Extra already-valid artifacts may remain in the inventory, but they never
downgrade or replace an effective profile requirement.

### Exact kernel call shapes

- Initial resolution: call `discoverGitContext(PROJECT_ROOT)`; normalize the active runtime input
  with `normalizeRuntimeWorkflowInput`; classify with `classifyWorkflow`; resolve the complete
  configuration stack with `resolveConfiguration`; and construct `policyInput` from that
  configuration, the classified workflow, normalized artifact/repository risk evidence, and any
  declared capability graph. The workflow step below must build `runtimeInput`,
  `bootstrapArtifactRefs`, and the canonical evidence before `resolveWorkflowDecision`. Mint one
  UUID v4 `runId`.
  Set `expiresAt` once to the earlier of the active worktree override expiry and 24 hours after the
  canonical `now` (or 24 hours after `now` when there is no override). Call this boundary exactly
  once:

  ```js
  const gitContext = discoverGitContext(PROJECT_ROOT);
  const repositoryConfigPath = `${PROJECT_ROOT}/.nuthouse/workflow.json`;
  const worktreeState = readWorktreeOverride(gitContext, { now, repositoryValidated: false });
  runtimeInput =
    activeRuntime === "claude-code"
      ? {
          ...runtimeInput,
          projectIntent: "explicit",
          request: authoritativeRequest,
          branch: currentBranch,
          linear: { ...runtimeInput.linear, teamKeys: validatedLinearTeamKeys },
          configuration: {
            ...runtimeInput.configuration,
            projectRoot: PROJECT_ROOT,
            personalConfigPath,
            repositoryConfigPath,
            worktreeOverride: worktreeState.override,
            now,
          },
          riskEvidence: canonicalRiskEvidence,
        }
      : {
          ...runtimeInput,
          project_intent: "explicit",
          prompt: authoritativeRequest,
          git: { ...runtimeInput.git, branch: currentBranch },
          linear: { ...runtimeInput.linear, team_keys: validatedLinearTeamKeys },
          configuration: {
            ...runtimeInput.configuration,
            project_root: PROJECT_ROOT,
            personal_config_path: personalConfigPath,
            repository_config_path: repositoryConfigPath,
            worktree_override: worktreeState.override,
            now,
          },
          risk_evidence: canonicalRiskEvidence,
        };
  const normalized = normalizeRuntimeWorkflowInput(activeRuntime, runtimeInput);
  const workflow = classifyWorkflow({
    projectIntent: normalized.projectIntent,
    request: normalized.request,
    branch: normalized.branch,
    linearTeamKeys: normalized.linearTeamKeys,
  });
  const configuration = resolveConfiguration(normalized.configuration);
  if (worktreeState.diagnostics.some(({ code }) => code === "expired-worktree-override")) {
    readWorktreeOverride(gitContext, { now, repositoryValidated: true });
  }
  const policyInput = {
    configuration,
    workflow,
    riskEvidence: normalized.riskEvidence,
    ...(normalized.capabilities === undefined ? {} : { capabilities: normalized.capabilities }),
  };
  let currentRun = resolveWorkflowDecision({
    gitContext,
    runId,
    policyHash,
    expiresAt,
    policyInput,
    expectedRevision: 0,
    now,
    artifacts: bootstrapArtifactRefs,
  });
  ```

  A blocked/ambiguous resolution throws and is never persisted. `currentRun` is the common result
  shape for this fresh branch and the handoff branch below: it always carries `manifest`,
  `contentHash`, `handoff`, and `decision`. On its persisted result validate
  `workflow`, `effectiveProfile`, and `enabledCapabilities`; persisted decisions intentionally have
  no `blocked` field.

- Handoff consumption uses this exact input shape:

  ```js
  currentRun = consumeManifestHandoff(
    {
      handoff,
      gitContext,
      policyHash,
      now,
      replacement: { expiresAt, artifacts },
    },
    { resolveAuthoritatively },
  );
  ```

  The synchronous `resolveAuthoritatively` rebuilds the same authoritative `policyInput` and calls
  policy resolution at most once; it may not change `run_id`, requested profile, or inputs. Use the
  supplied future `WORKFLOW_EXPIRES_AT`; if it has expired, renew it once with the same initial
  expiry rule before passing `replacement.expiresAt`, and return that refreshed canonical expiry.
  Pass all current complete artifact references as closed camelCase `{ id, path, contentHash }`
  values. A malformed descriptor (including a non-schema `content_hash`) or descriptor path
  mismatch blocks as `invalid-manifest-handoff` or `manifest-handoff-out-of-scope`. A schema-valid
  descriptor whose content hash no longer matches is `content-hash-mismatch` and may use this one
  recovery path, as may a missing/expired/corrupt/out-of-scope inspected manifest. `runtime-drift`
  blocks; recovery never recurses.

- Manifest updates use this exact input shape:

  ```js
  currentRun = writeDecisionManifest(
    gitContext,
    {
      runId: currentRun.manifest.runId,
      policy: currentRun.manifest.decision,
      artifacts: canonicalCompleteArtifactRefs,
      policyHash: currentRun.manifest.policyHash,
      expiresAt: currentRun.manifest.expiresAt,
    },
    {
      expectedRevision: currentRun.manifest.revision,
      observedContentHash: currentRun.contentHash,
      now,
    },
  );
  ```

  Preserve every unchanged complete artifact reference; missing/not-applicable inventory state
  remains in the separately hash-bound inventory. A stale revision or observed hash is
  `workflow-state-conflict`.

## Workflow

0. Session store: if `$CLAUDE_SESSION_ID` is set and `$ARGUMENTS` does not contain `--fresh`, read `<PROJECT_ROOT>/.claude/nuthouse/sessions/${CLAUDE_SESSION_ID}.json`.
   - If `acid-prophet.handoff_spec` is present and `acid-prophet._handoff_spec_path` equals `spec_path` (i.e. not stale), default to **file mode** with `handoff_spec.path` — skip asking the user. Announce: "using spec from session store: `<path>`".
   - If the store is absent, corrupt, or `handoff_spec` is stale, proceed normally (ask user).
   - When the invocation includes the named Acid Prophet fields `SPEC_FILE`, `PLAN_FILE`, `CONTRACTS_DIR`, `QUICKSTART_FILE`, `CODEBASE_MAP_FILE`, `CONSTITUTION_FILE`, prefer those explicit values over session state and preserve all six as `ARTIFACT_SET`.
   - Parse `ARTIFACT_SET_RECEIPT` and `ARTIFACT_SET_RECEIPT_HASH` as an inseparable optional pair. They are valid only with the complete named `ARTIFACT_SET`, without `WORKFLOW_HANDOFF`, and with the exact bootstrap receipt contract above. One field without the other, a receipt on a vibe/file-only call, or a receipt combined with a workflow handoff blocks before resolution.
   - Also parse the named `WORKFLOW_HANDOFF`, `WORKFLOW_EXPIRES_AT`, `ARTIFACT_INVENTORY`, `ARTIFACT_INVENTORY_HASH`, and `RETURN_TARGET` fields. They are a single unit: if any is present, require all five, require `RETURN_TARGET: linear-devotee:create-project`, and never infer a missing run id, path, hash, expiry, inventory, inventory hash, or return target from conversation prose.

1. Resume detection: read `${CLAUDE_PLUGIN_DATA}/chain-${CLAUDE_SESSION_ID}.json` if present.
   - If `phase: "committing" | "partial_failure" | "written"`: require `workflow_handoff`, `workflow_expires_at`, `effective_profile`, `artifact_inventory`, `artifact_inventory_hash`, `acceptance_register_hash`, `completed_capabilities`, `cascade_preview`, `mutation_envelope`, `normalized_graph`, `payload_hash`, `approved_payload_hash`, `graph_hash`, and every pending issue's non-empty pre-approved `sdd_body`. Consume `workflow_handoff` with the exact one-fallback recipe above before any Linear read; a recoverable invalid/expired handoff may resolve once using `workflow_expires_at`, while `runtime-drift`, disagreement, a second fallback, or a different run blocks. Require `workflow === "project-creation"`. Then recompute every complete entry's raw-file or canonical directory digest from its stored absolute path, reject missing/wrong-kind/symlinked content, and re-evaluate the absent-constitution predicate for a not-applicable entry. Rebuild the closed canonical inventory from those observed digests, compare every entry to its frozen `content_hash`, and require the rebuilt `artifact_inventory_hash` to equal both the stored hash and `cascade_preview.source_artifact_inventory_hash`. Re-read the Acceptance register bytes and require their raw hash to equal `acceptance_register_hash`. Any mismatch stops `source_artifact_changed`, invalidates the approved cascade, and returns to drafting/preview; perform this entire source check before the project graph loader or any other Linear read. Require a `cascade_preview` whose payload/graph hashes equal the stored authoritative hashes and revalidate the complete envelope, then dispatch `linear-devotee:project-graph-loader` with the approved project `client_ref`, team id, chain-state path, and `PROJECT_ID: <persisted id | _unknown_>`. The loader must resolve an unknown id only by the exact project marker inside that team; zero or multiple matches stop `resume_state_unknown` without a write. Merge only exact marker/id and relation confirmations into `confirmed_operations`, fill matching null ids, remove confirmed edges from `blocked_by_pending`, and persist. Retry only operations still absent from this authoritative reload. Announce "resuming partial cascade" with confirmed vs pending counts, then skip to **step 9 (batch commit)**. If the loader reports unknown data, stop `resume_state_unknown`; if a legacy entry lacks the envelope/graph/hash/body fields, stop with `legacy_issue_body_missing` and route it through `linear-devotee:create-issue`. Never generate an issue body or retry an unclassified write after the cascade approval gate.
   - If `phase: "committed"`: warn the user that the cascade already completed for this session and exit `already-committed`. Suggest `--fresh` to start a new cascade.
   - Otherwise: continue from step 2.

2. Preconditions:
   - Verify Linear access with `ToolSearch` query `linear`; abort clearly if unavailable. Read the available teams once, derive the closed uppercase `validatedLinearTeamKeys`, and retain that team snapshot for step 4. It is classification evidence, not permission to mutate.
   - Verify git repo with `git rev-parse --is-inside-work-tree`.
   - Ensure `${CLAUDE_PLUGIN_DATA}` exists.
   - Import only from `${CLAUDE_PLUGIN_ROOT}/lib/workflow/index.mjs` and read `${CLAUDE_PLUGIN_ROOT}/lib/workflow/bundle.json`; its `sourceHash` is the consumer `policyHash`. Import `readWorktreeOverride` from that same entry point. Do not import repository `_shared` files and do not require or invoke Warden.
   - Before resolving a fresh run, perform the authoritative input bootstrap. Set `authoritativeRequest` to the exact current invocation/request text and `currentBranch` to the current Git branch; do not synthesize or remove Linear identifiers. Identify the input mode; read every supplied non-`_none_` artifact and applicable repository instruction; and collect risk evidence from explicit metadata, repository rules, affected paths, and the complete supplied spec/artifact content. Map only the kernel's closed risk categories and sources. Evidence derived from a ratified/approved spec uses `{ category, source: "approved-spec", state: "confirmed" | "unresolved", potentiallyCritical }`; uncertainty is never omitted or downgraded. This scan happens before `resolveWorkflowDecision`, so artifact evidence can raise the profile. Because this domain skill is an explicit project-creation entry point, populate Claude Code's `projectIntent: "explicit"` or Codex's `project_intent: "explicit"` together with the exact request/prompt, branch, and `validatedLinearTeamKeys`; never rely on an unspecified hook field.
   - Build `runtimeInput.configuration` from the active runtime's personal configuration path (`personalConfigPath`), `${PROJECT_ROOT}/.nuthouse/workflow.json` (`repositoryConfigPath`), any invocation-only profile, and `readWorktreeOverride(gitContext, { now, repositoryValidated: false })`. Resolve configuration before permitting expired-state cleanup; only after repository configuration succeeds may a second read with `repositoryValidated: true` remove an expired override. Surface the returned diagnostics; never assume the core `standard` default is the complete stack.
   - If the optional bootstrap owner receipt is present, read and hash it, require byte-for-byte canonical JSON, validate its closed fields and exact per-artifact owners, rerun the referenced spec auditor in report-only mode, require `handoffEligible === true` and `acceptance-traceable === pass`, verify every complete artifact path/raw hash and artifact-specific gate, verify the exact constitution applicability predicate, and reject extra/missing refs. For `typed-contracts`, use the canonical directory digest. Set `bootstrapArtifactRefs` to verified `status: "complete"` entries projected as camelCase `{ id, path, contentHash }`; retain a verified not-applicable constitution entry for the separate inventory but never put null refs in the kernel manifest. A receipt failure blocks; it never falls back to trusting file existence. Without a valid receipt, set `bootstrapArtifactRefs = []` and treat supplied artifacts only as owner candidates.
   - With a supplied `WORKFLOW_HANDOFF`, assign `currentRun = consumeManifestHandoff(...)` using the current git context and `policyHash`. A valid in-scope manifest is reused without reclassification. A well-formed `content-hash-mismatch` or recoverable inspected status gets the kernel's one permitted authoritative local resolution; a malformed descriptor, descriptor path mismatch, `runtime-drift`, disagreement, a second fallback, or remaining ambiguity blocks before Linear mutation.
   - Without a supplied handoff, normalize the fully bootstrapped authoritative inputs with the active runtime adapter from the same install-local bundle, build its `policyInput`, and assign `currentRun = resolveWorkflowDecision(...)` exactly once with `artifacts: bootstrapArtifactRefs` so resolution, initial artifact attachment, and persistence share one boundary. Reopen the persisted manifest and retain `currentRun.handoff`'s exact `{ run_id, path, content_hash }` as `WORKFLOW_HANDOFF`; do not first resolve a disposable decision and then resolve it again for persistence.
   - A new blocked/ambiguous decision is rejected by `resolveWorkflowDecision` before persistence. On the persisted/reused decision, require `decision.workflow === "project-creation"` (equivalently, block when `workflow !== "project-creation"`), a valid `effectiveProfile`, and enabled immutable `external-mutation`; do not require a persisted `blocked` field because the closed manifest projection omits it. Set `effective_profile` from that persisted decision, never from prose or an artifact. This establishes one authoritative workflow run across all later handoffs.

3. Input mode:
   - **Artifact-set mode**: named `SPEC_FILE` / `PLAN_FILE` / `CONTRACTS_DIR` / `QUICKSTART_FILE` / `CODEBASE_MAP_FILE` / `CONSTITUTION_FILE` fields were passed. Verify every non-`_none_` path exists, read the spec first, summarize the set in one paragraph, and continue without dropping optional artifacts. An artifact counts as complete only when the current manifest carries its exact path/hash; a receipt-verified absent constitution counts as not-applicable only in the separate hash-bound inventory. That includes artifacts admitted during fresh persistence by a validated `acid-prophet:write-plan` bootstrap owner receipt; after attachment they are ordinary same-run refs and `create-project` must not redispatch its owner. Without that receipt, ratified/approved/ready/implementing frontmatter plus `verified-by: spec-auditor` and existing plan files remain owner candidates rather than proof, so their owner gates run without regenerating any already receipt-verified artifact.
   - **File mode**: `$ARGUMENTS` contains a path to an existing `.md` (or one was auto-detected from the session store in step 0); read it, summarize in one paragraph, confirm. Apply the same owner-gate checks as artifact-set mode; file existence alone never proves `audited-spec` or `project-plan` complete.
   - **Vibe mode**: ask one at a time — north star, why now, measurable outcomes, constraints, out of scope. Turn each observable outcome into a stable EARS criterion (`[AC-001] WHEN|IF ..., THE SYSTEM SHALL ...`), show the compact Acceptance register, and ask the user to approve or revise it. Persist the approved Q&A plus register to `${CLAUDE_PLUGIN_DATA}/vibe-${CLAUDE_SESSION_ID}.txt`. Never invent or silently renumber ids.
   - In every mode, write one concise normalized brief to `${CLAUDE_PLUGIN_DATA}/brief-<run_id>.md`. Extract the exact active Acceptance section from the approved vibe register or source spec (heading `Acceptance`, stop at the next same/higher heading; exclude history), preserve criterion order and EARS text byte-for-byte, and reject duplicate ids. If a file/artifact input has no active Acceptance section, derive a proposed EARS register only from its observable outcomes (ask one focused question at a time when none are stated), show it, and require the user to approve or revise it exactly as in vibe mode; never silently synthesize criteria. Write the approved register to `${CLAUDE_PLUGIN_DATA}/acceptance-<run_id>.md`. These become the `project-brief` and `acceptance-register` entries. Its raw-file hash is `acceptance_register_hash`; no downstream artifact may change it.
   - Normalize every supplied or locally created input into `ARTIFACT_INVENTORY`, verify each complete path and `content_hash`, and compute `artifact_inventory_hash` from canonical artifact-type order. Derive `completed_capabilities`; do not trust a caller-supplied completion list. Attach complete artifact references to the same decision manifest with `writeDecisionManifest` and its optimistic revision, then replace `WORKFLOW_HANDOFF` with the refreshed descriptor returned by that write.
   - Compare the inventory with the effective profile table before workspace reads or drafting. For each missing artifact, use exactly one declared owner. Send the owner the current descriptor and inventory plus the explicit return target:
     ```text
     WORKFLOW_HANDOFF:
       run_id: <unchanged run id>
       path: <current manifest path>
       content_hash: <current manifest content hash>
     WORKFLOW_EXPIRES_AT: <current canonical expiry>
     ARTIFACT_INVENTORY: <canonical inventory JSON or absolute path>
     ARTIFACT_INVENTORY_HASH: <canonical inventory hash>
     REQUESTED_ARTIFACTS: <sorted missing artifact types owned by the target skill>
     SPEC_FILE: <candidate spec path | _none_>
     ACCEPTANCE_REGISTER: <absolute acceptance register path>
     ACCEPTANCE_REGISTER_HASH: <acceptance_register_hash>
     RETURN_TARGET: linear-devotee:create-project
     ```
   - On return, require the same `run_id`, verify the returned `ARTIFACT_INVENTORY_HASH`, consume the refreshed handoff, verify every returned path/hash and owner, rebuild `artifact_inventory_hash`, and continue with the next missing owner. If an artifact is already in `completed_capabilities`, this skill must not dispatch its owner again. A handoff that returns without every requested artifact stops with the missing types, current run, and safe return target; never bounce between Acid Prophet and Linear Devotee.
   - Continue only when every required artifact is complete (or `constitution-gates` is validly `status: "not-applicable"`). Any artifact content change after a draft or preview exists must invalidate the cascade and rebuild the preview before approval.

4. Linear workspace:
   - Reuse the team snapshot fetched for classification (refresh only if the provider explicitly invalidated it) and fetch existing project statuses with `list_projects`.
   - If multiple teams, ask user to choose.
   - Fetch the chosen team's existing issue labels with `list_issue_labels`. Capture an immutable `LABEL_MAP` of exact label name → id before drafting and approval; never create labels implicitly.
   - Pick initial project status by `status.type`: prefer `backlog`, fallback `planned`; never hardcode status names.

5. Draft project + decomposition:
   - If session store was read in step 0 and `relevant_files` is present, include it in the prompt.
   - Dispatch the logical `linear-devotee:project-drafter` agent with:
     ```text
     EFFECTIVE_PROFILE: <quick | standard | strict>
     WORKFLOW_HANDOFF:
       run_id: <run id>
       path: <manifest path>
       content_hash: <manifest content hash>
     ARTIFACT_INVENTORY: <canonical inventory JSON or absolute path>
     ARTIFACT_INVENTORY_HASH: <artifact_inventory_hash>
     ACCEPTANCE_REGISTER: <ordered AC-### ids plus exact EARS text>
     ACCEPTANCE_REGISTER_HASH: <acceptance_register_hash>
     SPEC_FILE: <abs path | _none_>
     PLAN_FILE: <abs path | _none_>
     CONTRACTS_DIR: <abs path | _none_>
     QUICKSTART_FILE: <abs path | _none_>
     CODEBASE_MAP_FILE: <abs path | _none_>
     VIBE_BULLETS: <abs path | _none_>
     PROJECT_ROOT: <git root>
     RELEVANT_FILES:
     - <abs path> (omit section when not available from session store)
     ```
   - Capture the returned Project-SDD, decomposition (`flat | phased`), milestones, and complete `## Issue packets` in deterministic dependency order. Each packet is the future Linear description, not a title-only placeholder. Require its Adaptive receipt to return the exact `acceptance_register_hash` and `artifact_inventory_hash`; hash mismatches block before preview. Downstream planning context may refine ordering and implementation details but never override source Acceptance truth.

6. Clarify:
   - Scan `_unclear_` and `Suggested clarifying questions` across the whole draft (project + milestones + issues).
   - Ask one blocking question at a time, patch the draft, repeat until clean or user ships as-is.
   - Run the traceability pre-flight before preview:
     - every source `AC-###` is covered by at least one issue packet;
     - every non-foundation issue covers at least one known source id;
     - every `foundation` issue has a concrete `foundation-reason`;
     - every `draft-key` is unique and every `depends-on` target exists;
     - the dependency graph is acyclic.
   - Materialize the exact `normalized_graph` contract with every dependency represented as `dependentRef -> blockerRef`. Every issue has `acceptanceIds`; a foundation-only issue uses `acceptanceIds: []` plus its non-empty `foundationReason`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate <graph-file>`. This executable gate additionally rejects unknown targets, self-edges, duplicate edges, cross-project membership, invalid/legacy direction, cycles, unknown milestones, missing coverage, and mixed Acceptance/foundation coverage. Any failure is blocking and must identify the exact entity or relation. Repair the owning issue packet or source spec, then repeat this pre-flight. Never create or renumber an `AC-###` id in this skill.

7. Assign client refs and write the preview file:
   - Re-read and hash every complete artifact, canonicalize the inventory, and require its hash to equal `artifact_inventory_hash`. If any artifact was added, removed, or changed during drafting, invalidate the cascade and rebuild the preview from step 5; never approve output derived from stale artifacts.
   - Mint a stable `client_ref` (UUID v4) for the project, every drafted milestone, and every drafted issue. These refs are the only stable identifiers until Linear assigns real ids; they unlock idempotent recovery on partial failure.
   - Resolve each issue packet's exact `milestone` name to one drafted milestone and persist that milestone's `client_ref` as `milestone_client_ref`. `_none_` maps to `null`. Missing or duplicate milestone-name matches are blocking preview errors; never defer this resolution to the mutation phase.
   - Resolve every `suggested-labels` name against the pre-approval `LABEL_MAP`. Before writing the preview, warn and drop unknown names, then persist both the approved names and their exact ids. The mutation phase must replay those ids; it does not reinterpret drafter suggestions.
   - Add the stable marker `<!-- nuthouse-client-ref: <client_ref> -->` to the exact approved project, milestone, and issue descriptions. For a foundation-only issue also add `<!-- nuthouse-foundation-reason: <base64url UTF-8 reason> -->`. These markers are part of the previewed payload and are the only safe correlation keys after an ambiguous Linear timeout or authoritative reload; never add them after approval.
   - Write the canonical graph validator output to `${CLAUDE_PLUGIN_DATA}/graph-${CLAUDE_SESSION_ID}.json` as `normalized_graph` and capture its `graphHash` as `graph_hash`.
   - Materialize `${CLAUDE_PLUGIN_DATA}/envelope-${CLAUDE_SESSION_ID}.json` with schema version 1, the whole `normalized_graph`, and the exact project/milestone/issue mutation fields: project `clientRef`, `name`, full marked `description`, `teamIds`, `statusId`; milestone `clientRef`, `projectRef`, `name`, full marked `description`, `targetDate`; issue `clientRef`, `draftKey`, `projectRef`, nullable `milestoneRef`, `teamId`, `title`, full marked `description`, exact `labelIds`, and `blockedByRefs`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs validate-envelope <envelope-file>`. Persist its canonical `envelope` as `mutation_envelope`, its `payloadHash` as `payload_hash`, and require its `graphHash` to equal `graph_hash`. Re-run both validations after every preview edit; if canonical content changes, replace both files and hashes before re-asking for approval.
   - Write `${CLAUDE_PLUGIN_DATA}/preview-${CLAUDE_SESSION_ID}.md` containing the one complete cascade preview. The preview is a deterministic rendering of the canonical envelope, not a second independently editable payload:

     ````markdown
     # Cascade preview — <project name>

     <project SDD body, unchanged from drafter>

     <!-- nuthouse-client-ref: <project uuid> -->

     **Approved mutation payload hash:** `sha256:<64 lowercase hex>`
     **Verified graph hash:** `sha256:<64 lowercase hex>`
     **Workflow run:** `<run_id>`
     **Artifact inventory hash:** `sha256:<64 lowercase hex>`

     - Project client ref: `<client_ref>`
     - Team ids: `<exact teamIds>`
     - Status id: `<exact statusId>`

     ## Milestones

     ### Phase 1: <name> <!-- client_ref: <uuid> -->

     - Scope: <one line>
     - Project ref: <project client_ref>
     - Target date: <YYYY-MM-DD | none>

     ### Phase 2: …

     ## Issues

     ### <issue title> <!-- draft_key: I-001 · client_ref: <uuid> -->

     - Milestone: <name | none>
     - Project ref: <project client_ref>
     - Milestone ref: <milestone client_ref | null>
     - Team id: <exact teamId>
     - Depends on: <client_ref list | none>
     - Covers: AC-001, AC-002 | foundation
     - Foundation reason: <text | n/a>
     - Suggested labels: <existing labels | none>
     - Label ids: <exact labelIds | none>

     <the complete Goal / Context / Files referenced / Constraints /
     Acceptance criteria / Non-goals body from the issue packet>

     <!-- nuthouse-client-ref: <issue uuid> -->

     ## Canonical mutation envelope

     ```json
     <the complete canonical mutation_envelope JSON, byte-for-byte equivalent to the validated envelope file>
     ```
     ````

   - The HTML comments are load-bearing — they tie each preview entry to its stable draft key and `client_ref` so an edited file can be re-parsed without losing identity. Map `depends-on` draft keys to client refs before writing. The canonical JSON section makes every replay field human-visible, including project `teamIds`/`statusId`, milestone refs/target dates, and issue `teamId`/`labelIds`/`blockedByRefs`; the friendly sections must agree with it.
   - After graph/envelope validation succeeds, record `cascade_preview: { path, payload_hash, graph_hash, source_artifact_inventory_hash }` beside—not inside—the frozen upstream artifact inventory. This avoids a self-referential preview/inventory hash. `artifact_inventory_hash` is immutable source provenance for this preview; `payload_hash` remains the sole approval identity for exact Linear mutations.

8. Preview and approve:
   - Print every project, milestone, issue, normalized dependency, the exact `payload_hash`, `graph_hash`, `run_id`, and `artifact_inventory_hash`, plus project name, team, status, counts, and `Preview written to: <path>`. This is the single global gate for the complete cascade; do not show or approve fragments separately.
   - Ask `Create everything on Linear? (y / edit / cancel)`.
   - On `edit`: instruct the user to edit `<preview path>` directly. After they signal done, re-parse the full file (preserving `client_ref` comments; new entries get a fresh ref, removed entries are dropped) and reject any disagreement between friendly fields and canonical JSON. Re-run the complete traceability/dependency pre-flight from step 6 plus milestone and label resolution from step 7, canonicalize a new envelope, overwrite the preview with the deterministic rendering and complete canonical JSON, refresh all hashes, re-print the full summary, and only then re-ask. Loop until `y` or `cancel`.
   - On `cancel`: write chain-state with `phase: "cancelled"` and stop with `cancelled`.
   - Continue only on `y`. Immediately persist `approved_payload_hash: <payload_hash>` plus immutable copies of `workflow_handoff`, `workflow_expires_at`, `effective_profile`, `artifact_inventory`, `artifact_inventory_hash`, `acceptance_register_hash`, `completed_capabilities`, `cascade_preview`, `mutation_envelope`, and `normalized_graph` in chain-state. Before the first and every resumed mutation, consume the same-run handoff; recompute every complete artifact's raw-file or canonical directory digest from its stored path; re-evaluate not-applicable entries; rebuild and hash the canonical inventory; and re-read/hash the Acceptance register bytes. Require every observed entry/hash and both rebuilt source hashes to equal their frozen values, then run `validate-envelope` again and require its `payloadHash` to equal both `payload_hash` and `approved_payload_hash` and its `graphHash` to equal `graph_hash`; otherwise stop `source_artifact_changed` or `approval_hash_mismatch` and return to preview. No further per-resource gate after this point.

9. Batch commit (the one place we mutate Linear):
   - Write chain-state immediately with `phase: "committing"` so a crash mid-flight is recoverable. Schema:
     ```json
     {
       "current": "create-project",
       "phase": "committing | partial_failure | written | committed | cancelled",
       "workflow_handoff": {
         "run_id": "<uuid>",
         "path": "<absolute manifest path>",
         "content_hash": "sha256:<64 lowercase hex>"
       },
       "workflow_expires_at": "<canonical ISO timestamp>",
       "effective_profile": "quick | standard | strict",
       "artifact_inventory": [],
       "artifact_inventory_hash": "sha256:<64 lowercase hex>",
       "acceptance_register_hash": "sha256:<64 lowercase hex>",
       "completed_capabilities": [],
       "cascade_preview": {
         "path": "<absolute preview path>",
         "payload_hash": "sha256:<64 lowercase hex>",
         "graph_hash": "sha256:<64 lowercase hex>",
         "source_artifact_inventory_hash": "sha256:<64 lowercase hex>"
       },
       "project": {
         "client_ref": "<uuid>",
         "id": "<linear id or null>",
         "url": "<url or null>",
         "name": "<name>",
         "team_id": "<team.id>",
         "team_key": "<team.key>",
         "description": "<exact approved marked Project-SDD body>",
         "status_id": "<approved status id>"
       },
       "drafts": {
         "decomposition": "flat | phased",
         "milestones": [
           {
             "client_ref": "<uuid>",
             "id": "<id or null>",
             "name": "<name>",
             "scope": "<one line>",
             "description": "<exact approved marked scope>",
             "target_date": "<YYYY-MM-DD or null>",
             "url": "<url or null>"
           }
         ],
         "issues": [
           {
             "client_ref": "<uuid>",
             "draft_key": "I-001",
             "id": "<id or null>",
             "identifier": "<TEAM-N or null>",
             "title": "<title>",
             "milestone_client_ref": "<uuid>",
             "blocked_by_refs": ["<uuid>"],
             "acceptance_refs": ["AC-001", "AC-002"],
             "foundation_reason": "<string or null>",
             "suggested_label_names": ["<existing label name>"],
             "label_ids": ["<pre-approved label id>"],
             "sdd_body": "<exact approved Goal/Context/Files/Constraints/Acceptance/Non-goals markdown>",
             "url": "<url or null>"
           }
         ]
       },
       "preview_file": "<abs path>",
       "spec_file": "<abs path | _none_>",
       "source_acceptance_ids": ["AC-001", "AC-002"],
       "normalized_graph": {
         "schemaVersion": 1,
         "project": {},
         "milestones": [],
         "issues": [],
         "edges": []
       },
       "mutation_envelope": {
         "schemaVersion": 1,
         "graph": {},
         "project": {},
         "milestones": [],
         "issues": []
       },
       "graph_file": "<abs path to graph json>",
       "envelope_file": "<abs path to complete mutation envelope json>",
       "graph_hash": "sha256:<graph hash>",
       "payload_hash": "sha256:<64 lowercase hex>",
       "approved_payload_hash": "sha256:<same exact hash>",
       "confirmed_operations": [],
       "blocked_by_pending": [],
       "graph_receipt": {
         "marker": "nuthouse:project-graph-receipt",
         "schema_version": 1,
         "verified": false,
         "approved_hash": "sha256:<graph hash>",
         "actual_hash": null,
         "differences": [],
         "verified_at": null,
         "linear_comment_id": null
       },
       "created_at": "<ISO 8601>",
       "last_error": null
     }
     ```
   - **Approval invariant**: consume `workflow_handoff` and require its run and policy to match this chain. From every complete inventory path, recompute the raw-file or canonical directory digest, compare it with that entry's `content_hash`, re-evaluate not-applicable entries, rebuild the closed canonical inventory, and require its observed hash to equal `artifact_inventory_hash` and `cascade_preview.source_artifact_inventory_hash`; independently re-read the Acceptance register and require its raw hash to equal `acceptance_register_hash`. Only then run `project-graph.mjs validate-envelope` on `mutation_envelope`. Require the returned `payloadHash` to equal both `payload_hash` and `approved_payload_hash`, the returned `graphHash` to equal `graph_hash`, and the returned canonical graph to equal `normalized_graph`. A mismatch stops before Linear mutation. Every `save_*` argument and relation below must be projected directly from that freshly validated envelope; duplicated convenience fields in chain-state are indexes only and may never override it.
   - **Idempotency rule**: `confirmed_operations` is an append-only ledger keyed by `<kind>:<client_ref>` and `relation:<dependent_ref><-<blocker_ref>`. At every sub-step, skip an operation confirmed either by a successful response already persisted or by the resume loader's exact Linear marker/relation reload. `id != null` is a required projection of that ledger, not the only retry guard. On every invocation, retry only operations still absent from authoritative Linear reload; re-invocations never replay confirmed operations.
   - **9.a — Project**: if `project:<client_ref>` is unconfirmed, call `save_project` with the envelope project's exact `name`, `description`, `teamIds`, and `statusId`. On success, persist `id` + `url` and the confirmed operation before continuing. On timeout or API error, set `phase: "partial_failure"`, surface verbatim, and stop; the next invocation reloads the marker before deciding whether a retry is safe.
   - **9.b — Milestones (in `drafts.milestones[]` order)**: for each unconfirmed `milestone:<client_ref>`, locate exactly one same-ref envelope milestone and call `save_milestone` with its exact `name`, resolved `projectId`, `description`, and nullable `targetDate`. Persist `id` + `url` and its confirmed operation per entry. On error: persist, set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.c — Issues (topological order on `blocked_by_refs`)**: process only entries whose `blocked_by_refs` already resolve to created issues. For each:
     - Require the pre-approved `sdd_body`, `acceptance_refs`, and dependency fields persisted from the preview. If any are missing, set `phase: "partial_failure"`, set `last_error: "approved issue packet missing"`, and stop before this issue. Do not draft or expand content inside the mutation phase.
     - Resolve `milestone_client_ref` to exactly one entry in `drafts.milestones[]` and require that entry's `id` is non-null. Pass that id as `projectMilestoneId`. When `milestone_client_ref` is `null` / `_none_`, omit `projectMilestoneId`. A missing, duplicate, or uncreated reference sets `phase: "partial_failure"`, sets `last_error: "milestone_reference_unresolved"`, and stops before this issue; never guess from milestone name or array position.
     - Resolve every `blocked_by_ref` to exactly one created issue identifier. Any unresolved or duplicate mapping sets `phase: "partial_failure"`, sets `last_error: "dependency_reference_unresolved"`, and stops before mutation; never drop, guess, or defer an approved dependency silently.
     - Use the envelope issue's exact `labelIds`; do not refetch or reinterpret labels after approval. A current-schema state whose duplicated `label_ids` projection differs is `approval_hash_mismatch`. Legacy pending state without a complete mutation envelope is not replayable; never repair it by resolving labels after approval.
     - Call `save_issue` with the envelope issue's exact `teamId`, `title`, `description`, resolved `projectId`, resolved `projectMilestoneId`, exact `labelIds`, and `blockedBy` resolved only from its envelope `blockedByRefs`.
     - **`blockedBy` runtime guard**: if `save_issue` rejects `blockedBy` with a schema error, retry once without `blockedBy`, then append `{from_ref, to_ref}` edges to `blocked_by_pending` for a post-pass.
     - Persist `id`, `identifier`, `url`, and `issue:<client_ref>` in `confirmed_operations` per entry before continuing.
     - On API error: set `phase: "partial_failure"`, stop with `linear_error`.
   - **9.d — `blocked_by_pending` post-pass**: for each unconfirmed normalized edge call the Linear relation mutation exposed by the provider. On success, persist `relation:<dependent_ref><-<blocker_ref>` before dropping it from `blocked_by_pending`. A relation failure leaves `phase: "partial_failure"`; it is recoverable, but graph verification cannot pass and Maestro activation remains forbidden.
   - **9.e — authoritative reload and exact verification**: only after every entity and relation operation is confirmed, set `phase: "written"`, dispatch `linear-devotee:project-graph-loader`, and require `complete: true`. Write its `graph` to a scratch JSON and run `node ${CLAUDE_PLUGIN_ROOT}/scripts/project-graph.mjs compare <approved-graph> <actual-graph>`. Require the returned `approvedHash` to equal `graph_hash`, store its returned `actualHash`, copy every missing/extra/changed/reversed difference, and keep `"verified": false` on any loader unknown, hash mismatch, invalid actual graph, or comparison difference. Never compare the graph hash to the separate mutation `approved_payload_hash`, and never mutate Linear to paper over drift.
   - **9.f — durable verification receipt**: use the loader's exact client-ref → Linear-id map to add `decision_baseline: { issueIds, edges: [{ dependentIssueId, blockerIssueId }] }` to the receipt; this is the durable payload later bound by Maestro's `decision_hash`. Build a project comment headed `<!-- nuthouse:project-graph-receipt schema_version=1 -->` with `approved_hash`, `actual_hash`, `verified`, `differences`, `decision_baseline`, and timestamp. Write it through `save_comment(projectId: ...)`. Only an equivalent graph whose receipt comment succeeded becomes `graph_receipt.verified: true` and `phase: "committed"`. A failed comment write leaves `phase: "written"`, reports `verification_record_failed`, and refuses Maestro activation.

10. Patch source spec frontmatter when `SPEC_FILE` exists and `graph_receipt.verified === true`:
    - `linear-project: <project.id>`
    - `status: ready`
    - `last-reviewed: <today ISO date>`
    - Warn, do not abort, if frontmatter patch fails.
    - Do not alter Acceptance ids or bodies. The created issues already carry the approved `AC-###` references.

11. Recommend first issue:
    - On `phase: "committed"` and at least one created issue: pick the first startable issue (`drafts.issues[]` filtered by `id != null`, sorted by topological commit order, preferring entries with no `blocked_by_refs`; if every issue is blocked, pick the first issue whose blockers all have created Linear identifiers and clearly label that dependency assumption). Print `Recommended next issue: <identifier> - <title> - <url>`, `Start with: linear-devotee:greet <identifier>`, and `Project execution: monkey-maestro:start <project.id>`. The Maestro line is permitted only when `graph_receipt.verified === true`; otherwise print `Project execution: refused — graph unverified`. Do **not** write greet state, invoke `linear-devotee:greet`, invoke `linear-devotee:plan`, invoke Maestro, or continue automatically.

- On `phase: "partial_failure"`: stop with a structured resume report (see Final Report). Do **not** chain. Tell the user to reinvoke `linear-devotee:create-project` for the same session; do not offer `create-milestone` or `create-issue`, because only this entry point consumes `workflow_handoff` and re-hashes both frozen source registers before retry.
- On `phase: "cancelled"` or `already-committed`: stop.

## Final Report

```text
linear-devotee:create-project report
  Workflow run:      <run_id>
  Effective profile: <quick | standard | strict>
  Artifact inventory:<complete>/<required> · <artifact_inventory_hash>
  Project:           <name> - <url | (not created)>
  Team:              <team.key>
  Status:            <status.name> (<status.type>)
  Decomposition:     <flat: N | phased: M phases>
  Milestones:        <created>/<total>
  Issues:            <created>/<total>
  AC coverage:       <covered>/<source total> · <N foundation issues>
  Approved hash:     <sha256:... | _none_>
  Graph hash:        <sha256:... | _none_>
  Graph verification:<verified | unverified | not-run> · <N differences>
  Phase:             committed | written | partial_failure | cancelled | already-committed
  Last error:        <verbatim Linear error | _none_>
  Preview file:      <abs path>
  Chain state:       ${CLAUDE_PLUGIN_DATA}/chain-<session>.json
  Recommended next:  <identifier> - <title> - <url | _none_>
  Hand-off:          user-starts-greet <identifier> + optional monkey-maestro:start <project.id> | resume by reinvoking linear-devotee:create-project | stop | cancelled | linear_error | graph_unverified
```

## Never

- Mutate Linear before the user types `y` at the single approval gate.
- Draft, expand, or materially rewrite an issue body after the single approval gate.
- Create an issue when its `sdd_body`, `acceptance_refs`, or dependency record is missing.
- Add per-resource `(y)` gates inside the batch commit phase — the single global gate is the contract.
- Drop or rewrite a `client_ref` once minted — they are the recovery keys.
- Retry failed Linear writes blindly inside one cascade (the resume path handles retries on the next invocation, after the user knows).
- Treat a local id or title match as confirmation after an ambiguous write; require the exact `nuthouse-client-ref` marker or relation reload and append it to `confirmed_operations`.
- Mark a project verified, patch its source spec, or offer `monkey-maestro:start` unless exact comparison and the durable receipt comment both succeeded; otherwise refuse Maestro activation.
- Auto-rollback created entries on partial failure — Linear has no transaction; leave them and let the user decide.
- Run `git push`, `git commit`, or `git rebase`.
- Write outside plugin `data/`, except the confirmed spec frontmatter patch.
- Invoke another skill programmatically after the cascade commits.
- Reclassify or start a new workflow run during an upstream artifact handoff.
- Treat an artifact path without a verified `content_hash` as complete.
- Continue from a changed artifact inventory without rebuilding and reapproving the complete cascade.
