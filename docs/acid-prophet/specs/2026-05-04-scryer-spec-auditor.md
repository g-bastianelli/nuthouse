---
id: scryer-spec-auditor
status: draft
linear-project: _none_
verified-by: _none_
last-reviewed: 2026-05-04
---

# scryer — spec auditor for acid-prophet

## Problem & Why

`acid-prophet:write-spec` produces specs in `docs/acid-prophet/specs/`. Today the
review (Step 6 of `trip`) happens inline in main context and only covers
text-level checks: placeholders, internal consistency, scope, ambiguity.
Three gaps:

1. **No codebase anchoring.** A spec can read cleanly while contradicting
   the project's `CLAUDE.md`, declared stack, or referencing files that
   do not exist. Nothing surfaces this before implementation.
2. **No audit path for hand-written specs.** A spec authored outside `trip`
   (manually, or imported) has no equivalent of Step 6 to pass through.
3. **Main-context pollution.** The review is an isolable, file-heavy job
   that bloats `trip`'s main context with reads it does not need to
   coordinate.

A dedicated spec auditor (subagent) and a standalone audit skill close the
three gaps without altering the existing `trip` contract.

## Solution

Add one subagent and one skill to `acid-prophet`:

- **`spec-auditor`** — subagent that owns all spec-review logic. Reads the spec,
  runs SDD-strict + reality + narrative + style checks, returns a
  structured report (BLOCKER / WARNING / INFO + auto-fix candidates). Pure
  read; never mutates the spec.
- **`acid-prophet:audit-spec`** — standalone skill that takes a spec path,
  dispatches `spec-auditor` in `report-only` mode, renders the report in the
  acid-prophet voice, and offers a hand-off menu (apply auto-fixes, open
  spec, hand to `linear-devotee:create-project`, stop).

Modify `acid-prophet:write-spec`:

- **Step 4** — add a guideline: keep code minimal in specs (interfaces,
  signatures, schemas, short pseudo-code only). Concrete code examples
  belong in Linear issues, not specs.
- **Step 6** — replace inline review with a `spec-auditor` dispatch in
  `auto-fix-trivial` mode. `trip` applies the auto-fix candidates
  (frontmatter patches, empty-section fills with sensible defaults), then
  surfaces remaining BLOCKER/WARNING/INFO findings to the user before
  Step 7.

## Architecture

```
                 ┌──────────────────┐
                 │ trip (step 6)    │
                 │ auto-fix mode    │
                 └────────┬─────────┘
                          │ Agent dispatch
                          ▼
       ┌───────────────────────────────┐
       │ scryer (subagent)             │
       │ reads spec + CLAUDE.md +      │
       │ package.json + named files    │
       │ → structured report           │
       │   BLOCKER/WARNING/INFO        │
       └────────▲──────────────────────┘
                │ Agent dispatch
       ┌────────┴────────┐
       │ scry (skill)    │
       │ report-only     │
       │ standalone      │
       └─────────────────┘
```

The subagent is the single owner of the review logic. Both `trip` Step 6
and the `scry` skill dispatch the same subagent — only the `mode` argument
differs. Helpers for applying auto-fix patches live in
`acid-prophet/lib/` or `acid-prophet/claudecode/lib/` when runtime-specific and are pure Node (testable).

## Components / data flow

### `spec-auditor` subagent

**File location:** `acid-prophet/agents/spec-auditor.md`.

**Tools allowlist:** `Read`, `Glob`, `Bash` (read-only invocations only:
`git`, `ls`). No `Edit` or `Write`. The subagent never mutates the spec.

**Input** (passed as Agent prompt context):
- `spec_path` — absolute path to the spec under review
- `project_root` — absolute path to the project root, used for reality
  checks
- `mode` — `report-only` or `auto-fix-trivial`. The mode does not change
  what the subagent reports; it only signals to the caller which fixes
  are eligible for automatic application.

**Pipeline:**
1. Read the spec file at `spec_path`.
2. **SDD-strict checks**:
   - Frontmatter present and parseable as YAML
   - Required keys present and non-empty: `id`, `status`,
     `linear-project`, `verified-by`, `last-reviewed`
   - Required sections present (matched by heading prefix, case-insensitive):
     `Problem`, `Solution`, `Architecture`, `Components`,
     `Error handling`, `Testing`, `Non-goals`. Variants like
     `Components / data flow` or `Testing approach` match by prefix.
   - If an `Acceptance` section is present, validate EARS syntax:
     `WHEN <trigger>, THE SYSTEM SHALL <behavior>` or
     `IF <condition>, THE SYSTEM SHALL <behavior>`
3. **Reality check**:
   - Read `<project_root>/CLAUDE.md` if present; flag spec statements
     that contradict documented conventions
   - Read `<project_root>/package.json` if present; flag dependency
     additions that contradict the declared stack or any "no deps"
     policy in CLAUDE.md
   - For each file path mentioned in the spec body (e.g.
     `src/foo.ts`, `<plugin>/bar.mjs`): glob/check existence. Flag
     missing paths as WARNING — could be new code or a typo, the user
     decides.
4. **Narrative checks**:
   - Placeholder scan: `TBD`, `TODO`, `_unclear_`, `xxx`
   - Internal consistency: scan for sections that contradict each
     other (e.g. V1 scope lists feature X, Non-goals also lists X)
   - Scope: heuristic — if the spec describes more than one
     architecturally independent subsystem, flag for decomposition
   - Ambiguity: flag sentences with vague quantifiers ("some users",
     "various fields", "etc.") in normative sections
5. **Style checks**:
   - Heavy code blocks: any fenced code block longer than 15 lines is
     flagged INFO `[style] consider moving heavy examples to Linear
     issues`. Threshold is intentional: short snippets stay; full
     examples leave.
6. **Classify** each finding as BLOCKER, WARNING, or INFO:
   - **BLOCKER** — frontmatter invalid, required section missing,
     stack contradiction (e.g. forbidden dep)
   - **WARNING** — ambiguity, scope, missing referenced file,
     EARS violation
   - **INFO** — style, placeholders that can be auto-resolved, naming
     suggestions
7. Return structured markdown (format below).

**Output format** (returned by the subagent as its final message):

```
# scryer report — <spec_path>

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

Empty sections render as `(0)` with no bullets. The summary line is
always present.

### `scry` skill

**File location:** `acid-prophet/skills/audit-spec/SKILL.md`.

**Invocation:** `/acid-prophet:audit-spec <spec-path>`

**Steps:**
1. **Step 0 — Preconditions.** Read `../../../persona.md`. Verify the
   `<spec-path>` argument is provided and the file exists. Verify the
   path lives under `docs/acid-prophet/specs/`; if not, warn in voice and
   continue.
2. **Step 1 — Dispatch scryer.** Invoke `spec-auditor` with `mode=report-only`,
   `spec_path=<arg>`, `project_root=<git rev-parse --show-toplevel>`.
3. **Step 2 — Render report.** Print the subagent's structured report
   inline, wrapped with one short voice line (in acid-prophet voice).
4. **Step 3 — Hand-off menu.** Present numbered options:
   - `apply` — apply auto-fix candidates to the spec, commit
     `docs(acid-prophet): scryer auto-fixes`
   - `open` — print the spec path for the user to open in their editor
   - `linear` — only if `linear-project: _none_` and zero BLOCKER:
     hand off to `linear-devotee:create-project` with `<spec-path>`
   - `stop` — clean exit, voice line `"prophecy complete. architecture
     locked. 🔮"`

### `trip` Step 6 modifications

Replace current inline review with:

1. Dispatch `spec-auditor` with `mode=auto-fix-trivial`,
   `spec_path=<spec written in Step 5>`, `project_root=<git root>`.
2. Apply each entry in the report's `Auto-fix candidates` list to the
   spec via the helper `apply-frontmatter-patch.mjs` (and equivalent
   helpers for empty sections).
3. If any patches were applied: commit
   `docs(acid-prophet): scryer auto-fixes` (NEW commit, never amend).
4. If BLOCKER findings remain after auto-fix: present them to the user
   verbatim, ask for resolution. Do not advance to Step 7 until BLOCKER
   list is empty.
5. If only WARNING/INFO findings remain: present them, ask the user
   which to address. Document any acknowledged-and-deferred findings as
   comments in the spec or as items in Non-goals (user choice). Advance
   to Step 7.

### Helpers (Node, pure)

- **`apply-frontmatter-patch.mjs`** — given spec content (string) and a
  list of patches (`[{ key, value }]`), returns updated content with
  the YAML frontmatter mutated. Preserves trailing newline. Idempotent.
- **`parse-scryer-report.mjs`** — given the subagent's raw output
  (string), returns `{ blockers, warnings, infos, autoFixes, summary }`.
  Tolerates empty sections, missing summary line (returns null), and
  malformed bullets (skipped, not thrown).

Both live under `acid-prophet/<runtime>/lib/` and ship with `bun test`
coverage. This `lib/` convention is introduced by this spec — it is
the shared location for Node helpers reused across multiple skills of
the same plugin (existing single-skill plugins like `linear-devotee`
colocate helpers with hooks; `acid-prophet` needs cross-skill sharing).

## Error handling

**`spec-auditor` subagent:**
- `spec_path` not found → return single BLOCKER `[io] spec file not
  found: <path>`. No other checks attempted.
- Frontmatter unparseable → BLOCKER `[frontmatter] file has no valid
  frontmatter block`. Continue all other checks.
- `CLAUDE.md` absent → silently skip convention check; emit INFO
  `[reality-check] no CLAUDE.md found, conventions check skipped`.
- `package.json` absent → silently skip stack check; emit INFO
  `[reality-check] no package.json found, stack check skipped`.
- Referenced file not found in repo → WARNING (not BLOCKER) — could be
  new code intentionally referenced.
- No `Acceptance` section → silently skip EARS check (no INFO emitted).
- Internal failure → return single BLOCKER `[scryer] internal failure:
  <message>`. Exit cleanly. Never throw silently.

**`scry` skill:**
- Missing `<spec-path>` argument → ask the user. Do not dispatch.
- Spec path outside `docs/acid-prophet/specs/` → warn in voice
  (`"🔮 ce spec ne vient pas de mon temple — je le scrute quand même"`)
  and continue.
- Subagent returns malformed output → display raw output, voice line
  `"🔮 le scryer a parlé en langues — voici ses mots bruts"`. Skip the
  hand-off menu.
- Auto-fix patch fails (spec edited concurrently, write fails) → abort
  the patch, signal the user, leave the report intact. Do not retry.

**`trip` Step 6:**
- Auto-fix succeeds but `git commit` fails (lint hook, dirty tree) → do
  not retry, do not amend, do not `--no-verify`. Surface the failure to
  the user with voice line and wait for resolution.
- Pre-commit hook never bypassed.

**Hard rules:**
- `spec-auditor` is read-only: never writes any file. Tools allowlist
  excludes `Edit` and `Write`.
- `scry` and `trip` Step 6 only ever modify files under
  `docs/acid-prophet/specs/` (the spec being audited).
- None of the three: `git push`, `git rebase`, `git commit --amend`
  (only NEW commits).
- None of the three: Linear mutation (issues, projects, milestones).

## Testing

### `spec-auditor` subagent — fixture-based integration tests

Fixtures live in `acid-prophet/<runtime>/tests/fixtures/scryer/`:

- `clean.md` — well-formed spec; expected: 0 blocker / 0 warning / 0
  info.
- `broken-frontmatter.md` — missing `status` and `last-reviewed`;
  expected: 2 blockers, 2 auto-fix candidates.
- `missing-sections.md` — no `Testing` and no `Non-goals` sections;
  expected: 2 blockers.
- `stack-contradiction.md` — proposes adding an npm dep, paired with a
  `CLAUDE.md` fixture that forbids deps; expected: 1 blocker
  `[stack:dependencies]`.
- `phantom-files.md` — references `src/does-not-exist.ts`; expected: 1
  warning `[reality-check]`.
- `ears-violation.md` — Acceptance section with non-EARS bullets;
  expected: warnings per malformed criterion.
- `code-heavy.md` — contains a 30-line code block; expected: 1 info
  `[style:components]`.

A test runner (`scryer.test.mjs`) dispatches the subagent against each
fixture (using the harness's CLI dispatch, e.g. `claude --print` or the
codex equivalent), parses the structured output via
`parse-scryer-report.mjs`, and asserts the expected counts and
categories.

### `scry` skill — flow test

`scry-flow.test.mjs` invokes the skill with a fixture spec, mocks the
subagent dispatch (returning a canned report), and asserts:
- Hand-off menu is rendered with the four expected options.
- Auto-fix candidates are *presented*, never applied without explicit
  user `apply` choice.

### `trip` Step 6 — integration test

`trip-step6.test.mjs` runs the modified Step 6 against a fixture spec
that contains trivial auto-fix candidates. Mocks the subagent dispatch
to return a known report. Asserts:
- The patch is applied to the spec file.
- A new commit is created with the expected message.
- BLOCKER findings (if any) are surfaced to the user (mocked
  interaction).
- The flow does not advance to Step 7 while BLOCKERs remain.

### Helpers — TDD

- `apply-frontmatter-patch.test.mjs` — add field, update field, preserve
  formatting, idempotency, malformed input handling.
- `parse-scryer-report.test.mjs` — empty sections, missing summary,
  malformed bullets, well-formed report round-trip.

### CI

`bunx bun test acid-prophet/` and `bunx biome check .` must pass before
push. Same gate as the rest of the marketplace.

## Non-goals

- **Cross-spec duplication detection.** If two specs in
  `docs/acid-prophet/specs/` describe the same feature, `spec-auditor` does
  not flag it. Future work, possibly delegated to `oracle` on the
  `linear-devotee` side at project-creation time.
- **Cross-reference with existing Linear issues.** `spec-auditor` stays local
  to the repo. It does not query Linear.
- **Non-trivial auto-fix.** V1 only auto-applies frontmatter patches
  and empty-section default fills. Rewriting ambiguous sections,
  reformatting Acceptance criteria into EARS, or expanding Non-goals
  is left to the user.
- **Pre-commit hook integration.** No automatic spec audit on `git
  commit`. The user invokes `/acid-prophet:audit-spec` deliberately, or
  `write-spec` invokes the subagent during its audit step.
- **Numeric quality score.** No `"spec quality: 7/10"` output —
  not actionable.
- **Linear issue generation from BLOCKERs.** `spec-auditor` audits.
  `acolyte` (linear-devotee) creates issues. The two stay separate.
