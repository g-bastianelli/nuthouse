# Embedded workflow bundle

This directory is generated from the repository's canonical `_shared/workflow` source. The plugin
directory is the installation boundary: runtime code imports only sibling modules from
`lib/workflow/` and Node.js built-ins. It never reads the repository source tree and never requires
Warden.

`bundle.json` records the deterministic canonical source hash and exact generated file inventory.
Run `bun run build:workflow` at the repository root to regenerate every participating plugin, and
`bun run check:workflow` to reject missing, stale, extra, or non-isolated output.

## Runtime contract

- Claude Code and Codex adapters normalize runtime-specific input shapes before calling the same
  classifier, configuration resolver, risk evaluator, and capability graph.
- Explicit skill resolution is the reference path. A missing, failed, or invalid Claude Code hook
  falls back exactly once to that local path.
- Domain plugins use their own `lib/workflow/index.mjs`; Warden is an optional control surface, not a
  dependency.
- Verification uses an available specialized verifier when it declares executable commands.
  Otherwise it uses non-empty commands derived from repository-owned instructions or build
  metadata. If neither strategy is reliable, completion is blocked with
  `verification-strategy-unavailable`.
- Direct tasks use `prepareDirectTask` before implementation and `evaluateDirectTaskCompletion`
  afterward. `quick` needs only an ephemeral bounded scope, `standard` additionally needs a compact
  plan covering scope/checks/risks, and `strict` emits ordered `acid-prophet:write-spec` then
  `acid-prophet:write-plan` handoffs that preserve the decision manifest identity.
- A declared Moon workspace must carry the canonical `moon-moth:scope` map. A clean `_dark_` map
  produces a planned-path handoff so Moon can derive projects from the approved paths before edits;
  changed and planned maps both bind approved paths and verifier targets to the affected graph. A
  non-Moon workspace ignores Moon candidates and accepts only commands with source paths attributed
  to repository-owned `AGENTS.md`, `CLAUDE.md`, `package.json`, or other build metadata. Scope
  entries are segment-aware path boundaries, and approved/protected ancestors or descendants may
  not overlap. Completion revalidates the full ready preparation and remains blocked until executed
  evidence matches every selected command and target with exit status zero, carries the same run and
  decision hashes, and matches a freshly captured Git HEAD/worktree snapshot and verified-file set.

The JSON files below `fixtures/` are generated with the bundle so release-isolation tests can prove
the same decisions and fallbacks from each plugin's copied installation directory.
