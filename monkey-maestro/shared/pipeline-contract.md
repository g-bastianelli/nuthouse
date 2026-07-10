# Pipeline Contract — the autopilot relay

Background knowledge shared by the `monkey-maestro` skills (`run`, `advance`, `halt`)
and the `queue-scout` agent. The relay conducts the existing build pipeline:
`linear-devotee` (issue context/plan) → implementation + `subroutine` → `moon-moth`
(verify) → `git-gremlin` (commit/pr/spawn).

## Principle: Linear is the source of truth

The relay must not maintain a shadow queue. Linear owns issue identity, project
membership, status, blockers, and ordering. GitHub owns PR existence and merge state.
Local files are **control plane only**:

- whether autopilot is armed for one Linear project in this repo,
- the relay id for logging and baton prompts,
- the plan gate,
- short audit breadcrumbs such as the last accepted issue/PR.

Local files must never decide which issue is current, which issue is next, or whether a
blocker is satisfied. Those facts are reconstructed from Linear and GitHub every time. If
local state and Linear disagree, Linear wins. The recorded `last_issue`/`last_pr` is only
the patron's relay-acceptance receipt; it can authorize the post-merge handoff but never
override GitHub's merge state.

## State paths — project-scoped and worktree-shared

```text
STATE_ROOT = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse/relays
PROJECT_STATE_DIR = <STATE_ROOT>/<LINEAR_PROJECT_ID>
RELAY_FLAG = <PROJECT_STATE_DIR>/autopilot.json
LOCK_DIR = <PROJECT_STATE_DIR>/lock
```

`--git-common-dir` resolves to the same shared `.git` directory from the main repo and
every linked worktree of that repo. This is load-bearing: the relay runs each issue in
its own spawned Superset worktree, and `git rev-parse --show-toplevel` resolves
differently in each worktree. `STATE_ROOT` lives inside `.git/`, so it is shared by that
repo's worktrees and never staged by `git add`.

`LINEAR_PROJECT_ID` is the only partition key. Every skill must resolve the current
issue's project from Linear (or from an issue-context/plan artifact that originated from
Linear) before it reads a flag. A flag for another project in the same repository is not
evidence that autopilot is on for the current worktree.

## The autopilot control flag

Path: `<PROJECT_STATE_DIR>/autopilot.json`.

```jsonc
{
  "relay_id": "<uuid v4>",
  "active": true,
  "repo": "/abs/path/.git", // git common dir, audit only
  "linear_project_id": "<id>", // required; must equal the directory name
  "plan_gate": "auto-clean", // auto-clean | manual | auto
  "last_issue": null, // audit/baton breadcrumb only
  "last_pr": null, // audit/baton breadcrumb only
  "last_halt_reason": null,
  "expires_at": "<ISO 8601>",
}
```

**Read rule.** A skill takes its autopilot branch only when all hold: it resolved the
current issue's project id, the matching `RELAY_FLAG` exists, its
`linear_project_id` equals that id, `active === true`, and `expires_at` is in the future.
Otherwise the skill behaves interactively. It must never scan for any active flag and
pick one arbitrarily.

**Write rule.** `run`, `advance`, and `halt` may update only the matching
`RELAY_FLAG`. No skill writes a relay queue file. The former `relay-<relay_id>.json`
state file is obsolete and must not be read as authority.

## Per-project relay lock

`LOCK_DIR` is an empty directory acquired with `mkdir <LOCK_DIR>`. `mkdir` is atomic,
so exactly one `run` invocation can own a given Linear project even when two invocations
start simultaneously. The owner writes `RELAY_FLAG` immediately after acquiring it and
keeps `LOCK_DIR` until the relay is halted or completed.

When `mkdir <LOCK_DIR>` fails, `run` must not overwrite the flag or start a second
worktree. If the matching flag is active and unexpired, report that relay. If no valid
flag exists, treat the lock as an in-progress initialization; only reclaim it after its
mtime is older than 30 minutes, then retry `mkdir` once. Never remove a fresh lock.

Whenever a relay is disarmed (`queue_drained`, a spawn failure, or `halt`), set its
matching flag to `active: false` and remove only its matching empty `LOCK_DIR`. A failed
verification intentionally leaves both in place: the relay is paused, not abandoned.

## Legacy global flag

`<git-common-dir>/nuthouse/autopilot.json` was the pre-project-scoping location. New
relays must not use it. If it is active and unexpired, `run` must refuse to start any new
relay and ask the user to finish or halt that legacy relay first; otherwise an old agent
could still treat the global file as authority. An inactive or expired legacy file is
ignored and is never updated. `monkey-maestro:halt --legacy` is the one explicit migration
operation that may disarm it.

## What replaced relay-state

There is no local `issues[]`, no local `stage`, and no local `completed_count` deciding
queue movement. Each fact is resolved at the edge where it is needed:

- **Current issue**: parse from `$ARGUMENTS` or the current branch.
- **Current PR**: `gh pr view` for the current branch.
- **Current issue status**: Linear issue status.
- **Next issue**: `queue-scout` reads the Linear project queue fresh.
- **Blockers**: Linear blocker relations and statuses.
- **Already in flight**: Linear `started` status, plus read-only local branch/worktree
  existence as a duplicate-spawn guard.
- **Accepted by the patron**: only the current `advance` invocation after the human `oui`;
  record as `last_issue`/`last_pr`. It authorizes resuming that exact relay only after
  GitHub reports the PR `MERGED`; it is never queue authority.

This makes the relay crash-tolerant without becoming a second database. A crashed spawn is
recovered by inspecting actual git branches/worktrees and Linear status, not by trusting a
pre-written local stage.

## The startable rule

A candidate issue is startable only when all are true:

1. It is in the target Linear project.
2. Its status type is not `completed`, `canceled`, or `started`.
3. Every blocker is actually completed/canceled in Linear.
4. No local branch or worktree already appears to target that issue id.

**Strict serial merge rule.** The just-accepted-but-unmerged issue does not unblock
dependents unless Linear/GitHub has actually moved it to a completed/merged state. More
strictly, the relay must not even select or spawn an independent next issue until the
current accepted PR is `MERGED` and its merge commit is verified on the base branch. This
guarantees each new worktree branches from a `main` that already contains the code it
depends on.

In `MODE: first`, a `PREFERRED_ISSUE` is a real preferred start: if it is startable, pick
it before scanning the rest of the queue. In `MODE: next`, the `ACCEPTED_ISSUE` is only an
anchor and must be excluded from candidates.

## Spawn agent selection

`git-gremlin:spawn` owns agent selection. `run`, `advance`, and `queue-scout` must not
choose or default the spawned agent. Every workspace spawn asks the user to choose
`codex` or `claude`; only after that choice does `git-gremlin:spawn` validate the selected
agent against `superset agents list --local` and create the workspace.

## Previous workspace cleanup

`advance` may pass `cleanup_workspace_id` to `git-gremlin:spawn` after the patron accepts
a movement and a next issue exists. The id must resolve to exactly one local Superset
workspace for the current branch, with `type: "worktree"`, and the current worktree must
be clean (`git status --porcelain` empty). `spawn` first verifies the new workspace exists
and opens it, then asks the patron whether to delete the previous workspace. It never
deletes `type: "main"`, the new workspace, or any workspace without that confirmation.
Cleanup failure or a declined deletion does not fail the already-created next workspace.

## Stop ladder

Any of these stops forward progress:

- `moon-moth:verify` fails in autopilot → report failing evidence and stop the chain.
- `git-gremlin:reviewer` returns blocking findings in `advance` → hand back to the
  implementation turn; do not present the acceptance gate.
- `git-gremlin:commit`/`pr` surface non-zero stderr → stop and surface stderr.
- `gh auth status`, `superset projects list`, or Linear queue access fails → disarm the
  flag with `last_halt_reason`.
- `queue-scout` finds no startable issue → disarm with `queue_drained`.

Whenever a relay is done or halted, set its matching `RELAY_FLAG` to `active: false` and
remove its matching `LOCK_DIR`; never leave that project's lock armed after forward
progress has stopped.

## The movement (per-worktree lifecycle)

`[H]` human gate · `[F]` autopilot flag checked.

1. SessionStart hook (`linear-devotee`) detects the issue on the branch → `greet`.
2. `greet` [F] → auto-chains `linear-devotee:plan`.
3. `plan` [F] → applies `plan_gate`: `auto-clean` auto-validates only on auditor pass + 0
   BLOCKER; never auto-validates past a BLOCKER.
4. Implementation turn (`subroutine` ambient) → closes with `moon-moth:verify`.
5. `moon-moth:verify` [F] → clean run auto-chains `git-gremlin:commit` → `pr`.
6. `git-gremlin:pr` [F] → PR title/body includes the Linear issue and `Closes <ISSUE>`;
   auto-chains `monkey-maestro:advance`.
7. `monkey-maestro:advance` [H] → first verifies the worktree is clean and its `HEAD`
   exactly matches the PR's remote head, then reviews the open PR and asks the patron
   "tested, it's good?". On approval it records the relay acceptance and stops for the
   patron's merge. A later `advance` verifies that exact PR is merged into its base before
   it asks `queue-scout` for the next issue, spawns it, and offers deletion of the previous
   accepted worktree only after the new workspace opens.

The patron merges PRs out-of-band, at their own tempo.

## The spawn baton prompt

`run`/`advance` pass this as `git-gremlin:spawn`'s `--prompt`. It must begin with the
exact marker line `AUTOPILOT RELAY (monkey-maestro)` because `git-gremlin:spawn` keys its
gate-bypass on that observable prefix.

```text
AUTOPILOT RELAY (monkey-maestro) — continue the symphony.
You are a fresh agent in a dedicated worktree for Linear issue <ISSUE> on branch <BRANCH>.
Autopilot is ON for Linear project <LINEAR_PROJECT_ID> (relay <RELAY_ID>).
Its only control flag is <RELAY_FLAG>. Run the movement unattended up to the acceptance gate.
START NOW: invoke `linear-devotee:greet <ISSUE>` before anything else.
Chain: greet → plan (auto per plan_gate) → implement → moon-moth:verify → git-gremlin:commit
→ git-gremlin:pr (body must contain `Closes <ISSUE>`) → monkey-maestro:advance.
At monkey-maestro:advance, STOP and ask the patron "tested, it's good?". Do NOT merge —
the patron merges. After approval, wait for that PR to be merged, then invoke
`monkey-maestro:advance <ISSUE>` again; it alone may spawn the next issue. On any failing
check, halt per the stop ladder.
PREVIOUS: issue <PREV_ISSUE> — PR <PREV_PR>. Order: <one-line reason from queue-scout>.
```
