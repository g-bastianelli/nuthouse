# Advanced skill options

Read only the sections enabled by the requested skill.

## Subagent dispatch

- Prefer a dedicated functional agent when the same read-only task recurs. Generic one-shot
  agents are for genuinely local context.
- Dispatch the logical `<plugin>:<agent>` id. Read
  `${CLAUDE_PLUGIN_ROOT}/shared/agent-runtime-map.md` before resolving runtime names.
- Reject generic or persona-coded agent names. Create a missing dedicated agent separately with
  `scaffold-agent`.

## Project artifacts

- Resolve `PROJECT_ROOT` with `git rev-parse --show-toplevel`.
- Store user-facing artifacts under
  `${PROJECT_ROOT}/docs/<plugin>/<artifact-type>/<identifier>.md`, never plugin install data.
- Report the absolute artifact path. When the artifact is an implementation plan, use Context,
  Files, atomic checkbox Steps, Verify, Risks, and Out of scope.

## Auto-chaining

- Chain without another question only when the user requested the combined workflow and the
  downstream skill owns the remaining validation gate.
- Name the downstream skill and arguments explicitly. On any error, stop instead of chaining.

## Execution and arguments

- Default to inline execution. Use `context: fork` only for noisy research/report work whose
  intermediate context should remain isolated.
- Use `user-invocable: false` plus `genre: contract` for background knowledge; it has no workflow,
  approval menu, or final report.
- When the skill consumes `$ARGUMENTS` or positional arguments, add a quoted `argument-hint`.

## Model and effort

- Inherit by default.
- A lightweight model fits deterministic parsing or direct reporting, not complex mutation or
  architectural decisions.
- Fix effort only when the workflow has a stable reasoning need. Avoid unsupported combinations
  and validate frontmatter with `bun run test:meta`.
