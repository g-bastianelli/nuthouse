# Pipeline Contract — the autopilot relay

Background knowledge shared by the `monkey-maestro` skills (`run`, `advance`, `halt`)
and the `queue-scout` agent. It formalizes the cross-plugin handoff that today is
implicit: `linear-devotee` (issue queue) → implementation + `subroutine` → `moon-moth`
(verify) → `git-gremlin` (commit/pr/spawn). The maestro conducts that pipeline as one
unbroken symphony — one Linear issue per movement, one Superset worktree per issue.

This is documentation + schema. The runtime interface between plugins is the **state
files** below — any skill in any plugin finds them under the repo's shared `.git` common
dir, so no cross-plugin path resolution is ever needed.

## STATE_DIR — where the flag and relay-state live (worktree-shared)

`STATE_DIR = $(git rev-parse --path-format=absolute --git-common-dir)/nuthouse`

`--git-common-dir` resolves to the **same shared `.git` directory from the main repo AND
every linked worktree** of that repo. This is load-bearing: the relay runs each issue in
its own spawned Superset worktree (`git-gremlin:spawn`), and `git rev-parse
--show-toplevel` would resolve **differently in each worktree** — so it must NOT be used
to locate state. `--git-common-dir` is identical everywhere in the repo family, so a flag
armed in one worktree (or the main repo) is visible from all of them. `STATE_DIR` also
lives inside `.git/`, which means it is repo-scoped (no leak to other repos) and is
**never staged by `git add`** — no `.gitignore` entry is needed.

## The autopilot flag

Path: `<STATE_DIR>/autopilot.json`.

```jsonc
{
  "relay_id": "<uuid v4>",
  "active": true,
  "repo": "/abs/path/.git", // the git common dir this relay belongs to (audit only)
  "linear_project_id": "<id>",
  "plan_gate": "auto-clean", // auto-clean | manual | auto
  "max_issues": 5,
  "expires_at": "<ISO 8601>", // self-disarm backstop; set generously (~24h), refreshed by advance each movement
}
```

**Read rule (every relay-participating skill).** A skill takes its autopilot branch only
when ALL hold: the file exists under THIS repo's `STATE_DIR`, `active === true`, and
`expires_at` is in the future. Living under the repo's shared `.git` common dir already
scopes the flag to this repo and its worktrees — **no `project_root`/toplevel equality
check is needed** (and none must be used: it would fail in every worktree). Otherwise the
skill behaves exactly as it does today (interactive menus/gates). This is the
inverse-default of `voice.state`: **absent/invalid = off** (autopilot never assumes).

Mirrors the `voice.state` mechanic but is deliberately repo-scoped under `.git`: a
control-flow flag must not leak into unrelated repos, and runtime state must never be
committed. Because `STATE_DIR` is inside `.git/`, both properties hold for free.

## The relay-state (resumable, idempotent)

Path: `<STATE_DIR>/relay-<relay_id>.json`. Modeled on `linear-devotee:create-issue`'s
chain-state: key by `client_ref`, update entries **in place**. Only `run` and `advance`
own the relay-state (they hold `Write`); the per-issue worktree skills do not write it.

Only **three** issue stages are tracked, by design:

- `pending` — queued, not yet started.
- `spawning` — written by `run`/`advance` right **before** `git-gremlin:spawn` (the one
  side effect that needs pre-write idempotency, so a crash mid-spawn is recoverable).
- `accepted` — written by `advance` when the patron accepts the feature.

There are no `greeted`/`planned`/`verified`/`pr_open` stages — the worktree skills carry
no relay-state writes, so those would be dead values. A crashed in-flight issue is
detected by its `spawning` entry with no matching `accepted`; the patron re-runs.

Known edge: a `non` (rework) verdict at the acceptance gate keeps the issue at `spawning`;
if that worktree is later reopened in a _fresh_ session, `greet`'s guard (which stops only
on `accepted`) re-greets and re-plans it — the rework notes lived only in the original
session. Rare and non-corrupting (the Linear status flip is idempotent); the normal `non`
flow reworks in the same session. A dedicated rework stage is intentionally omitted to
keep the enum minimal.

```jsonc
{
  "relay_id": "<uuid>",
  "phase": "running", // running | halted | done | stopped
  "max_issues": 5,
  "completed_count": 2,
  "issues": [
    {
      "client_ref": "r1",
      "id": "NOT-101",
      "workspace_id": "ws_a",
      "branch": "g/not-101-x",
      "pr": "https://.../42",
      "stage": "accepted",
    },
    { "client_ref": "r2", "id": null, "stage": "pending" }, // pending | spawning | accepted
  ],
  "reason": null, // set on halt
}
```

## The "startable" rule in relay mode

A candidate issue is startable only when **every blocker is actually merged/Done in
Linear** — a just-accepted-but-unmerged issue does NOT unblock its dependents. This
guarantees each new worktree branches from a `main` that already contains the code it
depends on. Independent issues flow on automatically. A pure dependency chain, by
contrast, drains to `phase: done` (`queue_drained`) after its first issue — there is no
hook to re-trigger on merge — and `run`/`advance` **disarm the flag on `done`**, so the
patron merges the open PR(s) and runs `monkey-maestro:run` again to resume the chain.
(Stacked branches that avoid this wait are an explicit future extension, off by default.)

## The stop-ladder (halt, never "continue anyway")

Any of these stops forward progress. The two skills that own the relay-state (`run`,
`advance`) write `phase` + a `reason`; skills without `Write` simply refuse to auto-chain
forward, which pauses the relay (no further worktree is spawned).

- `moon-moth:verify` hits a torn wing in autopilot → it reports the failing evidence and
  does **not** auto-advance to commit/pr. The relay pauses there; the patron fixes and
  re-verifies, or runs `monkey-maestro:halt`. (verify owns no relay-state and writes no
  `phase` — stopping the forward chain is the halt.)
- `git-gremlin:commit`/`pr` surface non-zero stderr → stop, stderr verbatim, no
  auto-chain (inherits each skill's existing "surface stderr and stop").
- `gh auth status` / `superset projects list` / `queue-scout` Linear access fails →
  `run`/`advance` write `phase: halted`, reason `auth_expired` (never attempt login).
- `completed_count >= max_issues` → `advance`/`run` write `phase: done`, reason
  `budget_reached`.
- `queue-scout` finds no startable issue → `advance`/`run` write `phase: done`, reason
  `queue_drained`.

**Disarm on `done` or `halted`.** Whenever `run`/`advance` set `phase: done`
(`budget_reached`/`queue_drained`) OR `phase: halted` (any stop-ladder failure), they also
set `autopilot.json` `active: false`. The relay is over either way, so the single-relay
lock must not block a fresh `monkey-maestro:run` later (e.g. after the patron merges PRs
that were blocking a dependency chain, or fixes whatever caused the halt). Only `running`
keeps the flag armed.

## The movement (per-worktree lifecycle)

`[H]` human gate · `[F]` autopilot flag checked.

1. SessionStart hook (`linear-devotee`) detects the issue on the branch → `greet`.
2. `greet` [F] → auto-chains `linear-devotee:plan`.
3. `plan` [F] → applies `plan_gate`: `auto-clean` auto-validates only on auditor
   pass + 0 BLOCKER (else [H]); never auto-validates past a BLOCKER. Hands to impl.
4. implementation turn (`subroutine` ambient) → closes with `moon-moth:verify`.
5. `moon-moth:verify` [F] → clean flight auto-chains `git-gremlin:commit` → `pr`.
6. `git-gremlin:pr` [F] → PR title `[ISSUE]`, body contains `Closes <ISSUE>`; auto-chains
   `monkey-maestro:advance`.
7. `monkey-maestro:advance` → presents the feature + verify evidence; **acceptance gate
   [H]** "tested, it's good? (oui / non / stop)"; on `oui` → `queue-scout` → spawn the
   next worktree → STOP. The patron merges PRs out-of-band, at their own tempo.

## The spawn baton prompt (handed to the next worktree's fresh agent)

`run`/`advance` pass this as `git-gremlin:spawn`'s `--prompt`. It MUST begin with the
exact marker line `AUTOPILOT RELAY (monkey-maestro)` — `git-gremlin:spawn` keys its
gate-bypass on that observable prefix (it cannot see its caller). The branch name
(carrying the issue id) independently re-triggers `linear-devotee`'s SessionStart hook.

```text
AUTOPILOT RELAY (monkey-maestro) — continue the symphony.
You are a fresh agent in a dedicated worktree for Linear issue <ISSUE> on branch <BRANCH>.
Autopilot is ON for this project (relay <RELAY_ID>). Run the movement unattended up to the acceptance gate.
START NOW: invoke `linear-devotee:greet <ISSUE>` before anything else.
Chain: greet → plan (auto per plan_gate) → implement → moon-moth:verify → git-gremlin:commit
→ git-gremlin:pr (body must contain `Closes <ISSUE>`) → monkey-maestro:advance.
At monkey-maestro:advance, STOP and ask the patron "tested, it's good?". Do NOT merge —
the patron merges. On any failing check, halt per the stop-ladder.
PREVIOUS: issue <PREV_ISSUE> — PR <PREV_PR>. Order: <one-line reason from queue-scout>.
```
