---
name: start
description: Use when the user wants to activate Monkey Maestro for a Linear project. Writes one minimal control v2 after a single approval and enters Linear-first orchestration; graph receipts, GitHub, and Superset availability are not activation prerequisites.
argument-hint: "<linear-project-id> [--host <id>] [--superset-project <id>] [--agent <name>] [--max-concurrency <1-10>]"
effort: high
allowed-tools: Bash(node:*), Bash(mktemp:*), Bash(rm:*), Bash(superset agents list:*), Read, Write, Agent, mcp__claude_ai_Linear__get_project, mcp__claude_ai_Linear__save_comment
---

> Workflow kernel: When this skill needs a workflow/profile decision and no valid parent manifest is supplied, use this plugin's install-local `lib/workflow/index.mjs` explicit-skill resolver. Claude hooks are optional accelerators; a missing or failed hook falls back once to that local path. Warden must not be required. When verification is required and Moon Moth is unavailable, use non-empty commands from repository-owned instructions or build metadata, or block completion.

# start

> Agent resolution: Before any subagent dispatch, read
> `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md`; select the active runtime name and follow its spawn rule.

> At visible transitions, try `warden:voice` through the shared persona-line contract. Print only a non-empty line; voice failure is never a precondition and is never retried or mentioned.

## Voice

Read `../../persona.md`. Apply it to wrapper messages only. Keep previews, records, and
reports neutral. Restore the session voice after the report.

## Contract

Read `${CLAUDE_PLUGIN_ROOT}/shared/project-execution-contract.md`. Activation configures
transport; it does not verify, freeze, hash, or adopt the Linear graph. Do not call GitHub,
the project snapshot loader, or the project lock before writing control. The only permitted
pre-write Superset call is the best-effort host agent discovery in step 5, which reads the
host's agent inventory and checks no transport.

## Workflow

1. Resolve one exact Linear project id with `get_project`.
2. Dispatch `monkey-maestro:control-loader`, then pass its complete envelope plus exact
   `expectedProjectId` through `scripts/records.mjs resolve-controls`. Retry an
   unavailable/invalid loader envelope once.
3. Leave an active control unchanged and report `already-active` only when the resolver's
   `sourceSchemaVersion` is `2` and the invocation supplied no explicit transport,
   agent, or concurrency override. Then enter
   `monkey-maestro:orchestrate <project-id>`. An active source-v1 control requires
   migration, and any explicit override requests a control update; both continue through
   the preview and verified v2 write below.
4. Resolve configuration from explicit arguments first, then the latest usable active or
   inactive control: `targetHostId`, `supersetProjectId`, `defaultAgent`, and
   `maxConcurrency`. Default concurrency is `4` and must be 1–10. Require host and
   Superset project ids rather than guessing them. `defaultAgent` carries no built-in
   default: it is settled against the host's own agent inventory in step 5.
5. Resolve `defaultAgent` from the host inventory rather than a hardcoded name. Capture the
   host agents once, tolerating failure:

   ```text
   superset agents list --host <targetHostId> --json > "$capture" 2>"$capture.err"
   ```

   A non-zero exit or an empty capture is an unknown inventory, not a failure; keep the
   captured stderr to explain it. Pass the capture path, the explicit `--agent` value, and
   the inherited control agent through `scripts/host-agents.mjs resolve-default`, then
   follow `resolution.status`:
   - `resolved` — use `resolution.agent`.
   - `choice-required` — show every `resolution.options` entry as `selector` plus `label`
     and let the user pick one selector before the preview. Never pick for them.
   - `input-required` — the inventory is unreadable (`HOST_AGENTS_INVENTORY_UNREADABLE`)
     and there is no explicit or inherited agent to honour. Show the captured stderr so the
     cause is visible, ask the user to name one agent, and continue with their answer. An
     unreachable Superset never prevents activation.
   - `blocked` — report the reason and create nothing. `AGENT_NOT_CONFIGURED` lists the
     host's real selectors against the rejected `--agent`; `HOST_AGENTS_NONE_CONFIGURED`
     means a readable inventory in which the host configures no agent at all.

   Whenever `resolution.replacedAgent` is present — on a `resolved` or a `choice-required`
   status — name both agents, so a superseded control agent is never silently swapped.

   Discovery is best effort and never a precondition. An offline host, an absent CLI, a
   partial list, or a malformed capture is an unknown inventory, which honours an explicit
   or inherited agent unchanged and otherwise asks. A resolved agent must be a selector the
   host reports, never a runtime name assumed by this plugin. `superset agents list` never
   reports the provider's `superset` session selector, so Maestro does not accept it as a
   worker agent.

6. Build a schema-v2 successor through `scripts/records.mjs build-control` with a fresh
   `runId`, `active: true`, revision one above the latest usable control or `1`, and now as
   `updatedAt`. It contains only the fields in the shared contract.
7. Show the complete mutation preview and ask once:

```text
Apply this Maestro activation/update with the displayed host, Superset project, agent, and concurrency? (y / cancel)
```

8. On `y`, save one Linear project comment. On denial, create nothing.
9. Re-dispatch `control-loader`, re-run envelope validation/resolution, and require the
   exact written project/run/config/revision with `active: true`. Report an unverifiable
   write as `degraded-control`; never rewrite blindly.
10. Enter `monkey-maestro:orchestrate <project-id>`. Orchestration performs transport
    checks only if Linear selects non-terminal work.

## Report

```text
monkey-maestro:start report
  Project/run: <project id> / <run id>
  Control:     schema v2 · revision <n> · active
  Transport:   <host> / <Superset project> / <agent> / concurrency <n>
  Agent:       <selector> · source <explicit | inherited | only-configured | named> · host inventory <known | unknown>
  Next:        monkey-maestro:orchestrate <project id>
```
