# Repository instructions

Read and follow [CLAUDE.md](CLAUDE.md) completely before modifying this repository. It is
the canonical repository guidance for both Codex and Claude Code.

For skill creation or refactoring, apply the **Skill authoring and progressive disclosure**
section and ADR 0009. Run `bun run check:skills` plus the repository verification required
by the affected plugin.

Repository-only workflow skills live canonically in `.agents/skills/`, which Codex discovers.
Matching entries in `.claude/skills/` are symlinks to those same skill directories for Claude Code.
Keep one source of truth and preserve relative references from the canonical skill directory.
