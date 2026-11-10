# Runtime hook scaffolding

Read only when the new plugin requested hooks. Use events supported by its selected runtimes.

## Layout and manifest

- Put shared hook scripts under `<plugin>/hooks/` and declare selected events once in
  `<plugin>/hooks/hooks.json`. Both runtimes discover this file; never duplicate its events
  inline in a plugin manifest.
- Commands resolve the install root with `${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}`, for example
  `node "${PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs"`.
- Add ephemeral state only when the hook needs it. Use the runtime's `PLUGIN_DATA` or
  `CLAUDE_PLUGIN_DATA` directory, and stay silent when required state storage is unavailable.
  Never assume an installed plugin directory is writable.

## Implementation

- Use ESM `.mjs` and Node built-ins only.
- For a stateful hook, inspect the existing Linear Devotee hooks and their runtime helper.
  Reuse only applicable state handling and cleanup; remove Linear-specific extraction.
- Each event handler reads stdin JSON and emits the event's `hookSpecificOutput` shape. Accept
  both runtime environment names when a root or data directory is required; use the installed
  script's location for static relative resources when no environment variable is needed.
- Leave a narrow domain TODO for trigger detection rather than copying another plugin's trigger.

## Verification

- Add focused tests for malformed stdin, missing required environment, no-trigger behavior,
  emitted event names, and the Claude/Codex inputs and environment names the hook consumes.
- Confirm every declared command resolves inside the generated plugin and no event is declared
  twice.
- Run the hook tests plus `bun run test:meta` and `bun run check:workflow`.
