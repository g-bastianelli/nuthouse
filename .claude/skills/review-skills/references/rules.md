# Skill review rules

## Contents

- [How to read a rule](#how-to-read-a-rule)
- [A — Anthropic Agent Skills and Claude Code](#a--anthropic-agent-skills-and-claude-code)
- [C — Codex and cross-runtime](#c--codex-and-cross-runtime)
- [N — nuthouse house rules](#n--nuthouse-house-rules)
- [Sources](#sources)

## How to read a rule

Each rule has an id, a check type, a severity, and its source key.

- **mech** — `scripts/check-skills.mjs` decides it. Reviewers do not re-litigate a mech
  result; they may add context to it.
- **judgment** — a reviewer decides it from the skill's text and must quote the line.
- **CRITIQUE** — the skill fails to load, fails to trigger, breaks on one runtime, or
  violates a hard rule. **WARNING** — it works, but degrades. **INFO** — worth knowing.

A `genre: contract` skill (background knowledge injected by a hook) is exempt from every
rule about voice, workflow, reports, hand-offs, and user-facing strings.

## A — Anthropic Agent Skills and Claude Code

| Id  | Rule                                                                                                                                                                                | Type     | Severity | Source    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| A01 | `name` present, ≤ 64 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, contains neither `anthropic` nor `claude`.                                                                                  | mech     | CRITIQUE | [OV]      |
| A02 | `name` equals the skill's folder name.                                                                                                                                              | mech     | WARNING  | [AS] [CS] |
| A03 | `description` present, non-empty, ≤ 1024 chars, no `<` or `>`.                                                                                                                      | mech     | CRITIQUE | [OV]      |
| A04 | `description` + `when_to_use` ≤ 1536 chars — the Claude Code listing truncates beyond that.                                                                                         | mech     | WARNING  | [CS]      |
| A05 | The description says what the skill does **and** when to use it, in the third person, main use case and trigger words first. Not generic ("helps with documents").                  | judgment | WARNING  | [BP] [CS] |
| A06 | Body under 500 lines; detailed reference material moves to linked files.                                                                                                            | mech     | WARNING  | [BP] [CS] |
| A07 | Concise: no explaining what the model already knows, no narrating how or why when stating what to do suffices. Every loaded line is a recurring token cost.                         | judgment | WARNING  | [BP] [CS] |
| A08 | Degrees of freedom match fragility: destructive or high-stakes operations get exact steps, a validation loop (plan → validate → execute → verify); flexible tasks get heuristics.   | judgment | WARNING  | [BP]      |
| A09 | Supporting files are linked directly from SKILL.md (one level deep), exist, and SKILL.md says when to read or run each.                                                             | mech     | WARNING  | [BP] [SC] |
| A10 | A supporting markdown file over 100 lines opens with a table of contents.                                                                                                           | mech     | INFO     | [BP] [SC] |
| A11 | No time-sensitive statements ("as of 2026", "before August, use…"); legacy patterns are labelled as such.                                                                           | judgment | WARNING  | [BP]      |
| A12 | One term per concept throughout the skill.                                                                                                                                          | judgment | INFO     | [BP]      |
| A13 | Where output format matters, show a template or an input/output example.                                                                                                            | judgment | INFO     | [BP]      |
| A14 | Bundled scripts handle their own errors, state whether to run or read them, and justify every constant.                                                                             | judgment | WARNING  | [BP]      |
| A15 | Claude Code frontmatter values are valid: `context` is only `fork`; `agent` and `background` only with `context: fork`; `effort` ∈ low/medium/high/xhigh/max; booleans are boolean. | mech     | CRITIQUE | [CS]      |
| A16 | A skill that changes behavior is evaluated against realistic prompts before and after the change, on the models it targets.                                                         | judgment | INFO     | [BP]      |

## C — Codex and cross-runtime

Applies to every plugin registered in `.agents/plugins/marketplace.json`: one SKILL.md
serves both runtimes, so a Claude-only feature must degrade legibly on Codex.

| Id  | Rule                                                                                                                                                                                                                                 | Type     | Severity | Source    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| C01 | The file opens with `---` frontmatter and closes it; without it Codex does not load the skill.                                                                                                                                       | mech     | CRITIQUE | [P]       |
| C02 | Qualified name `<plugin>:<skill>` ≤ 129 chars.                                                                                                                                                                                       | mech     | CRITIQUE | [L]       |
| C03 | A description containing `: ` is quoted; strict YAML validators reject it unquoted.                                                                                                                                                  | mech     | WARNING  | [P] [SC]  |
| C04 | No `disable-model-invocation: true` in a Codex plugin: Codex plugin validation rejects it and the runtime ignores it. Use `agents/openai.yaml` `policy.allow_implicit_invocation: false`.                                            | mech     | CRITIQUE | [VP] [P]  |
| C05 | Claude-only keys (`paths`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `context`, `agent`, `background`, `model`, `effort`, `argument-hint`, `arguments`, `hooks`, `shell`, `when_to_use`) are ignored by Codex.          | mech     | INFO     | [P]       |
| C06 | The body does not depend on a C05 key for correctness (a `paths`-scoped discipline triggers by description alone on Codex; a `when_to_use` trigger is invisible there).                                                              | judgment | WARNING  | [P]       |
| C07 | `$ARGUMENTS`, `$0`–`$9`, and named `$args` are not expanded on Codex: phrase them so the literal still reads ("the user's request (`$ARGUMENTS`)").                                                                                  | mech     | WARNING  | [CM]      |
| C08 | `` !`cmd` `` and ` ```! ` blocks are not expanded on Codex: the block carries the fallback line telling the reader to run the commands when they appear raw.                                                                         | mech     | WARNING  | [CM] [CS] |
| C09 | Codex has no Agent tool: a skill names an agent by logical id `<plugin>:<agent>` and resolves it through `<plugin>/shared/agent-runtime-map.md`, never by a raw `subagent_type` alone.                                               | mech     | WARNING  | [SA]      |
| C10 | The skill folder holds only `SKILL.md`, `scripts/`, `references/`, `assets/`, `agents/openai.yaml` — no README, CHANGELOG, or install guide.                                                                                         | mech     | WARNING  | [SC] [S]  |
| C11 | `agents/openai.yaml`, when present: `interface.display_name` and `interface.short_description` non-empty (short description 25–64 chars), `default_prompt` mentions `$<plugin>:<skill>`, `policy.allow_implicit_invocation` boolean. | mech     | WARNING  | [SC] [VP] |
| C12 | Codex lists skills in ≤ 2 % of the context window (8 000 chars when unknown) and shortens descriptions first: the total of all descriptions stays under that budget, or each description front-loads its trigger.                    | mech     | WARNING  | [S]       |
| C13 | Trigger conditions live in the description, not only in a body section: the body loads after selection.                                                                                                                              | judgment | WARNING  | [SC] [PS] |
| C14 | The skill bounds its workflow: expected input, output, facts it must not infer, when to ask, stop, or decline — and that explicit user instructions win.                                                                             | judgment | INFO     | [PS]      |

## N — nuthouse house rules

Source for every N rule: the repository `CLAUDE.md`, `_adr/0007-prose-orchestration-over-a-workflow-kernel.md`,
and the plugin's `persona.md`.

| Id  | Rule                                                                                                                                                                           | Type     | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- |
| N01 | A workflow skill has a `## Voice` section that points to `../../persona.md`.                                                                                                   | mech     | CRITIQUE |
| N02 | The `## Voice` section scopes the voice to the skill and ends it at the final report or hand-off.                                                                              | mech     | WARNING  |
| N03 | The voice holds end to end — reports, menus, errors, hand-offs — not just an opener; the skill does not redeclare the persona's tone, vocabulary, or emoji set.                | judgment | WARNING  |
| N04 | Actions stay serious, only strings are fun: no joke side effects, fantasy failure modes, or voice that obscures what was actually done.                                        | judgment | CRITIQUE |
| N05 | Emojis are rare: at most one per line.                                                                                                                                         | mech     | WARNING  |
| N06 | Files are English; the runtime language comes from the persona's Language section. Hard-coded non-English user strings are a violation.                                        | mech     | WARNING  |
| N07 | Chaining uses `**REQUIRED SUB-SKILL:** Use \`<plugin>:<skill>\``, and the target skill exists.                                                                                 | mech     | CRITIQUE |
| N08 | A load-bearing guardrail is a named law: the rule in capitals, then a short `\| Excuse \| Reality \|` table. No protocol nobody executes (hashes, manifests, signed evidence). | judgment | INFO     |
| N09 | No silent `git commit`, `git push`, `git rebase`, and no external mutation (Linear, GitHub, cloud) without user confirmation unless the skill documents the authorization.     | judgment | CRITIQUE |
| N10 | No backwards compatibility: no alias for a retired name, deprecation path, migration note, or gate defending a past decision.                                                  | judgment | WARNING  |
| N11 | No prose block over 450 chars duplicated across two SKILL.md files (`bun run check:duplication`).                                                                              | mech     | WARNING  |
| N12 | State that must survive a compaction goes only in `.nuthouse/<subject>/progress.md`; no other durable local state.                                                             | judgment | WARNING  |
| N13 | A `genre: contract` skill has no `## Voice`, `## Workflow`, or `## Final Report`, and keeps its description short — a hook may inject it.                                      | mech     | WARNING  |

## Sources

Verified 2026-09-24. Re-verify any source a finding depends on when this date is more
than 90 days old: runtime behavior changes faster than this file.

- [OV] https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- [BP] https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- [CS] https://code.claude.com/docs/en/skills
- [AS] https://agentskills.io/specification
- [S] https://learn.chatgpt.com/docs/build-skills
- [PS] https://developers.openai.com/plugins/build/skills
- [SA] https://learn.chatgpt.com/docs/agent-configuration/subagents
- [SC] https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md
- [P] https://github.com/openai/codex/blob/main/codex-rs/skills/src/parser.rs
- [L] https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/loader/mod.rs
- [VP] https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/plugin-creator/scripts/validate_plugin.py
- [CM] https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/command_migration.rs
