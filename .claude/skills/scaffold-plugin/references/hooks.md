# Claude Code hook scaffolding

Read only when the new plugin requested `SessionStart`, `UserPromptSubmit`, or both.

## Layout and manifest

- Put hooks under `<plugin>/claudecode/hooks/` and ephemeral state under
  `<plugin>/claudecode/data/`.
- Manifest commands start at `${CLAUDE_PLUGIN_ROOT}/claudecode/hooks/<event>.mjs` because the
  plugin root, not `claudecode/`, is the install unit.
- Add only selected events to `.claude-plugin/plugin.json`.

## Implementation

- Use ESM `.mjs` and Node built-ins only.
- Read the current `linear-devotee/claudecode/hooks/state.mjs` as a state-management example. Copy
  only generic atomic read/write and cleanup behavior; remove Linear-specific extraction.
- Each event handler guards `CLAUDE_PLUGIN_ROOT`, reads stdin JSON, and emits the exact
  `hookSpecificOutput` shape for its event.
- Leave a narrow domain TODO for trigger detection rather than copying another plugin's trigger.
- Ignore ephemeral `state-*.json` files in `claudecode/data/.gitignore`.

## Verification

- Add focused tests for malformed stdin, missing environment, no-trigger behavior, and emitted
  event names.
- Run the hook tests plus `bun run test:meta` and `bun run check:workflow`.
