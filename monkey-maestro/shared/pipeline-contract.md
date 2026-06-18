# Pipeline Contract — the autopilot relay

Background knowledge shared by the `monkey-maestro` skills (`run`, `advance`, `halt`)
and the `queue-scout` agent. The relay conducts the existing build pipeline:
`linear-devotee` (issue context/plan) → implementation + `subroutine` → `moon-moth`
(verify) → `git-gremlin` (commit/pr/spawn).

## Principle: Linear is the source of truth

The relay must not maintain a shadow queue. Linear owns issue identity, project
membership, status, blockers, and ordering. GitHub owns PR existence and merge state.
Local files are **control plane only**:

- whether autopilot is armed for this repo,
- the relay id for logging and baton prompts,
- the plan gate,
- the optional budget cap,
- short audit breadcrumbs such as the last accepted issue/PR.

Local files must never decide which issue is current, which issue is next, whether an
issue is accepted, or whether a blocker is satisfied. Those facts are reconstructed from
Linear and GitHub every time. If local state and Linear disagree, Linear wins.

## STATE_DIR — where the control flag lives (worktree-shared)

`STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse`

`--git-common-dir` resolves to the same shared `.git` directory from the main repo and
every linked worktree of that repo. This is load-bearing: the relay runs each issue in
its own spawned Superset worktree, and `git rev-parse --show-toplevel` resolves
differently in each worktree. `STATE_DIR` lives inside `.git/`, so it is repo-scoped and
never staged by `git add`.

## The autopilot control flag

Path: `<STATE_DIR>/autopilot.json`.

```jsonc
{
  "relay_id": "<uuid v4>",
  "active": true,
  "repo": "/abs/path/.git", // git common dir, audit only
  "linear_project_id": "<id | null>", // cached hint only; queue-scout verifies via Linear
  "plan_gate": "auto-clean", // auto-clean | manual | auto
  "max_issues": 5,
  "accepted_count": 0, // budget counter only; never queue authority
  "last_issue": null, // audit/baton breadcrumb only
  "last_pr": null, // audit/baton breadcrumb only
  "last_halt_reason": null,
  "expires_at": "<ISO 8601>",
}
```

**Read rule.** A skill takes its autopilot branch only when all hold: the file exists
under this repo's `STATE_DIR`, `active === true`, and `expires_at` is in the future.
Otherwise the skill behaves interactively.

**Write rule.** `run`, `advance`, and `halt` may update `autopilot.json`. No skill writes
a relay queue file. The former `relay-<relay_id>.json` state file is obsolete and must not
be read as authority.

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
  record as `last_issue`/`last_pr` for audit, not queue authority.

This makes the relay crash-tolerant without becoming a second database. A crashed spawn is
recovered by inspecting actual git branches/worktrees and Linear status, not by trusting a
pre-written local stage.

## The startable rule

A candidate issue is startable only when all are true:

1. It is in the target Linear project.
2. Its status type is not `completed`, `canceled`, or `started`.
3. Every blocker is actually completed/canceled in Linear.
4. No local branch or worktree already appears to target that issue id.

The just-accepted-but-unmerged issue does not unblock dependents unless Linear/GitHub has
actually moved it to a completed/merged state. This guarantees each new worktree branches
from a `main` that already contains the code it depends on.

In `MODE: first`, a `PREFERRED_ISSUE` is a real preferred start: if it is startable, pick
it before scanning the rest of the queue. In `MODE: next`, the `ACCEPTED_ISSUE` is only an
anchor and must be excluded from candidates.

## Stop ladder

Any of these stops forward progress:

- `moon-moth:verify` fails in autopilot → report failing evidence and stop the chain.
- `git-gremlin:reviewer` returns blocking findings in `advance` → hand back to the
  implementation turn; do not present the acceptance gate.
- `git-gremlin:commit`/`pr` surface non-zero stderr → stop and surface stderr.
- `gh auth status`, `superset projects list`, or Linear queue access fails → disarm the
  flag with `last_halt_reason`.
- `accepted_count >= max_issues` → disarm with `budget_reached`.
- `queue-scout` finds no startable issue → disarm with `queue_drained`.

Whenever the relay is done or halted, set `autopilot.json active: false`; never leave the
single-relay lock armed after forward progress has stopped.

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
7. `monkey-maestro:advance` [H] → reviews the PR, asks the patron "tested, it's good?",
   records only audit/budget fields in `autopilot.json`, then asks `queue-scout` for the
   next startable Linear issue and spawns it.

The patron merges PRs out-of-band, at their own tempo.

## The spawn baton prompt

`run`/`advance` pass this as `git-gremlin:spawn`'s `--prompt`. It must begin with the
exact marker line `AUTOPILOT RELAY (monkey-maestro)` because `git-gremlin:spawn` keys its
gate-bypass on that observable prefix.

```text
AUTOPILOT RELAY (monkey-maestro) — continue the symphony.
You are a fresh agent in a dedicated worktree for Linear issue <ISSUE> on branch <BRANCH>.
Autopilot is ON for this project (relay <RELAY_ID>). Run the movement unattended up to the acceptance gate.
START NOW: invoke `linear-devotee:greet <ISSUE>` before anything else.
Chain: greet → plan (auto per plan_gate) → implement → moon-moth:verify → git-gremlin:commit
→ git-gremlin:pr (body must contain `Closes <ISSUE>`) → monkey-maestro:advance.
At monkey-maestro:advance, STOP and ask the patron "tested, it's good?". Do NOT merge —
the patron merges. On any failing check, halt per the stop ladder.
PREVIOUS: issue <PREV_ISSUE> — PR <PREV_PR>. Order: <one-line reason from queue-scout>.
```
