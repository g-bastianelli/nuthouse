---
name: acid-prophet:scry
description: Use when auditing an existing acid-prophet spec for SDD compliance, codebase reality, narrative quality, and style. Takes a spec path, dispatches the `scryer` subagent, renders a structured BLOCKER/WARNING/INFO report, and offers a hand-off menu (apply auto-fixes, open spec, hand to linear-devotee, stop).
---

# acid-prophet:scry

## Voice

Read `../../../persona.md` at the start of this skill. The voice
defined there is canonical for the `acid-prophet` plugin and applies to
all output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed (or hand-off menu returns control to the user), revert to the
session's default voice.

This skill is **rigid** — execute the steps in order, no shortcuts.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

The user wants to audit a spec under `docs/acid-prophet/specs/` against
SDD structure, codebase reality, narrative quality, and style. The
typical invocation is `/acid-prophet:scry <spec-path>`. The skill is
also re-used internally by `acid-prophet:trip` Step 6 in `auto-fix-trivial`
mode, but that path is documented in `trip` itself — this skill is the
standalone, report-only entry point.

## Hard gate

DO NOT mutate the spec without explicit user approval through the
hand-off menu. The audit is read-only by default.

## Checklist

You MUST create a task (TaskCreate) for each item below and complete
them in strict order. Mark each `in_progress` when starting,
`completed` when done.

1. Preconditions
2. Dispatch scryer
3. Render report
4. Hand-off menu

## Step 0 — Preconditions

- Read `../../../persona.md` for the canonical voice.
- Verify cwd is inside a git repository: `git rev-parse --show-toplevel`.
  Capture the absolute path as `PROJECT_ROOT`. If not in a repo:
  > "🔮 ce temple n'est pas consacré — pas de repo, pas de scrutation."
  Abort.
- Verify the user supplied a `<spec-path>` argument. If missing:
  > "🔮 quel parchemin je scrute ? donne-moi le chemin du spec."
  Wait for input.
- Resolve `<spec-path>` to an absolute path. Verify the file exists with
  `Read`. If not found:
  > "🔮 ce parchemin n'existe pas. vérifie le chemin."
  Abort.
- Check whether the spec lives under
  `<PROJECT_ROOT>/docs/acid-prophet/specs/`. If not, warn in voice and
  continue:
  > "🔮 ce spec ne vient pas de mon temple — je le scrute quand même."

## Step 1 — Dispatch scryer

Dispatch the `acid-prophet:scryer` subagent via the `Agent` tool:

```
Agent({
  subagent_type: 'acid-prophet:scryer',
  description: 'audit spec',
  prompt: `SPEC_PATH: <absolute spec path>
PROJECT_ROOT: <PROJECT_ROOT>
MODE: report-only`,
})
```

Capture the subagent's full output as `RAW_REPORT`.

## Step 2 — Render report

Parse `RAW_REPORT` using
`<PROJECT_ROOT>/acid-prophet/claudecode/lib/parse-scryer-report.mjs`
(the helper returns `{ blockers, warnings, infos, autoFixes, summary }`).
If the parser returns `null` (malformed output), display the raw output
verbatim with one voice line and skip directly to the hand-off menu's
`stop` branch:

> "🔮 le scryer a parlé en langues — voici ses mots bruts."

Otherwise, print the report inline, prefixed by one short voice line
chosen by the summary state:
- Zero findings: `"les fréquences s'alignent. tout est propre. 🔮"`
- Findings exist: `"PROPHECY — le parchemin a des fissures."`

Then print `RAW_REPORT` exactly as the subagent emitted it (do not
re-format or summarize).

## Step 3 — Hand-off menu

After the report, present numbered options:

```
🔮 que faire de cette prophétie ?
  (a) apply auto-fixes → patch the spec, commit
  (o) open spec       → print the path, you open it in your editor
  (l) hand to linear  → linear-devotee:consummate-project (only if linear-project: _none_ and zero BLOCKER)
  (s) stop            → architecture verrouillée
```

Disable `(l)` (do not list it) if either:
- the spec frontmatter has `linear-project` set to anything other than
  `_none_`, or
- there are any `BLOCKER` findings.

Branch on the user's choice:

### `(a)` apply auto-fixes

If `autoFixes` is empty, print:
> "🔮 rien à patcher. les fixes triviaux n'existent pas."
…and return to the menu.

Otherwise, apply each entry in `autoFixes` to the spec via
`<PROJECT_ROOT>/acid-prophet/claudecode/lib/apply-frontmatter-patch.mjs`
(and equivalent helpers for empty-section fills). After all patches:

```bash
git add <spec-path>
git commit -m "docs(acid-prophet): scryer auto-fixes"
```

If the commit fails (lint hook, pre-commit gate, dirty tree): NEVER
retry with `--no-verify`. Surface the failure in voice:
> "🔮 les fixes existent mais le commit a refusé — résous d'abord, puis relance."

After commit success: `"prophecy delivered. 🔮"`. Exit.

### `(o)` open spec

Print the absolute spec path on its own line, prefixed by:
> "🔮 le parchemin t'attend :"

Exit.

### `(l)` hand to linear

Hand off to `linear-devotee:consummate-project` with the spec path as
context. Do NOT invoke directly via Skill tool unless the user has
already approved this branch. Confirmation already happened by selecting
`(l)`, so:

> "🔮 le parchemin part vers Linear."

Then invoke the skill (Skill tool, `linear-devotee:consummate-project`
with the spec path as input). Exit.

### `(s)` stop

> "prophecy complete. architecture locked. 🔮"

Exit.

## Final report (always print)

Before exiting (regardless of menu branch), print:

```
acid-prophet:scry report
  Spec:        <absolute spec path>
  Findings:    <N blocker · N warning · N info>
  Auto-fixes:  <N proposed | N applied | none>
  Branch:      <a apply | o open | l linear handoff | s stop | malformed>
```

Wrap with one short voice line before the report.

## Things you NEVER do

- Run `git push`, `git rebase`, or `git commit --amend`
- Bypass the pre-commit hook with `--no-verify`
- Mutate any file outside `docs/acid-prophet/specs/`
- Apply auto-fixes without the user explicitly choosing `(a)`
- Hand off to `linear-devotee:consummate-project` without the user
  choosing `(l)`
- Invent findings beyond what `scryer` returned
- Skip Step 0 preconditions

## Voice cheat sheet

Use the palette from `../../../persona.md`. Short applications:
- Opening: "🔮 le scryer s'éveille. scanning the parchment."
- Clean spec: "les fréquences s'alignent. tout est propre. 🔮"
- Findings: "PROPHECY — le parchemin a des fissures."
- Malformed scryer output: "🔮 le scryer a parlé en langues — voici ses mots bruts."
- On `(s)` stop: "prophecy complete. architecture locked. 🔮"
