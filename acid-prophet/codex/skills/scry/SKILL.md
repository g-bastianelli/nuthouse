---
name: scry
description: Use when auditing an existing acid-prophet spec for SDD compliance, codebase reality, narrative quality, and style. Takes a spec path, runs the scryer audit pipeline inline (Codex has no subagent dispatch), renders a structured BLOCKER/WARNING/INFO report, and offers a hand-off menu (apply auto-fixes, open spec, hand to linear-devotee, stop).
---

# scry (Codex)

## Voice

Read `../../../persona.md` at the start of this skill. The voice
defined there is canonical for the `acid-prophet` plugin and applies to
all output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed (or the hand-off menu returns control to the user), revert to
the session's default voice.

This skill is **rigid** — execute the steps in order, no shortcuts.

## Language

Adapt all output to match the user's language. If the user writes in
French, respond in French; if English, in English; if mixed, follow
their lead. Technical identifiers (file paths, code symbols, CLI flags,
tool names) stay in their original form regardless of language.

## When you're invoked

The user wants to audit a spec under `docs/acid-prophet/specs/` against
SDD structure, codebase reality, narrative quality, and style. Typical
invocation: `/scry <spec-path>`. The skill is also re-used internally
by `trip` Step 6 in `auto-fix-trivial` mode.

## Codex difference

Codex does not expose subagent dispatch. The audit pipeline that the
Claude Code variant delegates to the `scryer` subagent runs **inline**
in this skill. The pipeline logic itself is identical — see the steps
below for the same checks.

## Hard gate

DO NOT mutate the spec without explicit user approval through the
hand-off menu. The audit is read-only by default.

## Step 0 — Preconditions

- Read `../../../persona.md` for the canonical voice.
- Verify cwd is inside a git repository: `git rev-parse --show-toplevel`.
  Capture the absolute path as `PROJECT_ROOT`. If not in a repo:
  > "🔮 ce temple n'est pas consacré — pas de repo, pas de scrutation."
  Abort.
- Verify the user supplied a `<spec-path>` argument. If missing, ask:
  > "🔮 quel parchemin je scrute ? donne-moi le chemin du spec."
- Resolve `<spec-path>` to an absolute path. Verify it exists. If not:
  > "🔮 ce parchemin n'existe pas. vérifie le chemin."
  Abort.
- If the spec lives outside `<PROJECT_ROOT>/docs/acid-prophet/specs/`,
  warn in voice and continue:
  > "🔮 ce spec ne vient pas de mon temple — je le scrute quand même."

## Step 1 — Audit pipeline (inline)

Read the spec at `<spec-path>`. Run the following checks in order. For
each finding, classify as `BLOCKER` / `WARNING` / `INFO`.

### 1a — SDD-strict checks

- **Frontmatter** — verify YAML frontmatter block, parse it. Required
  keys, all present and non-empty: `id`, `status`, `linear-project`,
  `verified-by`, `last-reviewed`. Missing block → BLOCKER `[frontmatter]
  file has no valid frontmatter block`. Per-key gap → BLOCKER
  `[frontmatter:<key>] missing` plus an Auto-fix candidate.
- **Required sections** — match by heading prefix, case-insensitive:
  `Problem`, `Solution`, `Architecture`, `Components`, `Error handling`,
  `Testing`, `Non-goals`. Each missing → BLOCKER `[section:<name>]
  missing`.
- **EARS syntax** — only if a section starting with `Acceptance` exists.
  Each bullet must match `WHEN <trigger>, THE SYSTEM SHALL <behavior>`
  or `IF <condition>, THE SYSTEM SHALL <behavior>` (case-insensitive).
  Each non-conforming bullet → WARNING `[ears:<line>] non-EARS phrasing`.

### 1b — Reality check

- **CLAUDE.md** — read `<PROJECT_ROOT>/CLAUDE.md`. If absent: emit INFO
  `[reality-check] no CLAUDE.md found, conventions check skipped`. If
  present: scan for explicit policies (e.g. "no npm deps", "ESM only")
  and flag spec contradictions as BLOCKER `[stack:<policy>]`.
- **package.json** — read `<PROJECT_ROOT>/package.json`. If absent:
  INFO `[reality-check] no package.json found, stack check skipped`.
  Otherwise extract declared deps; flag spec proposals that violate
  CLAUDE.md policy as BLOCKER `[stack:dependencies]`. Flag stack
  contradictions as BLOCKER `[stack:framework]`.
- **Referenced file paths** — scan the spec body for path-like tokens
  (backticked spans matching `[a-zA-Z0-9_./-]+\.[a-z0-9]{1,5}`). For
  each unique path, check existence via `Glob` from `PROJECT_ROOT`. If
  missing → WARNING `[reality-check:files] referenced file not found:
  <path>`.

### 1c — Narrative checks

- **Placeholders** — scan for literal `TBD`, `TODO`, `_unclear_`, `xxx`,
  `???`. Each occurrence → INFO `[placeholder:<line>] <token> in
  <section>` plus Auto-fix candidate where defaultable.
- **Internal consistency** — flag sections that contradict each other
  → WARNING `[consistency:<sections>] <description>`.
- **Scope** — if the spec describes more than one architecturally
  independent subsystem → WARNING `[scope] consider decomposing into
  separate specs`.
- **Ambiguity** — flag sentences in normative sections containing vague
  quantifiers (`some`, `various`, `etc.`, `as needed`, `gracefully`
  unqualified) → WARNING `[ambiguity:<section>] vague quantifier
  "<quote>"`.

### 1d — Style checks

- **Heavy code blocks** — count fenced code blocks. Any block longer
  than 15 lines → INFO `[style:<section>] heavy code block (<N> lines)
  — consider moving to Linear issues`.

## Step 2 — Render report

Print one short voice line, then the structured report:

- Zero findings: `"les fréquences s'alignent. tout est propre. 🔮"`
- Findings exist: `"PROPHECY — le parchemin a des fissures."`

Format:

```
# scryer report — <spec-path>

## BLOCKER (<n>)
- [<category>:<location>] <description>

## WARNING (<n>)
- [<category>:<location>] <description>

## INFO (<n>)
- [<category>:<location>] <description>

## Auto-fix candidates
- <field>:<missing_or_invalid> → <proposed_value>

## Summary
<n> blocker · <n> warning · <n> info
```

Empty severity sections render as `(0)` with no bullets. The Summary
line is always present.

## Step 3 — Hand-off menu

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

Branch on the user's choice. The patch logic uses
`<PROJECT_ROOT>/acid-prophet/codex/lib/apply-frontmatter-patch.mjs`
(Node helper, identical contract to the claudecode variant). On `(a)`,
apply each Auto-fix candidate, then `git add` + `git commit -m
"docs(acid-prophet): scryer auto-fixes"`. Never `--no-verify`.

`(o)` prints the spec path. `(l)` hands off to
`linear-devotee:consummate-project`. `(s)` exits with `"prophecy
complete. architecture locked. 🔮"`.

## Final report

```
scry report (codex)
  Spec:        <absolute spec path>
  Findings:    <N blocker · N warning · N info>
  Auto-fixes:  <N proposed | N applied | none>
  Branch:      <a | o | l | s>
```

Wrap with one short voice line before the report.

## Things you NEVER do

- Run `git push`, `git rebase`, or `git commit --amend`
- Bypass the pre-commit hook with `--no-verify`
- Mutate any file outside `docs/acid-prophet/specs/`
- Apply auto-fixes without the user choosing `(a)`
- Hand off to `linear-devotee:consummate-project` without the user
  choosing `(l)`
- Invent findings beyond what the audit pipeline produced
- Skip Step 0 preconditions
