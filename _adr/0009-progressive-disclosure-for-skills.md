# 0009 — Progressive disclosure is the skill authoring default

## Status

Accepted (2026-09-24).

Supersedes ADR 0007 only for skill-entrypoint size, progressive disclosure, and
guardrail writing style. ADR 0007's prose-orchestration decision remains accepted.

## Context

The repository's workflows were already prose-first, but many `SKILL.md` files still
loaded every provider branch, recovery path, schema, and extended example whenever the
skill activated. Unique prose avoided duplication without avoiding irrelevant context.

Before this change, 45 skill entrypoints contained 5,594 lines. Some implementation
contracts were short but still mixed universal rules with framework-specific cases; for
example, React component ownership, state placement, styling, accessibility, and
performance guidance all loaded together.

The skill guidance from
[OpenAI](https://developers.openai.com/plugins/build/skills),
[Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices),
and [Agent Skills](https://agentskills.io/skill-creation/best-practices) converges on the
same operational model: concise discovery metadata, a focused entrypoint, conditional
supporting material, and executable helpers for repeated deterministic work.

The repository refactor inspected all 45 entrypoints, changed 35, and reduced entrypoint
content to 2,989 lines. Thirty-seven directly routed references now hold 1,278 lines of
conditional detail. Ten already focused skills remained self-contained. The complete
repository test and invariant suite passed after the change.

## Decision

`SKILL.md` is an entrypoint, not the complete manual.

1. Keep the description concise and discriminating: what the skill does, when it applies,
   and only exclusions that prevent likely misrouting.
2. Keep in `SKILL.md` what every invocation needs:
   - outcome and shared workflow or implementation invariants;
   - permission, safety, stop, and retry boundaries;
   - verification and output contract;
   - a direct router to conditional material;
   - for implementation contracts, one short representative compliant example when it
     clarifies the desired shape.
3. Put substantial mode-specific procedures, provider commands, schemas, recovery paths,
   and extended examples in `references/`. Link each reference directly from
   `SKILL.md` with an explicit condition describing when to read it.
4. Do not create a reference for material every invocation immediately needs, and do not
   split a short cohesive skill merely to reduce its line count.
5. Move deterministic repeated logic to `scripts/` and enforce mechanically checkable
   structure in code rather than prose.
6. Treat 500 lines as a hard review threshold for an entrypoint, not a target or a reason
   by itself to split a skill. Context relevance is the primary measure.
7. Use absolute language and `| Excuse | Reality |` tables only for evidenced safety,
   authority, or correctness failures. Explain the concrete failure mode briefly.
8. Review behavior after refactoring: activation, authorization, required evidence,
   conditional reference routing, output, and verification must remain intact.

`bun run check:skills` enforces the mechanical subset: entrypoint size, direct
reference existence, one-level reference placement, orphan prevention, and navigation
for long references. Behavioral quality remains a source-based review.

## Consequences

- Agents load less irrelevant context while retaining the full workflow on demand.
- A short skill may remain a single file; a longer skill may also remain whole when every
  section is unconditional and cohesive.
- Implementation contracts keep their repeated invariants visible and route specialized
  ecosystem cases to references.
- Description quality matters because descriptions are present during skill discovery,
  before a body is loaded.
- Refactors may change file shape without changing behavior; tests should assert
  invariants and outcomes across the entrypoint plus its routed references rather than
  freeze wording in one file.
- ADR 0007's duplication checker remains complementary: duplication and irrelevant
  entrypoint context are separate costs.
