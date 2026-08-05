# acid-prophet

![acid-prophet](./assets/banner.png)

Spec-driven development plugin for Claude Code and Codex.

It turns rough ideas into reviewed specs, ratifies project-specific articles into a constitution that every audit is held against, expands ratified specs into implementation plans with typed contracts, derives acceptance checklists for QA/PR review, and detects spec/code drift before merge. Stable `AC-###` identifiers join each observable criterion to plan steps, quickstart evidence, Linear issues, checklists, and drift findings. Phase -1 gates (`simplicity`, `anti-abstraction`, `acceptance-defined`, `acceptance-traceable`, `clarifications-resolved`, `constitution`) block handoff to Linear until the spec passes.

## Skills

| Skill                             | Purpose                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `acid-prophet:write-constitution` | Extract project-specific governing articles into `docs/acid-prophet/constitution.md`; each article becomes an extra gate at audit time |
| `acid-prophet:write-spec`         | Guide project discovery, propose approaches, write a spec, audit it, and optionally hand off to Linear                                 |
| `acid-prophet:audit-spec`         | Audit an existing spec for structure, ambiguity, missing evidence, codebase contradictions, and Phase -1 gates                         |
| `acid-prophet:write-plan`         | Turn a ratified spec into `plan.md` + typed `contracts/` + `quickstart.md` before any code is written                                  |
| `acid-prophet:write-checklist`    | Derive a concrete `- [ ]` acceptance checklist from a spec for QA/PR review; optionally post as a PR comment                           |
| `acid-prophet:check-drift`        | Compare a branch diff against the linked spec or Linear project criteria; tracks unresolved `[NEEDS CLARIFICATION]` markers            |

## Agent

| Agent          | Purpose                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `spec-auditor` | Read-only spec auditor. Evaluates Phase -1 gates and emits BLOCKER/WARNING/INFO findings plus auto-fix candidates. |

## Pipeline

```text
            write-constitution            (one-time, per project)
                   │
                   ▼
         docs/acid-prophet/constitution.md
                   │
        ┌──────────┴───────────┐
        ▼                      ▼
    write-spec ─────────► spec-auditor ─────► handoff-eligible?
        │                  (gates run)              │
        │   loop while !eligible                    │
        └◄──────────────────┘                       │
                                          ┌────────┴────────┐
                                          ▼                 │ no
                                       yes │                ▼
                                          ▼          edit spec, re-run
                                     write-plan
                                          │
                                          ▼
                                  write-checklist          (any time after plan)
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                               ▼
                  implementation turn        linear-devotee:create-project
                          │
                          ▼  (after PR is opened)
                     check-drift
```

**Stage by stage:**

1. **`write-constitution`** — one-time per project. Q&A extracts immutable articles (test-first, no-new-deps, library boundaries, etc.) into `docs/acid-prophet/constitution.md`. Every later audit treats each article as an extra gate.
2. **`write-spec`** — Q&A → sectioned spec under `docs/acid-prophet/specs/<date>-<slug>.md`. Acceptance is explicit EARS with immutable ids (`[AC-001] WHEN …, THE SYSTEM SHALL …`). The prophet emits `[NEEDS CLARIFICATION: ...]` markers in place of inventing values, auto-dispatches `spec-auditor`, then ratifies only after audit + user approval. Git commit is always a separate user choice.
3. **`spec-auditor`** — read-only agent. Runs SDD structure checks, reality checks against `AGENTS.md` / `CLAUDE.md` / `package.json` / referenced files, narrative checks (markers, ambiguity, placeholders), and **Phase -1 gates** — `simplicity` (≤ 2 architecturally independent subsystems), `anti-abstraction` (every new wrapper / facade / factory names ≥ 2 consumers), `acceptance-defined` (≥ 1 EARS criterion), `acceptance-traceable` (every active criterion has a unique stable `AC-###` id), `clarifications-resolved` (zero open `[NEEDS CLARIFICATION:` markers), `constitution` (every ratified article holds against the spec). Emits `handoff-eligible: yes | no`. **No handoff downstream until eligible.**
4. **`audit-spec`** — standalone re-run of the auditor on any spec. Same gate semantics; the `(l) hand to linear` menu option is disabled when `handoff-eligible` is `no`.
5. **`write-plan`** — turns a ratified spec into `docs/acid-prophet/plans/<slug>/{plan.md, contracts/*.md, quickstart.md}`. Plan steps are dependency-ordered and declare `covers: AC-### | foundation`; a cross-artifact gate rejects missing or unknown coverage before review. Contracts hold typed shapes + invariants + error cases. Quickstart is executable Acceptance evidence.
6. **`write-checklist`** — derives a concrete `- [ ]` checklist while preserving each stable AC id, one item per AC/Constraint/Non-goal with a `how to verify:` line. Optionally posts as a PR comment.
7. **`check-drift`** — at PR time, compares `git diff main...HEAD` against Acceptance/Constraints and reports each finding by stable AC id. Tracks unresolved `[NEEDS CLARIFICATION]` markers — any DRIFT finding in a region with an open marker is downgraded to AMBIGUOUS.

**Skip rules:** every stage past `write-spec` is optional. The minimal viable trip is `write-spec` → `linear-devotee:create-project`. The other skills are pluggable depending on project size and PR rigor.

## Install

Claude Code:

```text
/plugin marketplace add g-bastianelli/nuthouse
/plugin install acid-prophet@nuthouse
```

Codex CLI:

```text
codex plugin marketplace add g-bastianelli/nuthouse
```

Then open `/plugins` and install `acid-prophet`.

## Layout

```text
acid-prophet/
  assets/
  persona.md
  shared/
  skills/
  agents/
  lib/
  tests/
  claudecode/
    lib/
    tests/
```
