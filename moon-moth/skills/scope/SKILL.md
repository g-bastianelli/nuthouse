---
name: scope
description: Use at the start of any task in a moon monorepo to scope work to the affected project graph — runs `moon query changed-files`/`affected`, dispatches the affected-scout subagent, and returns a structured scope map (affected projects, layers, tasks, downstream blast radius). Prefer this over blindly scanning the repo when working in a repo with a `.moon/` workspace.
argument-hint: [working-tree|default-branch|<base>..<head>]
effort: high
allowed-tools: Bash(moon query:*), Bash(git status:*), Bash(git diff:*), Read, Agent
---

# scope

> At visible transitions, try to dispatch `warden:voice` with `SUMMARY: <≤15 words, in the user's language>`, `PERSONA_CONTRACT_PATH: ${CLAUDE_PLUGIN_ROOT}/shared/persona-line-contract.md`, and `VOICE_FLAG_PATH: $HOME/.claude/nuthouse/voice.state`. Print the returned `line` only when non-empty. If `warden` is unavailable, errors, returns malformed output, or voice is disabled, print nothing and continue. Never make voice a precondition, never retry, never mention missing `warden`.

## Voice

Read `../../persona.md` at the start of this skill. The moon-moth voice is
canonical for all output here. Apply it to the wrapper lines around reports;
keep the report blocks themselves plain.

**Scope:** local to this skill's execution only. Once the final report is
printed, revert to the session default voice.

This skill is **rigid** — execute steps in order.

## Context

> Auto-injected on Claude Code at skill load. If the lines below show literal `` !`...` `` text, run those commands manually before step 1.

- Workspace check: !`ls .moon 2>/dev/null && echo "moon workspace" || echo "no .moon here"`
- Changed files: !`git status --porcelain | head -30`

## Language

Adapt all output to match the user's language. Technical identifiers (project
ids, file paths, CLI flags, task names) stay in their original form.

## When you're invoked

The agent (or user) is about to work on a task in a moon monorepo and needs to
know _which projects the change touches_ before reading code or running tasks.
This is the moon-moth's first move: follow the lamp, find the affected graph,
land only there.

## Step 0 — Preconditions

1. Find the moon workspace root: the `Workspace check` line in `## Context`
   already answers for cwd — `moon workspace` means cwd is the root. On
   `no .moon here`, walk up from cwd for a directory containing `.moon/`.
   If none is found, abort: _"pas de lampe ici — ce n'est pas un
   workspace moon (`.moon/` introuvable). rien à éclairer."_ and suggest the
   caller proceed without moon scoping.
2. Capture `PROJECT_ROOT` = the moon workspace root (it is the git root in a
   standard moon repo). Run `moon --version` to confirm the binary is reachable;
   if it fails, abort and tell the user moon is not installed/on PATH.
3. If the artifact will be persisted (Step 4), ensure
   `${PROJECT_ROOT}/docs/moon-moth/scope/` exists.

## Step 1 — Pick the base

Decide what "changed" means: if `$ARGUMENTS` contains a base (`working-tree`, `default-branch`, or a `<base>..<head>` revision pair), use it; otherwise infer from the user's intent:

- Default (uncommitted work / "what am I touching now") → working tree
  (`moon query changed-files --local`). The `Changed files` line in
  `## Context` previews this; an empty preview hints the working tree is
  clean and `--default-branch` is probably the intended base.
- "vs main" / "for this branch" / pre-PR → `moon query changed-files
--default-branch`.
- Explicit revisions → `--base <sha> --head <sha>`.

State the chosen base in one line before dispatching.

## Step 2 — Dispatch the affected-scout subagent

Dispatch `moon-moth:affected-scout` (see `## Subagent dispatch`). It runs the
`moon query` commands from the `moon-moth:moon-commands` knowledge skill
(`${CLAUDE_PLUGIN_ROOT}/skills/moon-commands/SKILL.md`) and returns the scope
map defined in the `moon-moth:affected-scope` contract
(`${CLAUDE_PLUGIN_ROOT}/skills/affected-scope/SKILL.md`).

If subagents are unavailable, run the same `moon query` commands inline and build
the scope map yourself.

## Step 3 — Read the field of light

From the returned scope map:

- If `affected` is empty (`summary: _dark_`) → say the dark stays dark: nothing
  changed, no projects to scope. Skip to the menu with only `(s) stop`.
- Otherwise summarise: the changed files count, the affected projects (id +
  layer + stack), their verification-relevant tasks, and the downstream
  blast radius (what else could break).

## Step 4 — Persist the scope map (optional)

When the task is non-trivial or will be handed off, write the scope map to
`${PROJECT_ROOT}/docs/moon-moth/scope/<branch-or-timestamp>.json` so the
implementation turn and `verify` can read it without recomputing. Skip for a
quick one-off scope.

## Step 5 — Final report + hand-off

```text
moon-moth:scope report
  Base:        <working-tree | default-branch | sha..sha>
  Changed:     <N files>
  Affected:    <id (layer/stack), …>  | _dark_
  Tasks:       <typecheck, lint, test, … present across the affected set>
  Downstream:  <dependent project ids> | none
  Scope map:   ${PROJECT_ROOT}/docs/moon-moth/scope/<file>.json | not persisted
```

Then present the hand-off menu:

```
<voice intro line — moon-moth>
(i) implement → start the implementation turn, bounded to the affected set
(v) verify    → hand to moon-moth:verify, run affected :typecheck/:lint/:test
(s) stop      → leave the map, fly off
```

On `(i)`, hand the artifacts to the implementation turn. Emit this directive to
the implementing agent: read every provided artifact before writing code, honor
the repo's `AGENTS.md`/`CLAUDE.md`, let the `subroutine` discipline skills
activate on matching files, stay bounded to the affected set, and close with
`moon-moth:verify` (this is a moon workspace). The handoff carries the
**scope map JSON inline** — affected project ids, layers, stacks, tasks, and
downstream blast radius — not just a pointer to the persisted file. The
implementer must see the field of light without re-running `moon query`:

```
TASK: <what to implement, from the user's intent>
SCOPE_MAP:
<full scope map JSON from Step 2, verbatim>
SCOPE_MAP_FILE: ${PROJECT_ROOT}/docs/moon-moth/scope/<file>.json | _not-persisted_
```

Branch on the response. Exit the skill when the chosen branch finishes.

## Subagent dispatch (Step 2)

This skill dispatches the `moon-moth:affected-scout` subagent.

```
Agent({
  subagent_type: 'moon-moth:affected-scout',
  description: 'scope affected moon projects',
  prompt: `MOON_ROOT: <abs path to the .moon/ workspace root>
BASE: <working-tree | default-branch | "<base-sha>..<head-sha>">
DOWNSTREAM: deep   # include dependents in the blast radius
Return the scope map per the affected-scope contract.`,
})
```

## Never

- Run `git push`, `git commit`, or `git rebase`.
- Invent affected projects — every entry comes from `moon query` JSON.
- Widen scope by scanning the whole repo when an affected set exists.
- Substitute `bun run`/`bunx` for a `moon` command.
- Mutate external services without explicit user confirmation.
