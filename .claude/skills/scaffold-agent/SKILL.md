---
name: scaffold-agent
description: Use when adding a new dedicated subagent to an existing plugin in this `nuthouse` marketplace. Asks for parent plugin, agent name (descriptive role, no vague names like "agent" / "helper"), description, model (`haiku` for parsing/fetch+summary vs default for reasoning), explicit tools allowlist, input format spec, output format spec (SDD vs structured report vs custom). Generates `<plugin>/agents/<name>.md` with the right frontmatter (name, description, model, tools list) and the standard Mission / Input / Output / Hard rules sections. Encodes the subagent and SDD conventions from the legacy CLAUDE.md.
model: haiku
---

# scaffold-agent

## Voice

Read `../persona.md` at the start of this skill. The voice defined there
(mad-scientist) is canonical and applies to all output of this skill.

**Scope:** local to this skill's execution. Once the final report is
printed, revert to the session's default voice.

This skill is **rigid** — execute the steps in order.

## When you're invoked

The user wants to add a dedicated subagent to an existing plugin. Either
via `/scaffold-agent`, or routed from `scaffold-skill` when a skill
declared `Q5 = "dedicated agent"`.

## Step 0 — Preconditions

1. **Inside the `nuthouse` repo.** Verify cwd contains
   `.claude-plugin/marketplace.json`. If not, abort.
2. **Discover existing plugins.** Glob `<repo>/*/persona.md`. List the
   parent-plugin candidates.
3. **Verify the target has a plugin manifest.** A plugin can expose root
   `agents/` to Claude Code through `.claude-plugin/plugin.json`. If the
   target is truly Codex-only and has no `.claude-plugin/`, abort:
   > "ce plugin est codex-only. ajoute d'abord une branche Claude Code si
   > tu veux exposer des agents."

## Step 1 — Interview

### Q1 — Parent plugin

AskUserQuestion, single-select. Voice: _"dans quel laboratoire on relâche
l'organisme ?"_

### Q2 — Agent name (no prefix)

Free-text. Voice: _"comment l'organisme s'appelle-t-il ?"_

**Validation rules**:

- **Descriptive role or task name**: `explorer`, `issue-context`, `spec-auditor`, `code-reviewer`, `plan-writer`, `project-drafter`. ✅
- **No vague or persona-only names**: `agent`, `helper`, `worker`, `bot`, `seer`, `oracle`, `acolyte`, `scryer`, `spirit`. ❌ Panic-correct: _"non non non, `seer` ne dit rien. quel **rôle** précis ? `issue-context`, `spec-auditor`, `project-drafter` — qu'est-ce qu'il **fait** ?"_
- **No new voice agents**: decorative persona lines are now handled by `warden:voice` (centralized). New plugins do NOT create their own voice agent — they call `warden:voice` with `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`. All agents MUST have functional names.
- **Never the same as the plugin** (e.g. `subroutine:subroutine`). ❌
- Kebab-case, lowercase.
- **No prefix in the `name:` frontmatter** — the runtime prepends `<plugin>:`. The user types `spec-auditor`, the file says `name: spec-auditor`, the exposed ID is `acid-prophet:spec-auditor`.
- Must not collide with an existing agent file in the parent plugin.

### Q3 — Description

Free-text. Voice: _"décris l'organisme. read-only ? mutation ? quel est
son territoire ?"_

**Format**: 1–2 sentences, English. Should make the routing decision
obvious for whoever calls the agent.

### Q4 — Model

AskUserQuestion, single-select:

- `haiku` (Recommended for: mechanical parsing, MCP fetch + summary, structured discovery — anything that doesn't need deep reasoning)
- `sonnet` (audit, plan review, spec validation — needs reasoning but not creative writing)
- `opus` (drafts SDD content, makes structural decisions — top-tier creation, low volume)
- `inherit` (no `model:` field — let the runtime pick — use sparingly)

[IF Q4 = opus] Emit a voice warning: _"opus sur un agent ? cher. réservé aux drafters SDD / décisions structurantes. sinon sonnet suffit."_

### Q4b — Effort

AskUserQuestion, single-select:

- `low` (Recommended for haiku agents: fetch + parse + summary, no multi-step reasoning — ignoré silencieusement sur haiku quoi qu'on choisisse, autant mettre `low`)
- `high` (deep audit, spec review, multi-constraint comparison)
- `xhigh` (complex reasoning, large context navigation)
- `max` (top-tier drafting / structural decisions — risque d'overthink, low-volume only)
- `inherit` (no `effort:` field — let the runtime decide)

[IF Q4b = max] Emit a voice warning: _"max = budget de pensée illimité. la doc Claude prévient : peut overthink. réservé aux agents qui produisent du contenu structurant (project-drafter, milestone-drafter, …)."_

[IF Q4 = haiku AND Q4b ≠ low AND Q4b ≠ inherit] Emit: _"effort sur haiku = ignoré silencieusement. force `low` ou `inherit` pour rester clean."_

### Q5 — Tools allowlist (explicit)

AskUserQuestion, multiSelect. Common categories:

- **Read-only basics**: `Read`, `Glob`, `Grep`, `Bash` (restricted to
  read-only ops)
- **Linear MCP**: `mcp__claude_ai_Linear__get_issue`,
  `mcp__claude_ai_Linear__list_comments`,
  `mcp__claude_ai_Linear__get_project`, etc.
- **Github MCP / WebFetch / WebSearch** for external research
- **Write tools** (`Write`, `Edit`, `NotebookEdit`) — flag a warning in
  voice: _"non non non, `Edit` sur un agent ? sûr ? un agent dédié est
  généralement read-only. justifie."_ Only allow if the user explicitly
  confirms.

Build the final list. Voice: _"ok l'allowlist est fixée. RIEN d'autre ne
passe."_

### Q6 — Input format

Free-text. Voice: _"par quel canal je nourris l'organisme ?"_

**Convention**: short structured plaintext. Examples from existing
agents:

- `issue-context`: `ISSUE_ID: ENG-247\nPROJECT_ROOT: /abs/path`
- `explorer`: `PROJECT_ROOT: /abs/path\nTARGET: src/features/foo.tsx`

The agent's caller sends this as the `prompt` argument of the `Agent`
tool. Keep the field set tight — 2–4 keys typically.

### Q7 — Output format

AskUserQuestion, single-select:

- `SDD brief` — for semantic scouts that synthesize a ticket / spec.
  Goal / Context / Files / Constraints / Acceptance / Non-goals /
  Edges / Questions. Mark missing fields with `_unclear_`. Cap at 500
  words. (See `issue-context.md`.)
- `Structured technical report` — for discovery agents that scan a
  codebase. Sections defined explicitly with placeholder values. (See
  `explorer.md`.)
- `Custom` — free-form. Flag in final report; user must define the
  shape themselves.

### Q8 — References a shared cross-cutting contract?

AskUserQuestion, single-select. Voice: _"l'organisme partage-t-il un contrat avec d'autres organismes du même labo ?"_

- `no` (Recommended for first agent in a plugin)
- `yes` — agent body references a `<plugin>/shared/<contract>.md` for cross-cutting rules (style, fallback paths, persona)

[IF Q8 = yes] Follow-up free-text:

- _"nom du contrat (kebab-case, ex. `provider-selection`, `persona-line-contract`) :"_ → save as `CONTRACT_NAME`
- _"label de l'aspect (ex. `Provider selection`, `Persona`) :"_ → save as `CONTRACT_ASPECT`

At generation time, inject this line into the agent's `## Mission` (or wherever the contract applies):

```markdown
**<CONTRACT_ASPECT>.** See `${CLAUDE_PLUGIN_ROOT}/shared/<CONTRACT_NAME>.md`.
```

Rule: keep the reference one level deep. Never use relative paths (`../../shared/...`) — agent CWD is unpredictable; always `${CLAUDE_PLUGIN_ROOT}`.

If `<PLUGIN>/shared/<CONTRACT_NAME>.md` does not yet exist, remind the user in the final report: _"le contrat n'est pas encore écrit. crée `<PLUGIN>/shared/<CONTRACT_NAME>.md` séparément (1 paragraphe suffit pour un fallback ; plus pour un persona contract avec input/output schema, hard limits, examples)."_

## Step 2 — Generation

Write `<PLUGIN>/agents/<AGENT>.md` (use the Write tool).

**Template source:** Before generating the agent file, read `_templates/agent/AGENT.md`.
This is the source of truth for agent file structure. Substitute:

- `{{agent}}` → agent name (descriptive role, no "agent" suffix)
- `{{description}}` → one-line description from interview

Fill `[bracketed]` sections with content from the interview. Do not add
sections not present in the template.

### Frontmatter

```yaml
---
name: <AGENT>
description: <DESCRIPTION>
model: <Q4-value> # [IF Q4 ∈ {haiku, sonnet, opus}, else omit this line]
effort: <Q4b-value> # [IF Q4b ∈ {low, high, xhigh, max}, else omit this line]
tools:
  - <Tool 1>
  - <Tool 2>
  - ...
---
```

[IF Q4 = inherit] Omit the `model:` line entirely (don't set it to a
placeholder). The runtime picks the default.
[IF Q4b = inherit] Omit the `effort:` line entirely.

### Body

```markdown
You are the <AGENT> — a <read-only | write-capable> <role-noun> for the
`<PLUGIN>` plugin. <One sentence on the agent's purpose, copying the
voice from the parent persona but in neutral phrasing.> You do **not**
write to <whatever you don't write to>, **ever**.

## Input

You will be invoked with a message in this format:

\`\`\`
<INPUT FORMAT FROM Q6>
\`\`\`

<Brief explanation of what each field is used for.>

## Mission (in order)

### 1. <First step>

<TODO: what tools are called, in what order, with what args. Be
explicit. If MCP calls can run in parallel, say so.>

### 2. <Second step>

<TODO>

### N. Output the result

<TODO: reference the Output Format section below.>

## Output Format

[IF Q7 = SDD]
Return **only** this markdown, under 500 words. Never invent content. If
a field can't be filled from the input, write `_unclear_` and add a
question to the questions list.

\`\`\`markdown

## Brief from <AGENT> — <id>

**<Subject>** : <id> — <title>

**Goal** (1 sentence) : <synthesis> | _unclear_

**Context**
<2-3 lines: why, architecture touched, services involved> | _unclear_

**Files referenced** (existing state)

- `path/x.ts` — currently does Y
- `path/y.ts` — does not exist yet
- (or "none referenced — to be discovered")

**Constraints**

- <stack, perf, compliance — explicit or inferred>
- (or _unclear_)

**Acceptance criteria** (verifiable)

- <bullet>
- (or _unclear_)

**Non-goals** / out of scope

- <explicitly excluded>
- (or _unclear_)

**Edge cases & ambiguities detected**

- <vague points, contradictions, TBDs>

**Suggested clarifying questions**

- <prioritized: most blocking _unclear_ field first>
  \`\`\`
  [/ENDIF]

[IF Q7 = Structured technical report]
Return ONLY this structured report (no prose outside the sections):

\`\`\`

## <Section 1>

- <Field>: <value>

## <Section 2>

- <Field>: <value>
  \`\`\`

(User fills the section names and fields based on the agent's domain.)
[/ENDIF]

[IF Q7 = Custom]
<TODO: define the output shape. Keep it strict — no free-form prose.>
[/ENDIF]

## Hard rules

- **You are read-only.** You have no write tools. Don't even try.
  [omit this rule if Q5 included Write/Edit and the user confirmed]
- **No invention.** If the input doesn't say it, the comments don't say
  it, and the files don't show it, mark it `_unclear_` and surface a
  question.
- **No code generation.** Source files are off-limits — `Read` and
  `Glob` only.
- **Output stays under 500 words** [SDD] or **stays inside the defined
  sections** [structured]. Be concise. The caller reads this in main
  context — don't waste tokens.
- **Voice = neutral.** No <plugin-voice> talk in the agent's output;
  the calling skill wraps your output in voice. You stay clean and
  structured.
```

## Step 3 — Final report

```
<voice intro: e.g. "l'organisme respire. ses tools sont sous clé. 🔬">

scaffold-agent report
  Plugin:        <PLUGIN>
  Agent:         <PLUGIN>:<AGENT>
  Description:   <DESCRIPTION>
  Model:         <haiku | sonnet | opus | inherit>
  Effort:        <low | medium | high | xhigh | max | inherit>
  Tools:         <comma-separated list>
  Input format:  <one-line summary>
  Output format: <SDD | structured report | custom>
  File written:  <PLUGIN>/agents/<AGENT>.md
  Next step:     wire the agent into a skill via the `Agent` tool — `subagent_type: '<PLUGIN>:<AGENT>'`
```

End with a voice exit line.

## Hard rules

1. **Never `git commit` / `git push` / `git rebase`.**
2. **Always explicit tools allowlist.** Never write `tools:` empty or
   missing — that grants everything. The whole point of a dedicated
   agent is restriction.
3. **Reject Write/Edit tools** unless the user explicitly justifies why
   the agent needs to mutate. Default agents are read-only scouts.
4. **No `## Voice` section** in agent files. Agents stay neutral —
   voice happens in the calling skill (this is the convention from
   `issue-context.md` and `explorer.md`).
5. **No prefix** in the `name:` frontmatter. The runtime prepends.
6. **Never overwrite** an existing agent file. Read first; if it
   exists, abort or ask.
7. **No external workflow/tool dependency** in the generated agent.

## Anti-patterns to detect and refuse

- ❌ Agent named `agent`, `helper`, `bot`, `worker`. Push back.
- ❌ `name: <plugin>:<agent>` (with prefix) → must be just `<agent>`.
- ❌ Empty `tools:` block → must be an explicit allowlist.
- ❌ Write/Edit in tools without justification → ask, don't assume.
- ❌ Free-form output format → must be either SDD or a fixed structured
  shape. The calling skill needs deterministic output to consume.
- ❌ `## Voice` section in agent file → that's a skill convention, not
  an agent one.

## Voice cheat sheet

From `../persona.md` (mad-scientist):

- "non non non, `helper`, ce nom est vide" — generic name correction
- "RIEN d'autre ne passe" — tools allowlist locked
- "l'organisme respire. ses tools sont sous clé. 🔬" — final report intro
- "tiens-moi la liste, on coupe ce qui dépasse" — trimming tools
- 🔬 — rare, inspection / verification phase

Actions stay serious. Voice stays mad. The agent stays neutral.
