# 0007 — Prose orchestration replaces the workflow kernel

## Status

Accepted (2026-09-02). Supersedes the architecture described by the adaptive
cross-runtime workflow specs under `docs/acid-prophet/specs/`, which are removed with
this change and remain readable in git history.

## Context

The repo had grown to 90 864 lines of `md`/`mjs`/`json`/`toml` around roughly
10 000 lines of actual product. A measurement of where the rest lived:

| Block                                        |  Lines | Share |
| -------------------------------------------- | -----: | ----: |
| `lib/workflow/` vendored into 6 plugins      | 35 760 |  39 % |
| Tests                                        | 17 893 |  20 % |
| `_shared/workflow/` source and tests         | 11 208 |  12 % |
| `docs/` — specs and plans for delivered work |  4 616 |   5 % |

Three findings decided the change.

**The kernel had no caller.** `_shared/workflow/src` was 5 525 lines, vendored
identically into six plugins, and its own README described it as a fallback: _"A
missing, failed, or invalid Claude Code hook falls back exactly once to that local
path."_ No hook in any plugin ever imported it. Its only invocation was a prose
blockquote copied into 27 of 45 SKILL.md files, asking the model to shell out to it.
`runtime-adapters.mjs` normalised input shapes nothing sent.

**The tests were a ratchet.** 564 `toContain` assertions grepped the prose of
SKILL.md files — `expect(ROUTE_SKILL).toContain("install-local \`lib/workflow/index.mjs\`")`.
Rewording a skill broke CI, so the only cheap operation on this repo was addition.
This is the inventory-gate anti-pattern already banned in CLAUDE.md, applied to prose.

**A single-user repo had grown a consensus protocol.** `git-gremlin:commit` spent 126
lines to run `git commit`, requiring a manifest validated by `content_hash`, a `run_id`,
a re-hashed `VERIFICATION_EVIDENCE`, a `WORKTREE_SNAPSHOT_HASH` recomputed twice, and a
per-file Git mode comparison with canonical `100644`→`0644` mapping. Nothing verified the
model actually computed any of it. The threat model was a hostile writer; the real one is
a lost conversation.

The comparison that settled it: the three plugins never wired into the kernel
(`lore-hound` 585 lines, `stack-golem` 932, `subroutine` 2 015) were also the cleanest and
the most portable, being pure prose. Every plugin the kernel touched was five times heavier.

`obra/superpowers` solves the same problem — a brainstorm → spec → plan → implement →
verify chain — in 14 skills and 3 377 lines, with **zero** workflow decision code: 127
lines of utility bash, one `SessionStart` hook that injects text, and a chaining marker
appearing four times in the whole repo.

## Decision

Orchestrate in prose. Delete the kernel and everything that existed to serve it.

- **Chaining** is a marker naming the next skill: `**REQUIRED SUB-SKILL:** Use \`<plugin>:<skill>\``.
  When the user chooses instead, a hand-off menu names a skill per branch.
- **State that must survive a compaction** — and only that — is one markdown ledger at
  `.nuthouse/<subject>/progress.md`, first line naming the subject, one line per completed
  step, git-ignored and disposable. No hashes, no manifests, no signed evidence.
- **Artifacts pass by absolute path.** A precondition requires a file to exist and be
  readable, never that its bytes match a recorded digest.
- **Guardrails are named laws**: a rule in capitals followed by a short
  `| Excuse | Reality |` table naming the rationalisations that break it.
  `git-gremlin/skills/commit/SKILL.md` is the reference implementation.
- **The voice is read, not dispatched.** A skill reads its plugin's `persona.md` inline.
  The `warden` plugin, its `voice` agent, the per-plugin `persona-line-contract.md`, and
  the `voice.state` flag are all removed.

Dual-runtime support is unaffected and materially improved: prose is the only substrate
that behaves identically on Claude Code and Codex, while shared JS required adapters,
bundles, vendoring, isolation fixtures and their checkers. ADR 0003 stands unchanged.

## Consequences

- 8 plugins remain, all registered in both marketplaces. `warden` and `saucy-status` are
  deleted — `saucy-status` was uninstalled, absent from the Codex registry, and its hook
  tests had been failing.
- `bun run check:duplication` replaces the workflow-bundle checkers. It asserts a
  property — no run of identical prose over 450 characters appears in two SKILL.md files —
  so it never needs editing when a skill is added, renamed, or retired. Weight, not line
  count, is the measure, and the budget is calibrated on the mandatory cross-runtime header
  from ADR 0003 (~410 characters), which every skill legitimately carries. A 300-line skill
  whose every line is its own is healthy; a 120-line skill with 60 copied ones is not.
- A cross-runtime hook defect surfaced and was fixed: `moon-moth` declared its
  `SessionStart` hook inline in `.claude-plugin/plugin.json`, invisible to Codex, while
  every gate passed green. `.claude/tests/hooks-dedup.test.mjs` now asserts that a
  Codex-registered plugin declares hooks only in `hooks/hooks.json`.
- `docs/` is removed. It held specs and plans for delivered work describing an
  architecture that no longer exists; git history preserves them, and this ADR records
  why they no longer apply.
- Skills are shorter because nothing is copied into them, not because content was cut:
  `git-gremlin:commit` 126 → 102 lines, `moon-moth:verify` 291 → 197.
