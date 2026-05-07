# ADR 0001 — Tier `model` and `effort` frontmatter per cognitive load

- **Status**: Accepted
- **Date**: 2026-05-07
- **Scope**: All skills (`<plugin>/<runtime>/skills/<skill>/SKILL.md` and `.claude/skills/*/SKILL.md`) and agents (`<plugin>/<runtime>/agents/*.md`) in this marketplace.

## Context

Claude Code skills and agents support optional `model` and `effort` frontmatter that override the session model and reasoning depth for the duration of the skill/agent execution. Until now this repo applied them ad-hoc:

- All subagents were declared `model: haiku` regardless of their job (drafting, auditing, fetching).
- Skills mostly carried `effort: high` or nothing, with no consideration of the underlying cognitive load.
- The scaffolds (`scaffold-skill`, `scaffold-agent`) only exposed a subset of the supported values, and treated `default` as a single bucket.

Two problems followed:

1. **Quality leaks on high-leverage low-volume work.** Skills like `acid-prophet:write-spec` or `linear-devotee:create-project` are invoked rarely but their output (the SDD spec, the Project description) seeds every downstream artifact. Having their drafter on Haiku meant the cheap shortcut paid the most expensive downstream cost.
2. **Cost waste on trivial work.** Toggle skills (`saucy-status:saucy`, `warden:voice`) and parsing/dispatch skills (`linear-devotee:greet`, the local scaffolds) ran on the full session model with high effort even though the work is mechanical.

The Claude Code documentation also clarifies two facts that constrain the decision:

- `effort` is supported only on Opus 4.7, Opus 4.6, and Sonnet 4.6. **It is silently ignored on Haiku.**
- `effort: max` is "prone to overthinking" per the docs and recommended for low-volume, intelligence-sensitive work only — `xhigh` is the recommended default on Opus 4.7.

## Decision

We tier every skill and agent by **cognitive load** and **invocation frequency**, then route to the appropriate model and effort.

### Skill matrix

| Skill | `model` | `effort` | Rationale |
| --- | --- | --- | --- |
| `acid-prophet:write-spec` | `opus` | `max` | Top-leverage SDD creation. A bad spec poisons the downstream chain. |
| `linear-devotee:create-project` | `opus` | `max` | Same — defines the structural backbone for milestones/issues. |
| `linear-devotee:create-milestone` | `opus` | `max` | Constrained by project context but still structural. |
| `linear-devotee:create-issue` | inherit | `high` | Cadré par milestone, plus fréquent — defaut suffit. |
| `linear-devotee:plan` | inherit | `xhigh` | Plan is load-bearing for the implementation step. |
| `acid-prophet:check-drift` / `audit-spec` | inherit | `high` | Structured comparison — defaut suffit. |
| `react-monkey:implement` | inherit | `high` | Existing calibration, code-writing. |
| `git-gremlin:commit` / `pr` | inherit | `high` | Orchestrators (the diff-reading subagent does the heavy work). |
| `audit` (local) | inherit | `high` | Repo-wide scan + structured report. |
| `linear-devotee:greet` | `haiku` | — | ID detection + dispatch, no decisions. |
| `saucy-status:saucy` / `warden:voice` | `haiku` | — | State toggles. |
| `scaffold-plugin` / `scaffold-skill` / `scaffold-agent` | `haiku` | — | Guided Q&A + template fill. |

### Agent matrix

| Agent | `model` | `effort` | Rationale |
| --- | --- | --- | --- |
| `project-drafter`, `milestone-drafter` | `opus` | `max` | Calling skill is opus+max — the drafter must match or the upgrade is wasted. |
| `issue-drafter` | `sonnet` | `high` | Bounded by milestone context, but produces SDD prose. |
| `spec-auditor`, `plan-auditor` | `sonnet` | `high` | Structured reasoning, no creative writing. |
| `issue-context`, `plan-writer` | `haiku` | — | Pure fetch + reformat / mechanical write. |

### Rules of thumb

- **`opus + max`** — reserved for low-volume, high-leverage *creation* (writing SDDs, defining structural artifacts). Cost is real; scope it tight.
- **`sonnet + high`** — for reasoning-heavy work that does not produce structural artifacts (audits, drafts cadrés, comparison passes).
- **`inherit + high`** — for ordinary orchestration and code-writing skills. The session model decides; we just steer the reasoning depth.
- **`haiku`** — for parsing, toggles, dispatch, fill-in-the-blank. **Do not pair with `effort:` other than `low` or `inherit`** — it's silently ignored.
- **Skill / agent coherence** — when a skill at tier T dispatches a drafter, the drafter should be at the same tier or one tier below. A `model: opus` skill that calls a `model: haiku` drafter wastes its own upgrade.

## Consequences

### Positive

- Better SDD quality on the few high-leverage operations that seed everything else.
- Lower marginal cost on toggle / dispatch / parsing skills.
- A clear vocabulary (load × volume → tier) for routing future skills.

### Negative

- More knobs to maintain. Every new skill or agent now has to make a tiering call.
- `opus + max` is meaningfully more expensive than `inherit + high`. The bet is that volume × leverage justifies it; if usage shifts (e.g. `create-issue` becomes a high-volume daily action and is silently elevated to opus through a future change), the cost can balloon.
- `effort: max` may overthink per Claude docs. We accept this as a calculated risk on creation-tier skills only.

### Mitigations in place

1. **`bun run test:meta`** (`.claude/tests/frontmatter.test.mjs`) enforces that every `model` value is in `{haiku, sonnet, opus, inherit}` and every `effort` value is in `{low, medium, high, xhigh, max}`. Wired into lefthook pre-commit on SKILL.md / agent .md changes. Catches typos and unsupported values before they ship.
2. **`scaffold-skill` Q7/Q8 and `scaffold-agent` Q4/Q4b** were extended to expose the full option set with voice warnings on the risky combos (`opus`, `max`, `effort` on `haiku`).
3. **CLAUDE.md pre-push checklist** lists `bun run test:meta`.

## Related

- PR [#26](https://github.com/g-bastianelli/nuthouse/pull/26) — the audit + guard + scaffold extension.
- Commits:
  - `8dbeb1c` — frontmatter retuning across 16 files.
  - `4880b2f` — `test:meta` regression guard.
  - `2ef5f29` — scaffold-skill / scaffold-agent option matrix expansion.
- Claude Code docs:
  - [Skill frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference) — defines `model` and `effort`.
  - [Effort levels](https://code.claude.com/docs/en/model-config#adjust-effort-level) — explains adaptive reasoning, `max` overthink warning, model support.

## Notes

- This ADR also establishes `_adr/` as the location for Architecture Decision Records in this repo, numbered sequentially (`NNNN-kebab-case-title.md`). Future decisions large enough to deserve their own record land here.
- Codex variants (`<plugin>/codex/skills/*`) are not covered by this decision. `model` / `effort` are Claude Code concepts. If Codex adds equivalent fields later, a follow-up ADR will extend this one.
