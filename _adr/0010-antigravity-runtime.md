# ADR 0010 — Antigravity CLI as a third runtime with cross-agent delegation

- **Status**: Accepted
- **Date**: 2026-11-23
- **Scope**: `<plugin>/.antigravity-plugin/plugin.json`, `scripts/check-plugin-invariants.mjs`,
  `scripts/bump-plugin-versions.mjs`, the `/release` and `/scaffold-plugin` local skills.

## Context

Google replaced Gemini CLI with Antigravity CLI (`agy`) in May 2026. Gemini CLI's
`gemini-extension.json` format does not apply to it. An Antigravity plugin is a folder with
a `plugin.json` manifest. The documented location for repositories that also ship
`.claude-plugin/` is `.antigravity-plugin/plugin.json`
(https://antigravity.google/docs/build-plugins).

The following was checked with `agy` 1.5.15 against every plugin in this repository on
2026-11-23:

- `agy plugin validate ./<plugin>` loads all root `skills/*/SKILL.md` unchanged.
- `agy plugin install https://github.com/<owner>/<repo>/<plugin>` resolves a monorepo
  subfolder.
- Installation copies the whole plugin folder to `~/.gemini/config/plugins/<plugin>`. As a
  result, `../../persona.md` and `shared/` still resolve next to the skills.
- Re-running `install` replaces the installed copy.
- Antigravity reads `agents/*.md` from the same folder as Claude Code. It rejects the Claude
  model tiers (`haiku`, `sonnet`, `opus`) and skips those agents. Its tiers are `inherit`,
  `flash_lite`, `flash` and `pro`. Its tool names differ too (`view_file`, `run_command`,
  …), and an unknown tool name can hang a subagent.
- Antigravity reads hooks only from a root `hooks.json`, never from `hooks/hooks.json`, and
  that file uses a different contract:
  - hooks are grouped under names;
  - stdin uses camelCase fields (`conversationId`, `workspacePaths`, `lastUserInput`);
  - context is injected through `injectSteps`;
  - hooks run with the plugin root as the working directory;
  - there is no `UserPromptSubmit`, and `PostToolUse` cannot inject context.

## Decision

Support Antigravity as a third runtime:

- Every plugin ships `.antigravity-plugin/plugin.json` with the same `name` and `version`
  as its other manifests. `check:workflow` enforces that parity, and `bump:versions`
  bumps all three manifests together.
- Antigravity has no registry in this repository. Users install a plugin folder directly
  from GitHub.
- Skills stay canonical at the plugin root and are not duplicated for Antigravity.
- Antigravity does not expand `${CLAUDE_PLUGIN_ROOT}` in skill bodies. Its plugin root is
  the installed folder, `~/.gemini/config/plugins/<plugin>`.

### Delegation stays cross-agent

No runtime-neutral agent format exists. Agent Plugins v1
(https://agent-plugins.org/) explicitly leaves agents out. Cross-runtime repositories
either keep subagent roles as prompts that skills dispatch per runtime (`obra/superpowers`,
`firebase/agent-skills`) or generate a copy of each agent per runtime. A second agent file
per runtime would collide in `agents/`, so the canonical Claude agents remain the only
source. The generated `shared/agent-runtime-map.md` resolves each logical id through the
first route the runtime supports:

1. **Named agent** for runtimes that register these agents (Claude Code, Codex).
2. **Prompt-defined subagent** for runtimes that can define one at runtime. On
   Antigravity this means `define_subagent` followed by `invoke_subagent`:
   - the system prompt is the canonical agent body;
   - capability switches come from the Claude allowlist;
   - a neutral **Tier** comes from the Claude model (`haiku`→`flash_lite`,
     `sonnet`→`flash`, `opus`→`pro`).
3. **Inline** execution of the same body when the runtime has no subagent support.

The generator derives **Tier** and **Needs** mechanically and fails on a tool it cannot
classify, so the map never guesses a capability. Skills do not change: they already read the
map before delegating.

The following was checked with `agy` 1.5.15 on 2026-11-23:

- `invoke_subagent` accepts `Model` values `inherit`, `flash_lite`, `flash` and `pro`.
- `EnableWriteTools: false` also removes command execution, so the `shell` need enables
  write tools.
- Subagents have `search_web` but no page fetch, so web-only agents can return less
  evidence.
- A `flash_lite` subagent ignored a strict output format, so the delegation prompt must
  restate the format.
- An end-to-end `lore-hound:research` run took route 2 with the exact names, tiers and
  switches from the generated map.

### Hooks: one script, one config per runtime

Hook scripts stay shared. Each hooked plugin adds a root `hooks.json` for Antigravity, and
every command in it goes through `claudecode/hooks/antigravity-hook.mjs`. That bridge is
copied from `_shared/runtime/src/` by `build:runtime` and checked by `check:runtime`. It:

- translates the camelCase stdin into the Claude hook shape (`conversationId` → `session_id`,
  the first workspace → `cwd`, `lastUserInput` → `prompt`, the edited path →
  `tool_input.file_path`);
- runs the script from the workspace, because Antigravity runs hooks from the plugin root;
- returns `additionalContext` as an `injectSteps` system message.

The events map as follows:

- `UserPromptSubmit` becomes `PreInvocation`, which runs the script only when
  `invocationNum` is 0.
- `PostToolUse` cannot inject on Antigravity. The bridge therefore keeps that context under
  `PLUGIN_DATA` and injects it at the next `PreInvocation`.
- The CLI's edit tools are `write_file` and `edit_file`, with a `Path` argument. The docs
  name the app tools `write_to_file` and `replace_file_content`, with `TargetFile`. The
  matchers cover both.

The following was checked with `agy` 1.5.15 on 2026-11-23:

- Moon Moth's workspace hint and Subroutine's digest arrive at session start.
- Subroutine's full discipline bodies arrive right after a `.ts` write.
- Linear Devotee detects an issue from the branch and from the first prompt.

## Consequences

- On Antigravity, Claude-format agents never load as named agents. The plugin still
  installs and the agents are silently skipped. Delegation goes through the prompt-defined
  route instead.
- A new hooked plugin needs both `hooks/hooks.json` and a root `hooks.json`. Its plugin must
  also be added to the `build:runtime` and `check:runtime` loops.
- `agy plugin validate` reports the skipped agents as errors. Those errors are expected and
  are not a release gate.
- Monkey Maestro's transport has an `antigravity` provider. Attaching a second `agy acp`
  client forks the conversation instead of waking the live session. Completion of a
  background task does wake it, so the receiver works like this:
  - it runs `notify.mjs listen --socket <path>` as one bounded background task;
  - that task ends on the first event batch;
  - the session re-arms a listener before handling those events;
  - a sender waits up to 10 seconds for an armed listener, then reports `failed`.

  There is no queue, no daemon and no disk state. A live run on `agy` 1.5.15 delivered a
  worker `done` event to a listening session, which woke and read it.
